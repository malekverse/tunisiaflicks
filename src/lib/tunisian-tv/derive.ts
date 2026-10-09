// From a channel's stored uploads to its series: which upload belongs to which series, what kind
// of series it is, its rhythm, its Ramadan, its cover and whether people can play it here. Pure:
// the cron (ingest.ts) writes the result, and read.ts runs the same thing in memory when it has
// to start from the live feeds.
import { ramadanOf, toHijri, tunisDate } from '@/src/lib/hijri'
import { airingCadence, classifySeries, groupParts, isRamadanStart, seriesKey } from './parse'
import type { TtvSeriesDoc, TtvVideoDoc } from './db'
import type { TvChannelKind } from './channels'

export type DeriveVideo = Pick<TtvVideoDoc,
  '_id' | 'title' | 'publishedAt' | 'seriesId' | 'playlistIds' | 'episode' | 'part' | 'season' | 'date' | 'clip' | 'status' | 'duration' | 'seriesName' | 'seriesNameAlt' | 'description'>

export type DeriveSeries = Pick<TtvSeriesDoc, '_id' | 'source' | 'playlistId' | 'title' | 'titleAlt' | 'complete' | 'coverId' | 'coverMaxres' | 'coverCheckedId' | 'color' | 'colorOf'>

export type DerivedSeries = Omit<TtvSeriesDoc, 'updatedAt'>

/** A playlist's series id: `${channel}:${key}`, the same id titles would give the same name. */
export const seriesIdOf = (channel: string, key: string) => `${channel}:${key}`

const mostCommon = (values: (string | null)[]): string | null => {
  const counts = new Map<string, number>()
  for (const value of values) if (value) counts.set(value, (counts.get(value) ?? 0) + 1)
  let best: string | null = null
  let top = 0
  for (const [value, count] of counts) if (count > top) [best, top] = [value, count]
  return best
}

/**
 * The series of one channel. A video keeps the series a playlist gave it; the others are grouped
 * by the series named in their titles, when at least two uploads name it or the title numbers an
 * episode. Clips (summaries, promos) go to their own hidden series ("…:clips"). Returns every
 * series (recomputed) and each video's series (null: none).
 */
export function deriveChannel(o: {
  channel: string
  kind: TvChannelKind
  videos: DeriveVideo[]
  existing: DeriveSeries[]
  now: Date
}): { series: DerivedSeries[], assign: Map<string, string | null> } {
  const existing = new Map(o.existing.map((series) => [series._id, series]))
  const assign = new Map<string, string | null>()

  const titleKey = (video: DeriveVideo) => {
    const base = seriesKey(video.seriesName)
    return base ? (video.clip ? `${base}:clips` : base) : ''
  }
  const counts = new Map<string, number>()
  for (const video of o.videos) {
    if (video.playlistIds?.length && video.seriesId) continue
    const key = titleKey(video)
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  const members = new Map<string, DeriveVideo[]>()
  for (const video of o.videos) {
    let id: string | null = null
    if (video.playlistIds?.length && video.seriesId) {
      id = video.seriesId
    } else {
      const key = titleKey(video)
      if (key && ((counts.get(key) ?? 0) >= 2 || (video.episode !== null && !video.clip))) id = seriesIdOf(o.channel, key)
    }
    assign.set(video._id, id)
    if (id) members.set(id, [...(members.get(id) ?? []), video])
  }

  const series: DerivedSeries[] = []
  for (const [id, all] of members) {
    const live = all.filter((video) => video.status !== 'gone')
    if (live.length === 0) continue
    const before = existing.get(id)
    const newest = [...live].sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt))
    const oldest = [...newest].reverse()
    const episodes = oldest.filter((video) => !video.clip)
    const groups = groupParts(episodes)
    const key = id.slice(o.channel.length + 1)
    const fromPlaylist = before?.source === 'playlist'

    const title = fromPlaylist && before?.title ? before.title : mostCommon(newest.map((video) => video.seriesName)) ?? newest[0].title
    const titleAlt = fromPlaylist ? before?.titleAlt ?? null : mostCommon(newest.map((video) => video.seriesNameAlt))
    const kind = key.endsWith(':clips')
      ? 'clips'
      : classifySeries({
        titles: newest.slice(0, 30).map((video) => video.title),
        playlistTitle: fromPlaylist ? before?.title : null,
        channelKind: o.kind,
        durations: newest.slice(0, 30).map((video) => video.duration),
      })

    const firstAt = new Date(oldest[0].publishedAt)
    const lastAt = new Date(newest[0].publishedAt)
    const playableCover = newest.find((video) => video.status === 'ok') ?? newest.find((video) => video.status === 'new') ?? newest[0]
    const coverId = playableCover._id
    const checked = all.filter((video) => video.status !== 'new')
    const playable = checked.length === 0 ? 1 : checked.filter((video) => video.status === 'ok').length / checked.length

    let ramadan: number | null = null
    if (kind !== 'clips') {
      const hijri = toHijri(tunisDate(firstAt))
      for (const year of [hijri.year, hijri.year + 1]) {
        if (isRamadanStart(firstAt, ramadanOf(year).start)) ramadan = year
      }
    }

    const story = kind === 'drama'
      ? episodes.find((video) => video.description && video.description.length > 40)?.description ?? null
      : null

    series.push({
      _id: id,
      channelId: o.channel,
      source: fromPlaylist ? 'playlist' : 'titles',
      key,
      playlistId: fromPlaylist ? before?.playlistId ?? null : null,
      title,
      titleAlt: titleAlt && titleAlt !== title ? titleAlt : null,
      kind,
      seasons: [...new Set(live.map((video) => video.season).filter((season): season is number => season !== null))].sort((a, b) => a - b),
      episodeCount: groups.filter((group) => group.some((video) => video.status !== 'gone')).length,
      firstAt,
      lastAt,
      coverId,
      coverMaxres: before?.coverCheckedId === coverId ? before.coverMaxres : false,
      coverCheckedId: before?.coverCheckedId === coverId ? coverId : null,
      color: before?.colorOf === coverId ? before.color : before?.color ?? null,
      colorOf: before?.colorOf === coverId ? coverId : null,
      ramadan,
      cadence: airingCadence(groups.map((group) => group[0].publishedAt)),
      description: story,
      playable,
      hidden: kind === 'clips' || (checked.length >= 3 && playable < 0.2),
      complete: fromPlaylist && before?.complete === true,
    })
  }
  return { series, assign }
}
