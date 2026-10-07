// Release / new-episode alerts: what a user follows, and the notifications it produces.

export type FollowMediaType = 'movie' | 'tv'

/** The latest TV episode a follower has already been told about (or that had aired when they followed). */
export interface EpisodeMarker {
  season: number
  episode: number
  air_date?: string | null
}

/** One document per (user, title) in the `follows` collection. */
export interface Follow {
  userId: string
  media_type: FollowMediaType
  tmdbId: string
  title: string
  poster_path?: string | null
  created_at: Date
  /** Movies: TMDB release date (YYYY-MM-DD), refreshed by the cron. */
  release_date?: string | null
  /** Movies: set once the release alert was produced (or the movie was already out when followed). */
  released_notified_at?: Date | null
  /** TV: the latest aired episode the user already knows about. */
  last_episode?: EpisodeMarker | null
  checked_at?: Date | null
}

export type NotificationEmailStatus = 'pending' | 'sending' | 'sent' | 'failed'

/** One document per alert in the `notifications` collection (feeds both the email and the in-app bell). */
export interface ReleaseNotification {
  userId: string
  media_type: FollowMediaType
  tmdbId: string
  title: string
  poster_path?: string | null
  kind: 'movie_released' | 'new_episode'
  /** Unique per title + event, so the same alert can never be produced twice. */
  event_key: string
  episode?: (EpisodeMarker & { name?: string | null }) | null
  created_at: Date
  read: boolean
  email_status: NotificationEmailStatus
  email_claim?: string | null
  email_claimed_at?: Date | null
  email_attempts?: number
  emailed_at?: Date | null
}

/** Shape returned by GET /api/follows. */
export interface FollowItem {
  media_type: FollowMediaType
  id: string
  title: string
  poster_path?: string | null
  release_date?: string | null
  released: boolean
  last_episode?: EpisodeMarker | null
  created_at: string
}

/** Shape returned by GET /api/notifications. */
export interface NotificationItem {
  id: string
  media_type: FollowMediaType
  tmdbId: string
  title: string
  poster_path?: string | null
  kind: ReleaseNotification['kind']
  episode?: ReleaseNotification['episode']
  created_at: string
  read: boolean
}

/** "S02E05" (safe to use on the client: no server imports here). */
export const episodeCode = ({ season, episode }: EpisodeMarker) =>
  `S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`
