import { JSDOM } from 'jsdom'
import { tmdbFetchSafe } from '@/src/lib/tmdb'
import { matchTvSeries, partOf } from '@/src/lib/tunisian-match'
import type { TvDramaEntry, TvEpisode } from '@/src/lib/tunisian-tv/read'

// The Tunisian catalogue comes from the source site's public Blogger JSON feed. Unlike scraping
// its HTML, the feed has a stable, documented shape, so a redesign of the site's pages won't break it.
//
// The films and episodes themselves are videos the source embeds (mostly YouTube; some video files
// behind iframely, some VK Video): they're read here so they play on TunisiaFlicks, in the video
// dialog, and only titles with something to watch are listed (the source keeps "put the link here"
// placeholders for what isn't out yet). The last good feed is kept in the database, so the
// catalogue stays up when the source is slow or down.
//
// A series the source never added episodes to plays its official uploads instead, when Tunisian TV
// (lib/tunisian-tv) holds the same series (lib/tunisian-match: confident matches only).
const SOURCE = new URL('https://www.tunigazelle-news.xyz')
const FEED_URL = `${SOURCE.origin}/feeds/posts/default?alt=json&max-results=200`
const REVALIDATE = 1800
/** An episode's page (and its video) changes rarely. */
const EPISODE_REVALIDATE = 86400
const FETCH_TIMEOUT_MS = 10_000

export type TunisianKind = 'movie' | 'series'

export type TunisianTitle = {
  /** Route segment of the post, e.g. `2026/09/last-chance` (the blog path without `.html`). */
  slug: string
  title: string
  kind: TunisianKind
  poster: string | null
  /** The post on the source site. */
  url: string
  published: string
}

/** What plays: a YouTube video, a video file (browser's own player), or VK Video's player. */
export type TunisianMedia = { type: 'youtube', id: string } | { type: 'file', url: string } | { type: 'embed', url: string }

/** `media`: what the episode plays (null when its page couldn't be read: it then opens on the source). */
export type TunisianEpisode = { label: string, url: string, media?: TunisianMedia | null }
export type TunisianSeason = { season: number, episodes: TunisianEpisode[] }

export type TunisianDetail = TunisianTitle & {
  description: string
  badges: string[]
  backdrop: string | null
  seasons: TunisianSeason[]
  /** What a film plays (null: nothing to watch yet). */
  media: TunisianMedia | null
  /** The film on TMDB (matched by title + Tunisian origin): the full film plays through the normal
   *  movie sources (third-party players + the download/torrent player). `media` is then its trailer. */
  tmdb: { id: string, imdb: string | null } | null
  /** The series' episodes are its official uploads, from this Tunisian TV series. */
  tv: { channel: string, seriesId: string } | null
}

type FeedEntry = {
  title: { $t: string }
  published: { $t: string }
  link: { rel: string, href: string }[]
  category?: { term: string }[]
  content?: { $t: string }
  media$thumbnail?: { url: string }
}

// Only ever link to / parse pages of the source site.
export function toSourceUrl(href: string | null | undefined): string | null {
  // Must look like a real link (absolute, or a path on the site): the source's unfinished
  // episodes carry text placeholders in `href`, which `new URL` would happily resolve as a path.
  if (!href || !/^(https?:\/\/|\/)/.test(href)) return null
  try {
    const url = new URL(href, SOURCE)
    return url.host === SOURCE.host && /^https?:$/.test(url.protocol) ? url.toString() : null
  } catch {
    return null
  }
}

/** The first YouTube video a page embeds or links to (its id), or null. */
export function youtubeIdIn(html: string | null | undefined): string | null {
  const match = /(?:youtube(?:-nocookie)?\.com\/(?:embed\/|watch\?v=|shorts\/)|youtu\.be\/)([\w-]{11})(?![\w-])/.exec(html ?? '')
  return match ? match[1] : null
}

/** Episode links that are real (the source fills unfinished ones with placeholder text). */
export function episodeLinks(html: string): string[] {
  const links: string[] = []
  for (const anchor of html.matchAll(/<a\b[^>]*>/gi)) {
    const tag = anchor[0]
    if (!/class=["'][^"']*\bepisode-item\b/i.test(tag)) continue
    const url = toSourceUrl(/href=["']([^"']*)["']/i.exec(tag)?.[1])
    if (url) links.push(url)
  }
  return links
}

/** Players the source uses besides YouTube, whose embeds are safe to show as they are. */
const EMBED_HOSTS = /^(?:www\.)?(?:vkvideo\.ru|vk\.com|vk\.ru)$/
const IFRAMELY = /^(?:www\.)?iframely\.net$/

/**
 * The player a page embeds: YouTube (by id), VK Video (its embed), or an iframely link (a video file
 * behind it, read by resolveMedia). Repairs the source's typos ("ttps://"). Null: nothing playable.
 */
export function playerIn(html: string | null | undefined): TunisianMedia | { type: 'iframely', url: string } | null {
  const youtube = youtubeIdIn(html)
  if (youtube) return { type: 'youtube', id: youtube }
  for (const match of (html ?? '').matchAll(/<iframe\b[^>]*\bsrc=["']([^"']+)["']/gi)) {
    const raw = match[1].trim().replace(/&amp;/g, '&').replace(/^ttps:\/\//i, 'https://').replace(/^\/\//, 'https://')
    let url: URL
    try { url = new URL(raw) } catch { continue }
    if (!/^https?:$/.test(url.protocol)) continue
    url.protocol = 'https:'
    if (EMBED_HOSTS.test(url.hostname) && url.pathname === '/video_ext.php') return { type: 'embed', url: url.toString() }
    if (IFRAMELY.test(url.hostname)) return { type: 'iframely', url: url.toString() }
  }
  return null
}

/** Whether a post has something to watch: a film's player, or at least one real episode. */
export function isPlayable(kind: TunisianKind, html: string): boolean {
  return kind === 'movie' ? playerIn(html) !== null : episodeLinks(html).length > 0
}

/** The video file an iframely page plays (its canonical https .mp4), cached a day. */
async function iframelyFile(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { next: { revalidate: EPISODE_REVALIDATE }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
    if (!res.ok) return null
    const canonical = /<meta\s+name=["']canonical["']\s+content=["']([^"']+)["']/i.exec(await res.text())?.[1]?.replace(/&amp;/g, '&')
    return canonical && /^https:\/\/[^\s"'<>]+\.mp4(?:\?[^\s"'<>]*)?$/i.test(canonical) ? canonical : null
  } catch {
    return null
  }
}

/** A page's player as something the dialog can play (iframely links resolved to their file). */
async function resolveMedia(html: string | null | undefined): Promise<TunisianMedia | null> {
  const player = playerIn(html)
  if (!player) return null
  if (player.type !== 'iframely') return player
  const file = await iframelyFile(player.url)
  return file ? { type: 'file', url: file } : null
}

// Blogger image URLs carry their size in the path (`/s72-c/`, `/s1600/`): ask for a card-sized one.
const resizePoster = (url: string | null | undefined, size = 400) =>
  url ? url.replace(/\/s\d+(-c)?\//, `/s${size}/`) : null

const slugOf = (url: string) => {
  const match = new URL(url).pathname.match(/^\/(\d{4})\/(\d{2})\/([^/]+)\.html$/)
  return match ? `${match[1]}/${match[2]}/${match[3]}` : null
}

function toTitle(entry: FeedEntry): TunisianTitle | null {
  const categories = (entry.category ?? []).map((category) => category.term)
  const kind: TunisianKind | null = categories.includes('series') ? 'series' : categories.includes('movie') ? 'movie' : null
  const url = toSourceUrl(entry.link.find((link) => link.rel === 'alternate')?.href)
  const slug = url ? slugOf(url) : null
  if (!kind || !url || !slug) return null // matches, pages and anything else that isn't a title

  return {
    slug,
    title: entry.title.$t.trim(),
    kind,
    poster: resizePoster(entry.media$thumbnail?.url),
    url,
    published: entry.published.$t,
  }
}

// ---- the feed, and the last good copy of it ----------------------------------------------------

type Snapshot = { _id: string, entries: FeedEntry[], signature: string, savedAt: Date }

/** Changes whenever a post is added, removed or edited. */
const signatureOf = (entries: FeedEntry[]) =>
  `${entries.length}:${entries.map((entry) => `${entry.published.$t}|${entry.title.$t}|${(entry.content?.$t ?? '').length}`).join(',')}`

async function snapshots() {
  const { default: clientPromise } = await import('@/src/lib/mongodb')
  return (await clientPromise).db().collection<Snapshot>('tunisianFeed')
}

/** Keeps a good feed for the days the source is down (only when it changed: it's ~300 kB). */
async function saveSnapshot(entries: FeedEntry[]) {
  try {
    const signature = signatureOf(entries)
    const col = await snapshots()
    const saved = await col.findOne({ _id: 'feed' }, { projection: { signature: 1 } })
    if (saved?.signature !== signature) await col.updateOne({ _id: 'feed' }, { $set: { entries, signature, savedAt: new Date() } }, { upsert: true })
  } catch (error) {
    console.error('Tunisian feed: saving the copy failed', error)
  }
}

async function readSnapshot(): Promise<FeedEntry[] | null> {
  try {
    return (await (await snapshots()).findOne({ _id: 'feed' }))?.entries ?? null
  } catch {
    return null
  }
}

/** The feed's posts: from the source (cached half an hour), else the last good copy. */
async function fetchEntries(): Promise<FeedEntry[] | null> {
  try {
    const res = await fetch(FEED_URL, { next: { revalidate: REVALIDATE }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
    if (!res.ok) throw new Error(`Source feed responded with ${res.status}`)
    const json = await res.json()
    const entries: FeedEntry[] = Array.isArray(json?.feed?.entry) ? json.feed.entry : []
    if (entries.length > 0) {
      void saveSnapshot(entries)
      return entries
    }
    return (await readSnapshot()) ?? entries
  } catch (error) {
    console.error('Error loading the Tunisian feed (using the last good copy):', error)
    return readSnapshot()
  }
}

/** All series and movies with something to watch, newest first. `null` when the source can't be reached. */
export async function getTunisianTitles(): Promise<TunisianTitle[] | null> {
  const entries = await fetchEntries()
  if (!entries) return null
  const titles = entries.flatMap((entry) => {
    const title = toTitle(entry)
    return title ? [{ title, playable: isPlayable(title.kind, entry.content?.$t ?? '') }] : []
  })
  // A series without episodes on the source is listed when Tunisian TV has it.
  const onTv = titles.some((item) => !item.playable && item.title.kind === 'series') ? await tvMatcher() : null
  return titles.filter((item) => item.playable || (item.title.kind === 'series' && onTv?.(item.title.title))).map((item) => item.title)
}

// ---- series the source has no episodes of: their official uploads ------------------------------

/** Finds a series' official one on Tunisian TV; finds nothing when Tunisian TV can't be read. */
async function tvMatcher(): Promise<(name: string) => TvDramaEntry | null> {
  try {
    const { getTvDramaIndex } = await import('@/src/lib/tunisian-tv/read')
    const index = await getTvDramaIndex()
    return (name) => matchTvSeries(name, index)
  } catch (error) {
    console.error('Tunisian: reading Tunisian TV failed', error)
    return () => null
  }
}

type TvUpload = Pick<TvEpisode, '_id' | 'title' | 'episode' | 'part' | 'season' | 'subtitle' | 'publishedAt'>

/**
 * A series' uploads as seasons of episodes that play in the video dialog: by season (unnumbered:
 * 1), in episode and part order, each episode and part once (the latest upload of it).
 */
export function tvSeasons(uploads: TvUpload[]): TunisianSeason[] {
  const latest = new Map<string, TvUpload>()
  for (const upload of uploads) {
    const key = upload.episode === null ? upload._id : `${upload.season ?? 1}:${upload.episode}:${upload.part ?? 0}`
    const seen = latest.get(key)
    if (!seen || seen.publishedAt < upload.publishedAt) latest.set(key, upload)
  }
  const bySeason = new Map<number, TvUpload[]>()
  for (const upload of Array.from(latest.values())) bySeason.set(upload.season ?? 1, [...(bySeason.get(upload.season ?? 1) ?? []), upload])
  return Array.from(bySeason.entries())
    .sort(([a], [b]) => a - b)
    .map(([season, items]) => ({
      season,
      episodes: items
        .sort((a, b) => (a.episode ?? Infinity) - (b.episode ?? Infinity) || (a.part ?? 0) - (b.part ?? 0) || a.publishedAt.localeCompare(b.publishedAt))
        .map((upload) => ({
          // Labelled like the source's episodes.
          label: upload.episode === null ? upload.subtitle ?? upload.title : `الحلقة ${upload.episode}${upload.part ? ` · الجزء ${upload.part}` : ''}`,
          url: `https://www.youtube.com/watch?v=${upload._id}`,
          media: { type: 'youtube', id: upload._id },
        })),
    }))
}

/** A series' episodes from its official series on Tunisian TV (only the part its name asks for). */
async function tvEpisodes(name: string): Promise<{ seasons: TunisianSeason[], tv: TunisianDetail['tv'] } | null> {
  const series = (await tvMatcher())(name)
  if (!series) return null
  try {
    const { getTvSeriesEpisodes } = await import('@/src/lib/tunisian-tv/read')
    const part = partOf(name)
    const seasons = tvSeasons((await getTvSeriesEpisodes(series.id)).filter((upload) => part === null || (upload.season ?? 1) === part))
    return seasons.length > 0 ? { seasons, tv: { channel: series.channel, seriesId: series.id } } : null
  } catch (error) {
    console.error('Tunisian: reading a Tunisian TV series failed', error)
    return null
  }
}

// ---- episodes ----------------------------------------------------------------------------------

/** What an episode page plays (cached a day); null when the page can't be read. */
async function episodeMedia(url: string): Promise<TunisianMedia | null> {
  try {
    const res = await fetch(url, { next: { revalidate: EPISODE_REVALIDATE }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
    if (!res.ok) return null
    return await resolveMedia(await res.text())
  } catch {
    return null
  }
}

/** Reads what every episode plays, a few pages at a time (the source is a small blog). */
async function withMedia(seasons: TunisianSeason[]): Promise<TunisianSeason[]> {
  const urls = Array.from(new Set(seasons.flatMap((season) => season.episodes.map((episode) => episode.url))))
  const media = new Map<string, TunisianMedia | null>()
  let next = 0
  await Promise.all(Array.from({ length: Math.min(6, urls.length) }, async () => {
    while (next < urls.length) {
      const url = urls[next++]
      media.set(url, await episodeMedia(url))
    }
  }))
  return seasons.map((season) => ({ ...season, episodes: season.episodes.map((episode) => ({ ...episode, media: media.get(episode.url) ?? null })) }))
}

// ---- matching a film to TMDB (so the full film plays through the normal movie sources) ----------

type TmdbMatch = { id: string, imdb: string | null }
type TmdbCache = { _id: string, match: TmdbMatch | null, at: Date }
/** A film with no match is tried again after this long (it may be added to TMDB later). */
const TMDB_RETRY_MS = 14 * 86400_000

/** A title cleaned to its Latin words (drops Arabic, "film", "complet"...), for a TMDB search. */
function latinQuery(title: string): string {
  return title.replace(/[؀-ۿ]+/g, ' ').replace(/\b(film|movie|complet|complete|kamel|full|hd|le|la)\b/gi, ' ')
    .replace(/[–\-|:()[\]]/g, ' ').replace(/\s+/g, ' ').trim()
}
/** A title cleaned to its Arabic words (drops "watch", "film", "full"...). */
function arabicQuery(title: string): string {
  const arabic = (title.match(/[؀-ۿ]+/g) ?? []).join(' ')
  return arabic.replace(/(?:مشاهدة|فيلم|كامل|تونسي)/g, ' ').replace(/\s+/g, ' ').trim()
}

/** A TMDB movie search whose hit is Tunisian (origin or production country TN). Null when none is. */
async function searchTunisianMovie(query: string): Promise<TmdbMatch | null> {
  if (query.length < 2) return null
  const results = (await tmdbFetchSafe<{ results?: { id: number }[] }>('search/movie', { query, include_adult: false }, 86400, { shared: true }))?.results ?? []
  for (const hit of results.slice(0, 8)) {
    const movie = await tmdbFetchSafe<{ id: number, imdb_id?: string | null, origin_country?: string[], production_countries?: { iso_3166_1: string }[], external_ids?: { imdb_id?: string | null } }>(
      `movie/${hit.id}`, { append_to_response: 'external_ids' }, 604800, { shared: true })
    if (!movie) continue
    const countries = [...(movie.origin_country ?? []), ...(movie.production_countries ?? []).map((c) => c.iso_3166_1)]
    if (countries.includes('TN')) return { id: String(movie.id), imdb: movie.imdb_id || movie.external_ids?.imdb_id || null }
  }
  return null
}

async function tmdbCacheCollection() {
  const { default: clientPromise } = await import('@/src/lib/mongodb')
  return (await clientPromise).db().collection<TmdbCache>('tunisianTmdb')
}

/** The film's TMDB match, found once and remembered (misses retried after TMDB_RETRY_MS). */
async function matchFilmToTmdb(slug: string, title: string): Promise<TmdbMatch | null> {
  try {
    const col = await tmdbCacheCollection()
    const cached = await col.findOne({ _id: slug })
    if (cached && (cached.match || Date.now() - new Date(cached.at).getTime() < TMDB_RETRY_MS)) return cached.match
    const match = (await searchTunisianMovie(latinQuery(title))) ?? (await searchTunisianMovie(arabicQuery(title)))
    await col.updateOne({ _id: slug }, { $set: { match, at: new Date() } }, { upsert: true })
    return match
  } catch {
    // No database (or TMDB down): fall back to the blog clip; the match is tried again next time.
    return null
  }
}

/** One title with its description and, for series, its seasons and episodes. */
export async function getTunisianDetail(slug: string): Promise<TunisianDetail | null | undefined> {
  const entries = await fetchEntries()
  if (!entries) return undefined // source unavailable (as opposed to "no such title")

  const entry = entries.find((item) => {
    const title = toTitle(item)
    return title?.slug === slug
  })
  const base = entry && toTitle(entry)
  if (!entry || !base) return null

  const document = new JSDOM(`<body>${entry.content?.$t ?? ''}</body>`).window.document

  const backdropStyle = document.querySelector('.detail-hero-backdrop')?.getAttribute('style') ?? ''
  const seasons: TunisianSeason[] = []
  document.querySelectorAll('.season-grid').forEach((grid, index) => {
    const episodes: TunisianEpisode[] = []
    grid.querySelectorAll('a.episode-item').forEach((anchor) => {
      const url = toSourceUrl(anchor.getAttribute('href'))
      // The source site leaves "put the link here" placeholders for episodes that aren't out yet.
      if (url) episodes.push({ label: anchor.textContent?.trim() || `Episode ${episodes.length + 1}`, url })
    })
    if (episodes.length > 0) {
      seasons.push({ season: Number(grid.getAttribute('data-season')) || index + 1, episodes })
    }
  })

  const badges: string[] = []
  document.querySelectorAll('.detail-badge').forEach((badge) => {
    const text = badge.textContent?.trim()
    if (text) badges.push(text)
  })

  const tv = base.kind === 'series' && seasons.length === 0 ? await tvEpisodes(base.title) : null

  return {
    ...base,
    poster: resizePoster(document.querySelector('.detail-poster img')?.getAttribute('src') ?? base.poster, 600),
    description: document.querySelector('.detail-description')?.textContent?.trim() ?? '',
    badges,
    backdrop: resizePoster(backdropStyle.match(/url\(['"]?([^'")]+)/)?.[1], 1280),
    seasons: tv ? tv.seasons : base.kind === 'series' ? await withMedia(seasons) : seasons,
    media: base.kind === 'movie' ? await resolveMedia(document.querySelector('.player-container, .player-wrapper')?.innerHTML ?? entry.content?.$t) : null,
    tmdb: base.kind === 'movie' ? await matchFilmToTmdb(base.slug, base.title) : null,
    tv: tv?.tv ?? null,
  }
}
