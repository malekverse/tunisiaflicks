// Taste match between two profiles (lib/taste has the rules): your own ratings against the ones a
// friend shares with you, only as far as they share them (canSee, and nothing rated before they
// started sharing). Never a Kids profile's ratings. Nothing here is shown to the other person.
import 'server-only'
import type { Locale } from '@/src/lib/i18n/locales'
import { MIN_COMMON, scoreOf, tasteMatch, type Rated, type TasteMatch } from '@/src/lib/taste'
import { socialDb } from './db'
import { getFriends } from './friends'
import { getIdentities } from './identity'
import { canSee, normalizePrivacy } from './privacy'
import { resolveAll } from './ratings'
import type { ProfileRef, PublicIdentity, ShareMedia } from './types'

const MAX_RATINGS = 3000

type Row = { media_type: 'movie' | 'tv', tmdbId: string, stars: number, updatedAt: Date }
const toRated = (row: Row): Rated => ({ key: `${row.media_type}:${row.tmdbId}`, media_type: row.media_type, id: row.tmdbId, stars: row.stars, at: new Date(row.updatedAt).getTime() })
const PROJECTION = { media_type: 1, tmdbId: 1, stars: 1, updatedAt: 1, profileId: 1 }

/** Your own ratings, all of them. */
async function ownRatings(ref: ProfileRef): Promise<Rated[]> {
  const { ratings } = await socialDb()
  const rows = await ratings.find({ profileId: ref.profileId }, { projection: PROJECTION }).sort({ updatedAt: -1 }).limit(MAX_RATINGS).toArray()
  return rows.map(toRated)
}

/** Since when a page's ratings reach friends (null: they don't). */
function sharedSince(doc: { privacy?: unknown, ratingsVisibleSince?: Date } | null): Date | null {
  if (!doc) return null
  const privacy = normalizePrivacy(doc.privacy as never)
  if (privacy.paused || privacy.ratings === 'private') return null
  return doc.ratingsVisibleSince ? new Date(doc.ratingsVisibleSince) : new Date(0)
}

export type TasteResult = TasteMatch & {
  /** How each shown title looks, by key ("movie:550"), in the viewer's language. */
  media: Record<string, ShareMedia>
  /** How many titles each side has rated (that the viewer may see). */
  counts: { mine: number, theirs: number }
}

/**
 * The match between the viewer and someone whose page they're on, or null when the viewer may not
 * see that person's ratings (or it's their own page).
 */
export async function getTasteMatch(viewer: ProfileRef, owner: ProfileRef, opts: { shareKey?: string | null, locale?: Locale } = {}): Promise<TasteResult | null> {
  if (viewer.profileId === owner.profileId) return null
  if (!(await canSee(viewer, owner, 'ratings', { shareKey: opts.shareKey }))) return null
  const { ratings, profiles } = await socialDb()
  const page = await profiles.findOne({ _id: owner.profileId }, { projection: { ratingsVisibleSince: 1 } })
  const since = page?.ratingsVisibleSince ? new Date(page.ratingsVisibleSince) : new Date()
  const [mine, theirRows] = await Promise.all([
    ownRatings(viewer),
    ratings.find({ profileId: owner.profileId, kids: false, updatedAt: { $gte: since } }, { projection: PROJECTION }).sort({ updatedAt: -1 }).limit(MAX_RATINGS).toArray(),
  ])
  const match = tasteMatch(mine, theirRows.map(toRated))

  const shown = new Map<string, { key: string, media_type: 'movie' | 'tv', id: string }>()
  for (const item of [...match.bothLoved, ...match.disagree, ...match.theyLoved, ...match.youLoved]) shown.set(item.key, { key: item.key, media_type: item.media_type, id: item.id })
  const resolved = await resolveAll([...shown.values()], (row) => row, opts.locale)
  const media: Record<string, ShareMedia> = Object.fromEntries(resolved.map((row) => [row.key, row.media]))
  const known = (item: { key: string }) => item.key in media
  return {
    ...match,
    bothLoved: match.bothLoved.filter(known),
    disagree: match.disagree.filter(known),
    theyLoved: match.theyLoved.filter(known),
    youLoved: match.youLoved.filter(known),
    media,
    counts: { mine: mine.length, theirs: theirRows.length },
  }
}

export type FriendMatch = { person: PublicIdentity, score: number, common: number }

/**
 * Your closest friends by taste: the friends who share their ratings with friends, scored on the
 * titles you've both rated. Only the scores (no titles), best first.
 */
export async function bestMatches(viewer: ProfileRef, limit = 8): Promise<FriendMatch[]> {
  const mine = await ownRatings(viewer)
  if (mine.length < MIN_COMMON) return []
  const friends = (await getFriends(viewer.profileId)).slice(0, 300)
  if (!friends.length) return []
  const { ratings, profiles } = await socialDb()
  const pages = await profiles.find({ _id: { $in: friends.map((friend) => friend.profileId) } }, { projection: { privacy: 1, ratingsVisibleSince: 1 } }).toArray()
  const since = new Map(pages.flatMap((page) => {
    const from = sharedSince(page)
    return from ? [[page._id, from] as const] : []
  }))
  if (!since.size) return []

  // Only the titles you rated matter for the score.
  const myStars = new Map(mine.map((row) => [row.key, row.stars]))
  const rows = await ratings.find(
    { profileId: { $in: [...since.keys()] }, kids: false, tmdbId: { $in: [...new Set(mine.map((row) => row.id))] } },
    { projection: PROJECTION },
  ).toArray()
  const pairs = new Map<string, { mine: number, theirs: number }[]>()
  for (const row of rows) {
    const own = myStars.get(`${row.media_type}:${row.tmdbId}`)
    const from = since.get(row.profileId)
    if (own === undefined || !from || new Date(row.updatedAt) < from) continue
    pairs.set(row.profileId, [...(pairs.get(row.profileId) ?? []), { mine: own, theirs: row.stars }])
  }

  const scored = [...pairs.entries()].flatMap(([profileId, list]) => {
    const score = scoreOf(list)
    return score === null ? [] : [{ profileId, score, common: list.length }]
  }).sort((a, b) => b.score - a.score || b.common - a.common).slice(0, limit)
  if (!scored.length) return []
  const identities = await getIdentities(scored.map((entry) => entry.profileId))
  return scored.flatMap((entry) => {
    const person = identities.get(entry.profileId)
    return person ? [{ person, score: entry.score, common: entry.common }] : []
  })
}
