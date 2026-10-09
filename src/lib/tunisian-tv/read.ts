// What the pages read: cached for 5 minutes under the tag 'ttv' (the cron clears it after each
// run). Nothing here throws: a missing database, an empty one or YouTube being unreachable all
// give an empty answer, and the pages say Tunisian TV is warming up. When nothing is stored yet,
// the hub starts straight from the channels' live feeds, within 3 seconds in all.
import 'server-only'
import { unstable_cache } from 'next/cache'
import { ramadanOf } from '@/src/lib/hijri'
import { ramadanStatus } from '@/src/lib/ramadan'
import { withTimeout } from '@/src/lib/with-timeout'
import { youtubeThumb } from '@/src/lib/youtube'
import { channelBySlug, enabledChannels, uploadsPlaylist, type TvChannelDef } from './channels'
import { ttv, type TtvChannelDoc, type TtvSeriesDoc, type TtvVideoDoc } from './db'
import { deriveChannel } from './derive'
import { fetchFeed } from './net'
import { cleanDescription, groupParts, parseEpisodeTitle } from './parse'
import type { TvChannelPage, TvChannelView, TvHub, TvSeriesView, TvVideoView } from './view'

const DAY = 86_400_000
const REVALIDATE = 300
const TAGS = ['ttv']
const BOOTSTRAP_MS = 3000

type ChannelLite = Omit<TtvChannelDoc, 'avatarData' | 'playlists'> & { hasAvatar: boolean }
type VideoLite = Pick<TtvVideoDoc,
  '_id' | 'channelId' | 'seriesId' | 'title' | 'publishedAt' | 'views' | 'duration' | 'episode' | 'part' | 'season' | 'date' | 'subtitle' | 'clip' | 'live' | 'status' | 'seriesName' | 'seriesNameAlt'>
type SeriesLite = TtvSeriesDoc

const VIDEO_FIELDS = {
  _id: 1, channelId: 1, seriesId: 1, title: 1, publishedAt: 1, views: 1, duration: 1, episode: 1, part: 1, season: 1, date: 1, subtitle: 1, clip: 1, live: 1, status: 1,
  seriesName: 1, seriesNameAlt: 1,
} as const

const EMOJI = /[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu
const cleanTitle = (title: string) => title.replace(EMOJI, '').replace(/\s+/g, ' ').trim()
const iso = (value: Date | string | null | undefined) => (value ? new Date(value).toISOString() : null)

// ---------------------------------------------------------------------------------------------
// Views

function channelView(doc: ChannelLite): TvChannelView {
  return {
    slug: doc.slug,
    name: doc.name,
    nameAr: doc.nameAr,
    handle: doc.handle,
    youtubeId: doc.youtubeId,
    kind: doc.kind,
    color: doc.color,
    status: doc.status,
    avatar: doc.hasAvatar ? `/tunisian/tv/${doc.slug}/avatar?v=${doc.avatarAt ? new Date(doc.avatarAt).getTime().toString(36) : '0'}` : null,
    live: doc.live ? { videoId: doc.live.videoId, title: cleanTitle(doc.live.title) } : null,
    lastUploadAt: iso(doc.lastUploadAt),
    weekCount: doc.weekCount ?? 0,
  }
}

/** One broadcast (its parts grouped) as a tile. */
function videoView(parts: VideoLite[], seriesById: Map<string, SeriesLite>): TvVideoView {
  const lead = parts[0]
  const series = lead.seriesId ? seriesById.get(lead.seriesId) : undefined
  return {
    id: lead._id,
    title: cleanTitle(lead.title),
    subtitle: lead.subtitle ? cleanTitle(lead.subtitle) : null,
    channel: lead.channelId,
    seriesId: series ? series._id : null,
    seriesTitle: series ? series.title : null,
    seriesTitleAlt: series ? series.titleAlt : null,
    episode: lead.episode,
    season: lead.season,
    parts: parts.map((video) => ({ id: video._id, part: video.part, blocked: video.status === 'blocked' })),
    publishedAt: new Date(lead.publishedAt).toISOString(),
    views: parts.reduce<number | null>((sum, video) => (video.views === null || video.views === undefined ? sum : (sum ?? 0) + video.views), null),
    duration: parts.reduce<number | null>((sum, video) => (video.duration ? (sum ?? 0) + video.duration : sum), null),
    blocked: lead.status === 'blocked',
    live: lead.live === true,
  }
}

/** Uploads (newest first) as broadcasts, newest first, parts in order. */
function broadcasts(videos: VideoLite[], seriesById: Map<string, SeriesLite>): TvVideoView[] {
  const sorted = [...videos].filter((video) => video.status !== 'gone').sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt))
  return groupParts(sorted).map((group) => videoView(group, seriesById))
}

function seriesView(series: SeriesLite, latest: TvVideoView | null): TvSeriesView {
  return {
    id: series._id,
    channel: series.channelId,
    title: series.title,
    titleAlt: series.titleAlt,
    kind: series.kind,
    episodeCount: series.episodeCount,
    firstAt: new Date(series.firstAt).toISOString(),
    lastAt: new Date(series.lastAt).toISOString(),
    coverId: series.coverId,
    coverMaxres: series.coverMaxres,
    color: series.color,
    cadence: series.cadence,
    ramadan: series.ramadan,
    complete: series.complete,
    description: series.description,
    latest,
  }
}

const visibleSeries = (series: SeriesLite) => !series.hidden && series.kind !== 'clips'

// ---------------------------------------------------------------------------------------------
// Loading: the database, or the live feeds when it is empty

type Loaded = { channels: ChannelLite[], series: SeriesLite[], videos: VideoLite[], updatedAt: string | null, bootstrap: boolean }

async function loadFromDb(o: { channel?: string, since?: Date, limit: number }): Promise<Loaded | null> {
  const db = await ttv()
  const enabled = enabledChannels().map((def) => def.slug)
  const channelFilter = o.channel ? [o.channel] : enabled
  const [channels, series, videos, state] = await Promise.all([
    db.channels.find({ _id: { $in: channelFilter }, disabled: { $ne: true } }, { projection: { avatarData: 0, playlists: 0 } }).toArray(),
    db.series.find({ channelId: { $in: channelFilter }, hidden: false }).toArray(),
    db.videos.find(
      { channelId: { $in: channelFilter }, status: { $ne: 'gone' }, ...(o.since ? { publishedAt: { $gte: o.since } } : {}) },
      { projection: VIDEO_FIELDS },
    ).sort({ publishedAt: -1 }).limit(o.limit).toArray(),
    db.meta.findOne({ _id: 'state' }),
  ])
  if (videos.length === 0 && !o.channel) return null
  const withAvatar = await db.channels.find({ _id: { $in: channelFilter }, avatarData: { $exists: true, $ne: null } }, { projection: { _id: 1 } }).toArray()
  const hasAvatar = new Set(withAvatar.map((doc) => doc._id))
  return {
    channels: channels.map((doc) => ({ ...doc, hasAvatar: hasAvatar.has(doc._id) })),
    series,
    videos,
    updatedAt: iso(state?.lastRunAt),
    bootstrap: false,
  }
}

const channelFromDef = (def: TvChannelDef, now: Date): ChannelLite => ({
  _id: def.slug, slug: def.slug, name: def.name, nameAr: def.nameAr, handle: def.handle, youtubeId: def.youtubeId, kind: def.kind, avatar: null,
  color: def.color, status: 'active', lastUploadAt: null, weekCount: 0, feedReadAt: null, feedOkAt: null, feedFailures: 0, live: null, updatedAt: now, hasAvatar: false,
})

/** Nothing stored yet: the channels' uploads feeds, read now (3 seconds for all of them). */
async function loadFromFeeds(defs: TvChannelDef[]): Promise<Loaded> {
  const now = new Date()
  const deadline = Date.now() + BOOTSTRAP_MS
  const reads = await withTimeout(Promise.all(defs.map((def) => fetchFeed({ playlist: uploadsPlaylist(def.youtubeId) }, deadline))), BOOTSTRAP_MS + 200, [])
  const channels: ChannelLite[] = []
  const series: SeriesLite[] = []
  const videos: VideoLite[] = []
  defs.forEach((def, index) => {
    const read = reads[index]
    const channel = channelFromDef(def, now)
    channels.push(channel)
    if (!read?.ok || read.feed.channelId !== def.youtubeId) return
    const mine = read.feed.entries.filter((entry) => !entry.isShort)
    const docs = mine.map((entry) => {
      const info = parseEpisodeTitle(entry.title)
      return {
        _id: entry.id, channelId: def.slug, seriesId: null as string | null, playlistIds: [] as string[], title: entry.title,
        description: cleanDescription(entry.description, { title: entry.title }) || null, publishedAt: new Date(entry.publishedAt), views: entry.views,
        duration: null, episode: info.episode, part: info.part, season: info.season, date: info.date, subtitle: info.subtitle, clip: info.clip, live: false,
        status: 'new' as const, seriesName: info.series, seriesNameAlt: info.seriesAlt,
      }
    })
    if (docs.length) {
      channel.lastUploadAt = docs[0].publishedAt
      channel.weekCount = docs.filter((doc) => now.getTime() - doc.publishedAt.getTime() < 7 * DAY).length
    }
    const derived = deriveChannel({ channel: def.slug, kind: def.kind, videos: docs, existing: [], now })
    for (const doc of docs) doc.seriesId = derived.assign.get(doc._id) ?? null
    videos.push(...docs)
    series.push(...derived.series.map((item) => ({ ...item, updatedAt: now })).filter(visibleSeries))
  })
  return { channels, series, videos, updatedAt: null, bootstrap: true }
}

async function load(o: { channel?: string, since?: Date, limit: number }): Promise<Loaded> {
  const defs = o.channel ? enabledChannels().filter((def) => def.slug === o.channel) : enabledChannels()
  if (defs.length === 0) return { channels: [], series: [], videos: [], updatedAt: null, bootstrap: false }
  let stored: Loaded | null = null
  try {
    stored = await loadFromDb(o)
  } catch (error) {
    console.error('tunisian-tv: reading the database failed', error)
  }
  if (stored) return stored
  try {
    return await loadFromFeeds(defs)
  } catch (error) {
    console.error('tunisian-tv: reading the feeds failed', error)
    return { channels: defs.map((def) => channelFromDef(def, new Date())), series: [], videos: [], updatedAt: null, bootstrap: true }
  }
}

// ---------------------------------------------------------------------------------------------
// The hub

const EMPTY_HUB: TvHub = {
  channels: [], hero: null, heroEpisodes: [], live: [], newEpisodes: [], ramadan: null, onAir: [], mostWatched: [], talk: [], complete: [],
  fresh: null, updatedAt: null, bootstrap: false,
}

/** The Ramadan the hub shows: this one while it runs, else the latest one the channels made series for. */
function ramadanTarget(series: SeriesLite[], now: Date) {
  const status = ramadanStatus(now)
  if (status.phase === 'during') return { hijriYear: status.hijriYear, year: status.year, during: true }
  const latest = Math.max(0, ...series.map((item) => item.ramadan ?? 0))
  if (!latest) return null
  return { hijriYear: latest, year: Number(ramadanOf(latest).start.slice(0, 4)), during: false }
}

async function buildHub(): Promise<TvHub> {
  const now = new Date()
  const data = await load({ since: new Date(now.getTime() - 120 * DAY), limit: 1500 })
  if (data.channels.length === 0) return EMPTY_HUB
  const seriesById = new Map(data.series.map((item) => [item._id, item]))
  const channels = data.channels.map(channelView)
  const all = broadcasts(data.videos, seriesById)
  const bySeries = new Map<string, TvVideoView[]>()
  for (const video of all) if (video.seriesId) bySeries.set(video.seriesId, [...(bySeries.get(video.seriesId) ?? []), video])
  const latestOf = (series: SeriesLite) => bySeries.get(series._id)?.[0] ?? null
  const view = (series: SeriesLite) => seriesView(series, latestOf(series))
  const age = (at: string | Date) => now.getTime() - new Date(at).getTime()
  const shown = data.series.filter((item) => visibleSeries(item) && bySeries.has(item._id))

  const live: TvVideoView[] = channels.filter((channel) => channel.live).map((channel) => ({
    id: channel.live!.videoId, title: channel.live!.title, subtitle: null, channel: channel.slug, seriesId: null, seriesTitle: null, seriesTitleAlt: null,
    episode: null, season: null, parts: [{ id: channel.live!.videoId, part: null, blocked: false }], publishedAt: now.toISOString(), views: null, duration: null,
    blocked: false, live: true,
  }))

  const seriesEpisodes = all.filter((video) => video.seriesId && seriesById.has(video.seriesId) && visibleSeries(seriesById.get(video.seriesId)!) && !video.live)
  const firstPerSeries = (videos: TvVideoView[]) => {
    const seen = new Set<string>()
    return videos.filter((video) => {
      if (!video.seriesId || seen.has(video.seriesId)) return false
      seen.add(video.seriesId)
      return true
    })
  }
  const newEpisodes = firstPerSeries(seriesEpisodes.filter((video) => age(video.publishedAt) < 7 * DAY)).slice(0, 20)

  const target = ramadanTarget(data.series, now)
  const ramadanSeries = target ? shown.filter((item) => item.ramadan === target.hijriYear).sort((a, b) => +b.lastAt - +a.lastAt) : []

  const onAir = shown.filter((item) => item.kind === 'drama' && age(item.lastAt) < 10 * DAY).sort((a, b) => +b.lastAt - +a.lastAt).slice(0, 16)
  const talk = shown.filter((item) => item.kind === 'show' && age(item.lastAt) < 14 * DAY).sort((a, b) => +b.lastAt - +a.lastAt).slice(0, 16)
  const complete = shown.filter((item) => item.complete && item.kind === 'drama').sort((a, b) => +b.lastAt - +a.lastAt).slice(0, 16)

  const clips = new Set(data.videos.filter((video) => video.clip).map((video) => video._id))
  const mostWatched = all
    .filter((video) => !video.live && age(video.publishedAt) < 7 * DAY && (video.views ?? 0) > 0)
    .filter((video) => {
      const series = video.seriesId ? seriesById.get(video.seriesId) : undefined
      return !series || visibleSeries(series)
    })
    .filter((video) => !clips.has(video.id))
    .sort((a, b) => (b.views ?? 0) - (a.views ?? 0))
    .slice(0, 16)

  // The hero: the Ramadan drama during Ramadan, else the newest drama episode within 36 hours,
  // else the most recently updated series on air.
  const freshDrama = seriesEpisodes.find((video) => seriesById.get(video.seriesId!)?.kind === 'drama' && age(video.publishedAt) < 36 * 3_600_000)
  const heroSeries = (target?.during ? ramadanSeries.find((item) => item.kind === 'drama') : undefined)
    ?? (freshDrama ? seriesById.get(freshDrama.seriesId!) : undefined)
    ?? onAir[0]
    ?? shown.filter((item) => age(item.lastAt) < 14 * DAY).sort((a, b) => +b.lastAt - +a.lastAt)[0]
  const heroEpisodes = heroSeries ? [...(bySeries.get(heroSeries._id) ?? [])].reverse() : []

  return {
    channels,
    hero: heroSeries ? view(heroSeries) : null,
    heroEpisodes,
    live,
    newEpisodes,
    ramadan: target && ramadanSeries.length ? { ...target, series: ramadanSeries.map(view) } : null,
    onAir: onAir.map(view),
    mostWatched,
    talk: talk.map(view),
    complete: complete.map(view),
    fresh: freshDrama ? { seriesTitle: freshDrama.seriesTitle ?? freshDrama.title, seriesTitleAlt: freshDrama.seriesTitleAlt, episode: freshDrama.episode } : null,
    updatedAt: data.updatedAt,
    bootstrap: data.bootstrap,
  }
}

const cachedHub = unstable_cache(buildHub, ['ttv-hub', 'v1'], { revalidate: REVALIDATE, tags: TAGS })

/** Everything /tunisian/tv shows (and the /tunisian door, the home shelf tile). Never throws. */
export async function getTvHub(): Promise<TvHub> {
  try {
    return await cachedHub()
  } catch (error) {
    console.error('tunisian-tv: the hub failed', error)
    return EMPTY_HUB
  }
}

// ---------------------------------------------------------------------------------------------
// A channel

async function buildChannel(slug: string): Promise<TvChannelPage | null> {
  const def = channelBySlug(slug)
  if (!def) return null
  const data = await load({ channel: slug, limit: 600 })
  const doc = data.channels.find((channel) => channel.slug === slug) ?? channelFromDef(def, new Date())
  const seriesById = new Map(data.series.map((item) => [item._id, item]))
  const all = broadcasts(data.videos, seriesById)
  const bySeries = new Map<string, TvVideoView[]>()
  for (const video of all) if (video.seriesId) bySeries.set(video.seriesId, [...(bySeries.get(video.seriesId) ?? []), video])
  const sections = data.series
    .filter((item) => visibleSeries(item) && (bySeries.get(item._id)?.length ?? 0) > 0)
    .sort((a, b) => +new Date(b.lastAt) - +new Date(a.lastAt))
    .map((item) => ({ series: seriesView(item, bySeries.get(item._id)![0]), episodes: bySeries.get(item._id)! }))
  const clips = new Set(data.videos.filter((video) => video.clip).map((video) => video._id))
  return {
    channel: channelView(doc),
    series: sections.filter((section) => section.series.kind === 'drama'),
    shows: sections.filter((section) => section.series.kind !== 'drama'),
    latest: all.filter((video) => !clips.has(video.id) && !video.live).slice(0, 24),
    updatedAt: data.updatedAt,
  }
}

const cachedChannel = unstable_cache(buildChannel, ['ttv-channel', 'v1'], { revalidate: REVALIDATE, tags: TAGS })

/** A channel's page, or null when the slug is no enabled channel. Never throws. */
export async function getTvChannel(slug: string): Promise<TvChannelPage | null> {
  const def = channelBySlug(slug)
  if (!def) return null
  try {
    return await cachedChannel(def.slug)
  } catch (error) {
    console.error('tunisian-tv: the channel page failed', error)
    return { channel: channelView(channelFromDef(def, new Date())), series: [], shows: [], latest: [], updatedAt: null }
  }
}

/** One stored video of a channel (for ?v= links to videos the page doesn't list). */
export async function getTvVideo(slug: string, id: string): Promise<TvVideoView | null> {
  try {
    const db = await ttv()
    const video = await db.videos.findOne({ _id: id, channelId: slug, status: { $ne: 'gone' } }, { projection: VIDEO_FIELDS })
    if (!video) return null
    const series = video.seriesId ? await db.series.findOne({ _id: video.seriesId }) : null
    return videoView([video], new Map(series ? [[series._id, series]] : []))
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------------------------
// Elsewhere on the site

/** The Ramadan rows on /ramadan: this Ramadan's series while it runs, else the latest one's. */
export async function getRamadanTv(): Promise<TvHub['ramadan']> {
  return (await getTvHub()).ramadan
}

/** The newest episodes of the series on air (the digest, other surfaces). */
export async function getLatestTvEpisodes(limit = 12): Promise<TvVideoView[]> {
  return (await getTvHub()).newEpisodes.slice(0, limit)
}

/** The home "Beyond Hollywood" tile: a live dot when a channel is on air, and the hero's cover. */
export async function getTunisianTvShelfTile(): Promise<{ live: boolean, picture: string | null }> {
  const hub = await getTvHub()
  const cover = hub.hero?.coverId ?? hub.newEpisodes[0]?.id ?? null
  return {
    live: hub.live.length > 0,
    picture: cover ? youtubeThumb(cover, hub.hero?.coverId && hub.hero.coverMaxres ? 'maxres' : 'hq') : null,
  }
}

/** The hub and the channels that have something to show. */
export async function tunisianTvSitemap(): Promise<{ path: string, priority: number }[]> {
  const hub = await getTvHub()
  if (hub.channels.length === 0) return []
  return [
    { path: '/tunisian/tv', priority: 0.7 },
    ...hub.channels.filter((channel) => channel.lastUploadAt && channel.status !== 'unreachable').map((channel) => ({ path: `/tunisian/tv/${channel.slug}`, priority: 0.5 })),
  ]
}

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Series whose name contains `query` (either script), most recent first. Never throws. */
export async function searchTvSeries(query: string, limit = 8): Promise<TvSeriesView[]> {
  const text = (query ?? '').trim().slice(0, 60)
  if (text.length < 2) return []
  try {
    const db = await ttv()
    const pattern = new RegExp(escapeRegex(text), 'i')
    const found = await db.series.find({
      hidden: false, kind: { $ne: 'clips' }, channelId: { $in: enabledChannels().map((def) => def.slug) }, $or: [{ title: pattern }, { titleAlt: pattern }],
    }).sort({ lastAt: -1 }).limit(Math.min(20, limit)).toArray()
    return found.map((item) => seriesView(item, null))
  } catch {
    return []
  }
}

