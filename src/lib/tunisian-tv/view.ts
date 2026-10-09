// What the Tunisian TV pages receive: plain, serializable views (dates as ISO strings), safe to
// import from client components. The database documents live in ./db.ts.
import type { Cadence, SeriesKind } from './parse'
import type { TvChannelKind } from './channels'

export type TvChannelStatus = 'active' | 'quiet' | 'dormant' | 'unreachable'

export type TvChannelView = {
  slug: string
  name: string
  nameAr: string
  handle: string
  youtubeId: string
  kind: TvChannelKind
  color: string
  status: TvChannelStatus
  /** Our own copy of the channel's picture (/tunisian/tv/{slug}/avatar), or null: a monogram. */
  avatar: string | null
  /** On air now: the broadcast's video. */
  live: { videoId: string, title: string } | null
  lastUploadAt: string | null
  weekCount: number
}

export type TvPart = { id: string, part: number | null, blocked: boolean }

export type TvVideoView = {
  id: string
  title: string
  /** The episode's own title ("خدعة العمر"), when the upload names one. */
  subtitle: string | null
  channel: string
  seriesId: string | null
  seriesTitle: string | null
  seriesTitleAlt: string | null
  episode: number | null
  season: number | null
  /** Every part of the same broadcast, in order, this one included (one part when it isn't split). */
  parts: TvPart[]
  publishedAt: string
  views: number | null
  duration: number | null
  /** The owner forbids embedding: it opens on YouTube. */
  blocked: boolean
  live: boolean
}

export type TvSeriesView = {
  id: string
  channel: string
  title: string
  titleAlt: string | null
  kind: SeriesKind
  episodeCount: number
  firstAt: string
  lastAt: string
  coverId: string | null
  coverMaxres: boolean
  color: string | null
  cadence: Cadence | null
  /** The Hijri year of the Ramadan it was made for. */
  ramadan: number | null
  /** Every episode was read (only possible with the YouTube Data API). */
  complete: boolean
  description: string | null
  /** The newest episode, its parts grouped. */
  latest: TvVideoView | null
}

export type TvHub = {
  channels: TvChannelView[]
  hero: TvSeriesView | null
  /** The hero's episodes in order (the dialog steps through them). */
  heroEpisodes: TvVideoView[]
  live: TvVideoView[]
  newEpisodes: TvVideoView[]
  ramadan: { hijriYear: number, year: number, during: boolean, series: TvSeriesView[] } | null
  onAir: TvSeriesView[]
  mostWatched: TvVideoView[]
  talk: TvSeriesView[]
  complete: TvSeriesView[]
  /** The newest drama episode within 36 hours (the /tunisian door says "New: …"). */
  fresh: { seriesTitle: string, seriesTitleAlt: string | null, episode: number | null } | null
  updatedAt: string | null
  /** Nothing stored yet: these came straight from the feeds. */
  bootstrap: boolean
}

export type TvChannelPage = {
  channel: TvChannelView
  series: { series: TvSeriesView, episodes: TvVideoView[] }[]
  shows: { series: TvSeriesView, episodes: TvVideoView[] }[]
  latest: TvVideoView[]
  updatedAt: string | null
}

const ARABIC_SCRIPT = /[؀-ۿ]/

/**
 * A series' name for the reader: in Arabic or Derja the Arabic-script name when there is one,
 * otherwise the Latin one first.
 */
export function seriesName(title: string, titleAlt: string | null | undefined, arabic: boolean): string {
  if (!titleAlt) return title
  const titleArabic = ARABIC_SCRIPT.test(title)
  if (arabic) return titleArabic ? title : titleAlt
  return titleArabic ? titleAlt : title
}

/** A channel's name for the reader (radio stations keep their Latin name). */
export function channelName(channel: Pick<TvChannelView, 'name' | 'nameAr'>, arabic: boolean): string {
  return arabic ? channel.nameAr : channel.name
}

/** Up to two letters for a channel's monogram ("W1", "EH", "N"). */
export function channelInitials(name: string): string {
  const words = name.replace(/[^\p{L}\p{N} ]/gu, ' ').split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  const second = words[1]?.[0] ?? ''
  return (words[0][0] + (/\d/.test(second) || words.length > 1 ? second : '')).toUpperCase()
}

/** /tunisian/tv/{channel}?v={id}: one video, opened on its channel's page. */
export const tvVideoHref = (channel: string, id: string) => `/tunisian/tv/${channel}?v=${encodeURIComponent(id)}`
export const tvChannelHref = (channel: string) => `/tunisian/tv/${channel}`
export const tvSeriesHref = (channel: string, seriesId: string) => `/tunisian/tv/${channel}#${seriesAnchor(seriesId)}`
/** The id of a series' section on its channel page ("series-" and a safe slug of its id). */
export const seriesAnchor = (seriesId: string) => `series-${seriesId.replace(/[^\p{L}\p{N}-]+/gu, '-')}`
