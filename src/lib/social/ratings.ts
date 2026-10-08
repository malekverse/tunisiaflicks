// Five-star ratings, one per profile and title. Private until the profile shares them, and then
// only from that moment on. The public average stands on verified grown-up accounts only.
import 'server-only'
import { unstable_cache } from 'next/cache'
import { ObjectId } from 'mongodb'
import type { Locale } from '@/src/lib/i18n/locales'
import { socialDb, type RatingDoc } from './db'
import { getIdentities } from './identity'
import { getFriends } from './friends'
import { resolveShareMedia } from './media'
import { canSee, normalizePrivacy } from './privacy'
import { countLabelFor, roundHalf, tunisDay } from './rules'
import type { ProfileRef, PublicIdentity, ShareMedia } from './types'

export const MIN_ACCOUNTS_FOR_AVERAGE = 20
const DAY_MS = 24 * 60 * 60 * 1000

/** Thrown by setRating when the title doesn't exist on TMDB (the API answers 404). */
export class UnknownTitleError extends Error {
  constructor() {
    super('Unknown title')
  }
}

/** Is the profile a Kids profile, and is the account verified (stored with each rating). */
async function raterFacts(ref: ProfileRef) {
  if (!ObjectId.isValid(ref.userId)) return { kids: true, verified: false }
  const { users } = await socialDb()
  const user = await users.findOne({ _id: new ObjectId(ref.userId) }, { projection: { emailVerified: 1, profiles: 1 } })
  const profile = (user?.profiles ?? []).find((entry: { id?: unknown }) => String(entry?.id) === ref.profileId)
  return { kids: profile ? profile.kids === true : true, verified: !!user?.emailVerified }
}

export async function setRating(ref: ProfileRef, input: { media_type: 'movie' | 'tv'; tmdbId: string; stars: 1 | 2 | 3 | 4 | 5 }): Promise<{ first: boolean }> {
  const [media, facts] = await Promise.all([resolveShareMedia(input.media_type, input.tmdbId), raterFacts(ref)])
  if (!media) throw new UnknownTitleError()
  const { ratings } = await socialDb()
  const before = await ratings.countDocuments({ profileId: ref.profileId }, { limit: 1 })
  const now = new Date()
  await ratings.updateOne(
    { profileId: ref.profileId, media_type: input.media_type, tmdbId: media.id },
    {
      $set: {
        userId: ref.userId,
        stars: input.stars,
        title: media.title,
        poster_path: media.poster_path,
        kids: facts.kids,
        accountVerified: facts.verified,
        updatedAt: now,
      },
      $setOnInsert: { ratedAt: now },
    },
    { upsert: true },
  )
  return { first: before === 0 }
}

export async function getMyRating(ref: ProfileRef, media_type: 'movie' | 'tv', tmdbId: string): Promise<number | null> {
  const { ratings } = await socialDb()
  const doc = await ratings.findOne({ profileId: ref.profileId, media_type, tmdbId }, { projection: { stars: 1 } })
  return doc?.stars ?? null
}

export async function clearRating(ref: ProfileRef, media_type: 'movie' | 'tv', tmdbId: string): Promise<void> {
  const { ratings } = await socialDb()
  await ratings.deleteOne({ profileId: ref.profileId, media_type, tmdbId })
}

/**
 * The TunisiaFlicks average: the latest rating of each verified account (no Kids profiles), at
 * least a day old, and only once 20 accounts or more have rated. Rounded to half a star, with a
 * banded count. Computed at most once a day per title.
 */
export async function ratingSummary(media_type: 'movie' | 'tv', tmdbId: string): Promise<{ average: number | null; countLabel: string | null }> {
  if ((media_type !== 'movie' && media_type !== 'tv') || !/^[0-9]{1,9}$/.test(tmdbId)) return { average: null, countLabel: null }
  return unstable_cache(
    async () => {
      const { ratings } = await socialDb()
      const [result] = await ratings.aggregate<{ accounts: number; average: number }>([
        { $match: { media_type, tmdbId, kids: false, accountVerified: true, updatedAt: { $lte: new Date(Date.now() - DAY_MS) } } },
        { $sort: { updatedAt: -1 } },
        { $group: { _id: '$userId', stars: { $first: '$stars' } } },
        { $group: { _id: null, accounts: { $sum: 1 }, average: { $avg: '$stars' } } },
      ]).toArray()
      if (!result || result.accounts < MIN_ACCOUNTS_FOR_AVERAGE) return { average: null, countLabel: null }
      return { average: roundHalf(result.average), countLabel: countLabelFor(result.accounts) }
    },
    ['rating-summary', media_type, tmdbId],
    { revalidate: 86400, tags: [`rating:${media_type}:${tmdbId}`] },
  )()
}

/** Whether a page's ratings reach its friends right now, and from when. */
const sharedSince = (doc: { privacy?: unknown; ratingsVisibleSince?: Date } | null) => {
  if (!doc) return null
  const privacy = normalizePrivacy(doc.privacy as never)
  if (privacy.paused || privacy.ratings === 'private') return null
  return doc.ratingsVisibleSince ? new Date(doc.ratingsVisibleSince) : new Date(0)
}

/** Friends who rated this title and share their ratings (from the moment they started sharing). */
export async function friendsRatings(viewer: ProfileRef, media_type: 'movie' | 'tv', tmdbId: string): Promise<{ person: PublicIdentity; stars: number }[]> {
  const friends = await getFriends(viewer.profileId)
  if (friends.length === 0) return []
  const { ratings, profiles } = await socialDb()
  const ids = friends.map((friend) => friend.profileId)
  const rows = await ratings.find({ profileId: { $in: ids }, media_type, tmdbId, kids: false }).toArray()
  if (rows.length === 0) return []
  const pages = await profiles.find({ _id: { $in: rows.map((row) => row.profileId) } }, { projection: { privacy: 1, ratingsVisibleSince: 1 } }).toArray()
  const since = new Map(pages.map((page) => [page._id, sharedSince(page)]))
  const visible = rows.filter((row) => {
    const from = since.get(row.profileId)
    return from && new Date(row.updatedAt) >= from
  })
  const identities = await getIdentities(visible.map((row) => row.profileId))
  return visible
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .flatMap((row) => {
      const person = identities.get(row.profileId)
      return person ? [{ person, stars: row.stars }] : []
    })
}

/** Resolves titles for display in the viewer's language, a few at a time; drops the ones TMDB lost. */
export async function resolveAll<T>(rows: T[], ref: (row: T) => { media_type: 'movie' | 'tv'; id: string }, locale?: Locale): Promise<(T & { media: ShareMedia })[]> {
  const out: ((T & { media: ShareMedia }) | null)[] = new Array(rows.length).fill(null)
  let next = 0
  const worker = async () => {
    while (next < rows.length) {
      const index = next++
      const { media_type, id } = ref(rows[index])
      const media = await resolveShareMedia(media_type, id, locale)
      if (media) out[index] = { ...rows[index], media }
    }
  }
  await Promise.all(Array.from({ length: Math.min(6, rows.length) }, worker))
  return out.filter((row): row is T & { media: ShareMedia } => !!row)
}

/**
 * A page's recent ratings, newest first, as `viewer` may see them: all of them for the owner;
 * for anyone else only when canSee allows it, and only since the owner started sharing. Never a
 * Kids profile's ratings.
 */
export async function getRecentRatings(owner: ProfileRef, viewer: ProfileRef | null, opts?: { shareKey?: string | null; limit?: number; locale?: Locale }): Promise<{ media: ShareMedia; stars: number; day: string }[]> {
  const isOwner = viewer?.profileId === owner.profileId
  if (!isOwner && !(await canSee(viewer, owner, 'ratings', { shareKey: opts?.shareKey }))) return []
  const { ratings, profiles } = await socialDb()
  const filter: Record<string, unknown> = { profileId: owner.profileId }
  if (!isOwner) {
    const page = await profiles.findOne({ _id: owner.profileId }, { projection: { ratingsVisibleSince: 1 } })
    filter.kids = false
    filter.updatedAt = { $gte: page?.ratingsVisibleSince ? new Date(page.ratingsVisibleSince) : new Date() }
  }
  const limit = Math.min(Math.max(opts?.limit ?? 30, 1), 60)
  const rows: RatingDoc[] = await ratings.find(filter).sort({ updatedAt: -1 }).limit(limit).toArray()
  const resolved = await resolveAll(rows, (row) => ({ media_type: row.media_type, id: row.tmdbId }), opts?.locale)
  return resolved.map((row) => ({ media: row.media, stars: row.stars, day: tunisDay(row.updatedAt) }))
}
