// What friends are watching: their history and ratings, as far as each of them shares. Only the
// day is ever shown (never a time), watches surface a couple of hours late, and nothing from
// before they turned sharing on.
import 'server-only'
import { unstable_cache } from 'next/cache'
import type { Locale } from '@/src/lib/i18n/locales'
import { socialDb, DAYS, type SocialProfileDoc } from './db'
import { friendRows, otherSide } from './friends'
import { getIdentities } from './identity'
import { tmdbRecord } from './media'
import { canSeeDoc, normalizePrivacy } from './privacy'
import { resolveAll } from './ratings'
import { tunisDay } from './rules'
import type { ProfileRef, PublicIdentity, ShareMedia } from './types'

export type ActivityItem = {
  id: string
  actor: PublicIdentity
  kind: 'watched' | 'on_episode' | 'season_finale' | 'series_finale' | 'rated'
  media: ShareMedia
  season?: number
  episode?: number
  stars?: number
  day: string
}

const FRIENDS_LOOKED_AT = 50
const HISTORY_PER_FRIEND = 40
const WINDOW_DAYS = 60
const MAX_PAGE = 30

/** How late watches surface (minutes): SOCIAL_ACTIVITY_DELAY_MINUTES, 120 by default, 0 in development. */
export function activityDelayMs() {
  const raw = process.env.SOCIAL_ACTIVITY_DELAY_MINUTES
  const minutes = raw !== undefined && raw !== '' && Number.isFinite(Number(raw))
    ? Math.max(0, Number(raw))
    : process.env.NODE_ENV === 'development' ? 0 : 120
  return minutes * 60 * 1000
}

type Raw = {
  key: string
  actorId: string
  media_type: 'movie' | 'tv'
  id: string
  at: number
  season?: number
  episode?: number
  stars?: number
}

type HistoryItem = { id?: unknown; media_type?: unknown; watched_at?: unknown; season?: unknown; episode?: unknown }

const asId = (value: unknown) => (typeof value === 'number' ? String(value) : typeof value === 'string' && /^[0-9]{1,9}$/.test(value) ? value : null)

/** A friend's history items that may be shown: since they shared, old enough, recent enough. */
function visibleWatches(profileId: string, items: HistoryItem[], since: Date, now: number): Raw[] {
  const newest = now - activityDelayMs()
  const oldest = Math.max(since.getTime(), now - DAYS(WINDOW_DAYS))
  const out: Raw[] = []
  for (const item of items) {
    const id = asId(item.id)
    const mediaType = item.media_type === 'movie' || item.media_type === 'tv' ? item.media_type : null
    const at = item.watched_at ? new Date(item.watched_at as string).getTime() : NaN
    if (!id || !mediaType || !Number.isFinite(at) || at < oldest || at > newest) continue
    const episodic = mediaType === 'tv' && Number.isInteger(item.season) && Number.isInteger(item.episode) && (item.season as number) > 0
    out.push({
      key: `${profileId}:${mediaType}:${id}`,
      actorId: profileId,
      media_type: mediaType,
      id,
      at,
      ...(episodic ? { season: item.season as number, episode: item.episode as number } : {}),
    })
  }
  return out
}

/** On a season's or the series' last episode? (one TMDB call per returned item, cached a day) */
async function classifyEpisode(id: string, season: number, episode: number): Promise<ActivityItem['kind']> {
  const show = await tmdbRecord('tv', id)
  const seasons: { season_number?: number; episode_count?: number }[] = Array.isArray(show?.seasons) ? show!.seasons : []
  const current = seasons.find((entry) => entry.season_number === season)
  if (!current?.episode_count || episode < current.episode_count) return 'on_episode'
  const last = Math.max(...seasons.map((entry) => entry.season_number ?? 0))
  const ended = show?.status === 'Ended' || show?.status === 'Canceled'
  return ended && season === last ? 'series_finale' : 'season_finale'
}

/** Every visible item of the given friends, newest first, one per friend and title. */
async function collect(friends: { ref: ProfileRef; page: SocialProfileDoc }[], now: number): Promise<Raw[]> {
  const { userContent, ratings } = await socialDb()
  const watchers = friends.filter(({ page }) => {
    const privacy = normalizePrivacy(page.privacy)
    return !privacy.paused && privacy.activity === 'friends'
  })
  const raters = friends.filter(({ page }) => {
    const privacy = normalizePrivacy(page.privacy)
    return !privacy.paused && privacy.ratings !== 'private'
  })
  const pageOf = new Map(friends.map(({ page }) => [page._id, page]))

  const [histories, rated] = await Promise.all([
    watchers.length === 0 ? [] : userContent.find(
      { type: 'history', profileId: { $in: watchers.map(({ ref }) => ref.profileId) } },
      { projection: { profileId: 1, userId: 1, items: { $slice: HISTORY_PER_FRIEND } } },
    ).toArray(),
    raters.length === 0 ? [] : ratings.find(
      { profileId: { $in: raters.map(({ ref }) => ref.profileId) }, kids: false, updatedAt: { $gte: new Date(now - DAYS(WINDOW_DAYS)) } },
      { projection: { profileId: 1, media_type: 1, tmdbId: 1, stars: 1, updatedAt: 1 } },
    ).sort({ updatedAt: -1 }).limit(FRIENDS_LOOKED_AT * 20).toArray(),
  ])

  const byKey = new Map<string, Raw>()
  for (const history of histories) {
    const page = pageOf.get(String(history.profileId))
    // History documents belong to an account too: never trust a profile id alone.
    if (!page || page.userId !== history.userId) continue
    for (const raw of visibleWatches(page._id, Array.isArray(history.items) ? history.items : [], new Date(page.activitySince ?? now), now)) {
      const seen = byKey.get(raw.key)
      if (!seen || seen.at < raw.at) byKey.set(raw.key, raw)
    }
  }
  for (const row of rated) {
    const page = pageOf.get(row.profileId)
    const since = page?.ratingsVisibleSince ? new Date(page.ratingsVisibleSince).getTime() : now
    const at = new Date(row.updatedAt).getTime()
    if (!page || at < since) continue
    const key = `${row.profileId}:${row.media_type}:${row.tmdbId}`
    const seen = byKey.get(key)
    // A rating says more than a watch: it takes the title's slot, keeping the later moment.
    byKey.set(key, { key, actorId: row.profileId, media_type: row.media_type, id: row.tmdbId, at: Math.max(at, seen?.at ?? 0), stars: row.stars })
  }
  return Array.from(byKey.values()).sort((a, b) => b.at - a.at)
}

/** Turns raw items into ActivityItems: identities, titles in the viewer's language, episode kinds. */
async function present(raws: Raw[], locale?: Locale): Promise<ActivityItem[]> {
  const identities = await getIdentities(raws.map((raw) => raw.actorId))
  const resolved = await resolveAll(raws, (raw) => ({ media_type: raw.media_type, id: raw.id }), locale)
  const items = await Promise.all(resolved.map(async (raw): Promise<ActivityItem | null> => {
    const actor = identities.get(raw.actorId)
    if (!actor) return null
    let kind: ActivityItem['kind'] = raw.stars ? 'rated' : 'watched'
    if (!raw.stars && raw.season !== undefined && raw.episode !== undefined) kind = await classifyEpisode(raw.id, raw.season, raw.episode)
    return {
      id: `${actor.handle}:${raw.media_type}:${raw.id}`,
      actor,
      kind,
      media: raw.media,
      ...(raw.season !== undefined && !raw.stars ? { season: raw.season, episode: raw.episode } : {}),
      ...(raw.stars ? { stars: raw.stars } : {}),
      day: tunisDay(raw.at),
    }
  }))
  return items.filter((item): item is ActivityItem => !!item)
}

async function computeFeed(viewer: ProfileRef, offset: number, limit: number, locale?: Locale) {
  const now = Date.now()
  const rows = await friendRows(viewer.profileId, FRIENDS_LOOKED_AT)
  if (rows.length === 0) return { items: [], next: null }
  const refs = rows.map((row) => otherSide(row, viewer.profileId))
  const { profiles, friendships } = await socialDb()
  const pages = await profiles.find({ _id: { $in: refs.map((ref) => ref.profileId) } }).toArray()
  const pageOf = new Map(pages.map((page) => [page._id, page]))
  const friends = refs.flatMap((ref) => {
    const page = pageOf.get(ref.profileId)
    return page && page.userId === ref.userId ? [{ ref, page }] : []
  })
  const all = await collect(friends, now)

  // Keep "most recently active" honest, lazily: the friends whose latest item moved.
  const latest = new Map<string, number>()
  for (const raw of all) if (!latest.has(raw.actorId)) latest.set(raw.actorId, raw.at)
  const updates = rows.flatMap((row) => {
    const at = latest.get(otherSide(row, viewer.profileId).profileId)
    return at && (!row.lastActivityAt || new Date(row.lastActivityAt).getTime() < at)
      ? [{ updateOne: { filter: { _id: row._id }, update: { $set: { lastActivityAt: new Date(at) } } } }]
      : []
  })
  if (updates.length) await friendships.bulkWrite(updates, { ordered: false }).catch(() => undefined)

  const page = all.slice(offset, offset + limit)
  const items = await present(page, locale)
  return { items, next: offset + limit < all.length ? String(offset + limit) : null }
}

/**
 * The friends feed: up to `limit` (30 max) items from the 50 most recently active friends, newest
 * first. `before` is the `next` of the previous page. Cached 5 minutes per viewer profile (tag
 * `friends:<profileId>`).
 */
export async function getFriendsActivity(viewer: ProfileRef, opts?: { before?: string; limit?: number; locale?: Locale }): Promise<{ items: ActivityItem[]; next: string | null }> {
  const limit = Math.min(Math.max(Math.floor(opts?.limit ?? 20), 1), MAX_PAGE)
  const offset = opts?.before && /^[0-9]{1,4}$/.test(opts.before) ? Number(opts.before) : 0
  const locale = opts?.locale
  return unstable_cache(
    () => computeFeed(viewer, offset, limit, locale),
    ['friends-activity', viewer.userId, viewer.profileId, String(offset), String(limit), locale ?? ''],
    { revalidate: 300, tags: [`friends:${viewer.profileId}`] },
  )()
}

/**
 * A page's own recent watches (for /u and /me): everything for the owner; for anyone else only
 * when canSee allows activity, since the owner shared it and at least the delay ago.
 */
export async function getRecentActivity(owner: ProfileRef, viewer: ProfileRef | null, limit = 20, locale?: Locale): Promise<ActivityItem[]> {
  const { profiles, userContent } = await socialDb()
  const page = await profiles.findOne({ _id: owner.profileId })
  if (!page || page.userId !== owner.userId) return []
  const isOwner = viewer?.profileId === owner.profileId
  if (!isOwner && !(await canSeeDoc(viewer, owner, page, 'activity'))) return []
  const history = await userContent.findOne(
    { type: 'history', userId: owner.userId, profileId: owner.profileId },
    { projection: { items: { $slice: HISTORY_PER_FRIEND } } },
  )
  const now = Date.now()
  const items: HistoryItem[] = Array.isArray(history?.items) ? history!.items : []
  const raws = isOwner
    ? items.flatMap((item) => visibleWatches(page._id, [item], new Date(0), now + activityDelayMs()))
    : visibleWatches(page._id, items, new Date(page.activitySince ?? now), now)
  return present(raws.slice(0, Math.min(Math.max(limit, 1), MAX_PAGE)), locale)
}
