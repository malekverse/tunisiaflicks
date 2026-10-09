// The Tunisian TV collections (prefix ttv) and their indexes, created lazily once per server
// instance. Native driver, mongodb 5.9 (findOneAndUpdate answers { value }).
import 'server-only'
import type { Binary, Collection, Db } from 'mongodb'
import type { Cadence, SeriesKind } from './parse'
import type { TvChannelKind } from './channels'
import type { TvChannelStatus } from './view'

export type TtvPlaylistRef = {
  id: string
  title?: string | null
  /** From the Data API: how many videos the playlist holds. */
  itemCount?: number | null
  readAt?: Date | null
  failures?: number
  /** Its feed belongs to another channel: never read again. */
  rejected?: boolean
  seriesId?: string | null
}

/** One per channel; _id is the slug. */
export type TtvChannelDoc = {
  _id: string
  slug: string
  name: string
  nameAr: string
  handle: string
  youtubeId: string
  kind: TvChannelKind
  /** The picture's source address (Data API); our copy is avatarData. */
  avatar: string | null
  avatarData?: Binary | null
  avatarAt?: Date | null
  color: string
  status: TvChannelStatus
  disabled?: boolean
  lastUploadAt: Date | null
  /** Uploads in the last 7 days. */
  weekCount: number
  feedReadAt: Date | null
  feedOkAt: Date | null
  feedFailures: number
  live: { videoId: string, title: string, since: Date } | null
  playlists: TtvPlaylistRef[]
  playlistsListedAt?: Date | null
  updatedAt: Date
}

/** One per series; _id is `${channel}:${key}`. */
export type TtvSeriesDoc = {
  _id: string
  channelId: string
  source: 'playlist' | 'titles'
  key: string
  playlistId: string | null
  title: string
  titleAlt: string | null
  kind: SeriesKind
  seasons: number[]
  episodeCount: number
  firstAt: Date
  lastAt: Date
  coverId: string | null
  coverMaxres: boolean
  coverCheckedId?: string | null
  color: string | null
  colorOf?: string | null
  ramadan: number | null
  cadence: Cadence | null
  description: string | null
  /** Share of its checked videos that can be embedded (0..1). */
  playable: number
  hidden: boolean
  /** Every episode was read through the Data API. */
  complete: boolean
  updatedAt: Date
}

export type TtvVideoStatus = 'new' | 'ok' | 'blocked' | 'gone'

/** One per video; _id is the YouTube id. */
export type TtvVideoDoc = {
  _id: string
  channelId: string
  seriesId: string | null
  playlistIds: string[]
  title: string
  /** ≤300 characters, kept for drama episodes only. */
  description: string | null
  publishedAt: Date
  views: number | null
  duration: number | null
  episode: number | null
  part: number | null
  season: number | null
  date: string | null
  subtitle: string | null
  seriesName: string
  seriesNameAlt: string | null
  clip: boolean
  live: boolean
  status: TtvVideoStatus
  checkedAt: Date | null
  recheckAt: Date
  seenAt: Date
  goneAt?: Date | null
  updatedAt: Date
}

/** Run state ('state') and the Data API's daily units ('quota:YYYY-MM-DD'). */
export type TtvMetaDoc = {
  _id: string
  units?: number
  startedAt?: Date
  lastRunAt?: Date
  expireAt?: Date
}

export type TtvCollections = {
  db: Db
  channels: Collection<TtvChannelDoc>
  series: Collection<TtvSeriesDoc>
  videos: Collection<TtvVideoDoc>
  meta: Collection<TtvMetaDoc>
}

let indexes: Promise<unknown> | null = null

/** The collections, with their indexes ensured once per server instance. */
export async function ttv(): Promise<TtvCollections> {
  const clientPromise = (await import('@/src/lib/mongodb')).default
  const db = (await clientPromise).db()
  const collections: TtvCollections = {
    db,
    channels: db.collection<TtvChannelDoc>('ttvChannels'),
    series: db.collection<TtvSeriesDoc>('ttvSeries'),
    videos: db.collection<TtvVideoDoc>('ttvVideos'),
    meta: db.collection<TtvMetaDoc>('ttvMeta'),
  }
  indexes ??= Promise.all([
    collections.videos.createIndex({ channelId: 1, publishedAt: -1 }),
    collections.videos.createIndex({ seriesId: 1, publishedAt: -1 }),
    collections.videos.createIndex({ status: 1, recheckAt: 1 }),
    collections.videos.createIndex({ publishedAt: -1 }),
    collections.series.createIndex({ channelId: 1, lastAt: -1 }),
    collections.series.createIndex({ lastAt: -1 }),
    collections.meta.createIndex({ expireAt: 1 }, { expireAfterSeconds: 0 }),
  ]).catch((error) => {
    indexes = null
    console.error('tunisian-tv: creating the indexes failed', error)
  })
  await indexes
  return collections
}
