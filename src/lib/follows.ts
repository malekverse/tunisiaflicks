// Server-side helpers for release / new-episode alerts (follows + notifications collections).
import clientPromise from '@/src/lib/mongodb'
import { tmdbFetch } from '@/src/lib/tmdb'
import type { EpisodeMarker, Follow, FollowMediaType, ReleaseNotification } from '@/src/lib/models/Follow'

export { episodeCode } from '@/src/lib/models/Follow'

export const FOLLOW_MEDIA_TYPES: FollowMediaType[] = ['movie', 'tv']

export const isFollowMediaType = (value: unknown): value is FollowMediaType =>
  value === 'movie' || value === 'tv'

export const isTmdbId = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{1,10}$/.test(value)

let indexesReady: Promise<unknown> | null = null

/** The two alert collections, with their indexes ensured once per server instance. */
export async function alertCollections() {
  const db = (await clientPromise).db()
  const follows = db.collection<Follow>('follows')
  const notifications = db.collection<ReleaseNotification>('notifications')
  if (!indexesReady) {
    indexesReady = Promise.all([
      follows.createIndex({ userId: 1, media_type: 1, tmdbId: 1 }, { unique: true }),
      follows.createIndex({ media_type: 1, tmdbId: 1 }),
      notifications.createIndex({ userId: 1, event_key: 1 }, { unique: true }),
      notifications.createIndex({ userId: 1, created_at: -1 }),
      // Old alerts expire; dedupe doesn't need them because the follow markers have moved on.
      notifications.createIndex({ created_at: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 }),
      notifications.createIndex({ email_status: 1, userId: 1 }),
    ]).catch((error) => {
      indexesReady = null
      throw error
    })
  }
  await indexesReady
  return { follows, notifications }
}

/** Today as YYYY-MM-DD (UTC), the format TMDB uses for release and air dates. */
export const todayUtc = () => new Date().toISOString().slice(0, 10)

export const hasReleased = (releaseDate: string | null | undefined, today = todayUtc()) =>
  !!releaseDate && releaseDate <= today

/** True when `candidate` is a later episode than `marker` (specials, season 0, never count). */
export function isNewerEpisode(candidate: EpisodeMarker | null | undefined, marker: EpisodeMarker | null | undefined) {
  if (!candidate || candidate.season < 1) return false
  if (!marker) return true
  return candidate.season > marker.season || (candidate.season === marker.season && candidate.episode > marker.episode)
}

export type TitleSnapshot = {
  media_type: FollowMediaType
  tmdbId: string
  title: string
  poster_path: string | null
  /** Movies only. */
  release_date: string | null
  /** TV only: the latest aired episode. */
  last_episode: (EpisodeMarker & { name?: string | null }) | null
}

/** The bits of a TMDB title that alerts care about. `revalidate` 0 bypasses Next's data cache. */
export async function fetchTitleSnapshot(media_type: FollowMediaType, tmdbId: string, revalidate = 600): Promise<TitleSnapshot> {
  const data = await tmdbFetch(`${media_type}/${tmdbId}`, {}, revalidate)
  const last = media_type === 'tv' ? data.last_episode_to_air : null
  return {
    media_type,
    tmdbId,
    title: data.title || data.name || data.original_title || data.original_name || 'Untitled',
    poster_path: data.poster_path ?? null,
    release_date: media_type === 'movie' ? data.release_date || null : null,
    last_episode: last && Number.isInteger(last.season_number) && Number.isInteger(last.episode_number)
      ? { season: last.season_number, episode: last.episode_number, air_date: last.air_date || null, name: last.name || null }
      : null,
  }
}

