// Every request Tunisian TV makes, server side only: YouTube's free feeds, oEmbed (can this video
// be embedded?), the optional Data API (YOUTUBE_API_KEY, a soft cap of 3,000 units a day), cover
// checks and picture colours. Fixed hosts, ids checked before they reach a URL, 8 seconds at most
// per request, and no scraping: only documented, public endpoints.
import 'server-only'
import { dominantColor } from '@/src/lib/ambient'
import { isYouTubeChannelId, isYouTubeId } from '@/src/lib/youtube'
import { parseFeed, type ParsedFeed } from './parse'
import type { TtvCollections } from './db'

export const FETCH_TIMEOUT_MS = 8000
export const API_DAILY_UNITS = 3000

const PLAYLIST_ID = /^(?:PL|UU|UULF|UULV)[A-Za-z0-9_-]{10,40}$/
const AVATAR_HOST = /^https:\/\/yt3\.(?:ggpht|googleusercontent)\.com\//

const signal = (deadline?: number) => AbortSignal.timeout(Math.max(500, Math.min(FETCH_TIMEOUT_MS, (deadline ?? Infinity) - Date.now())))

export type FeedResult = { ok: true, status: 200, feed: ParsedFeed } | { ok: false, status: number, feed?: undefined }

/**
 * One Atom feed: `{ playlist: 'UULF…' | 'PL…' }` or `{ channel: 'UC…' }`. YouTube's feeds fail
 * often (an HTML 404 or 500 that a retry fixes), so a failure is `{ ok: false, status }`, never
 * an exception.
 */
export async function fetchFeed(source: { playlist: string } | { channel: string }, deadline?: number): Promise<FeedResult> {
  let query: string
  if ('playlist' in source) {
    if (!PLAYLIST_ID.test(source.playlist)) return { ok: false, status: 400 }
    query = `playlist_id=${source.playlist}`
  } else {
    if (!isYouTubeChannelId(source.channel)) return { ok: false, status: 400 }
    query = `channel_id=${source.channel}`
  }
  try {
    const response = await fetch(`https://www.youtube.com/feeds/videos.xml?${query}`, { cache: 'no-store', signal: signal(deadline) })
    if (!response.ok) {
      await response.body?.cancel().catch(() => {})
      return { ok: false, status: response.status }
    }
    const feed = parseFeed(await response.text())
    return feed ? { ok: true, status: 200, feed } : { ok: false, status: 502 }
  } catch {
    return { ok: false, status: 0 }
  }
}

/** A feed, tried twice (the second try often works where the first got YouTube's error page). */
export async function fetchFeedWithRetry(source: { playlist: string } | { channel: string }, deadline: number): Promise<FeedResult> {
  const first = await fetchFeed(source, deadline)
  if (first.ok || first.status === 400 || deadline - Date.now() < 3000) return first
  return fetchFeed(source, deadline)
}

export type EmbedStatus = 'ok' | 'blocked' | 'gone' | 'unknown'

/** oEmbed: 200 embeddable, 401/403 the owner blocks embedding, 400/404 removed or private. */
export async function oembedStatus(videoId: string, deadline?: number): Promise<EmbedStatus> {
  if (!isYouTubeId(videoId)) return 'gone'
  try {
    const url = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}`
    const response = await fetch(url, { cache: 'no-store', signal: signal(deadline) })
    await response.body?.cancel().catch(() => {})
    if (response.status === 200) return 'ok'
    if (response.status === 401 || response.status === 403) return 'blocked'
    if (response.status === 400 || response.status === 404) return 'gone'
    return 'unknown'
  } catch {
    return 'unknown'
  }
}

/** Whether a video has a 1280×720 cover (maxresdefault); a HEAD request, nothing downloaded. */
export async function hasMaxresCover(videoId: string, deadline?: number): Promise<boolean | null> {
  if (!isYouTubeId(videoId)) return false
  try {
    const response = await fetch(`https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`, { method: 'HEAD', cache: 'no-store', signal: signal(deadline) })
    if (response.status === 200) return true
    if (response.status === 404) return false
    return null
  } catch {
    return null
  }
}

/** A cover's light ('r g b'): its 320×180 picture shrunk to 32×18, then the dominant hue. */
export async function coverColor(videoId: string, deadline?: number): Promise<string | null> {
  if (!isYouTubeId(videoId)) return null
  try {
    const response = await fetch(`https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`, { cache: 'no-store', signal: signal(deadline) })
    if (!response.ok) return null
    const sharp = (await import('sharp')).default
    const pixels = await sharp(Buffer.from(await response.arrayBuffer())).resize(32, 18, { fit: 'fill' }).ensureAlpha().raw().toBuffer()
    return dominantColor(new Uint8ClampedArray(pixels.buffer, pixels.byteOffset, pixels.length))
  } catch {
    return null
  }
}

/** A channel's picture, fetched from Google's picture host and kept small (96px WebP), with its light. */
export async function fetchAvatar(url: string, deadline?: number): Promise<{ data: Buffer, color: string | null } | null> {
  if (!AVATAR_HOST.test(url)) return null
  try {
    const response = await fetch(url, { cache: 'no-store', signal: signal(deadline) })
    if (!response.ok || !(response.headers.get('content-type') ?? '').startsWith('image/')) return null
    const sharp = (await import('sharp')).default
    const input = Buffer.from(await response.arrayBuffer())
    const data = await sharp(input).resize(96, 96, { fit: 'cover' }).webp({ quality: 78 }).toBuffer()
    const pixels = await sharp(input).resize(24, 24, { fit: 'fill' }).ensureAlpha().raw().toBuffer()
    return { data, color: dominantColor(new Uint8ClampedArray(pixels.buffer, pixels.byteOffset, pixels.length)) }
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------------------------
// The YouTube Data API (optional)

export const youtubeApiKey = () => process.env.YOUTUBE_API_KEY?.trim() || null

const pacificDay = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date())

/**
 * Takes `units` from today's allowance (the API's day ends at midnight Pacific time). False when
 * the soft cap would be passed; the caller then does without.
 */
async function takeUnits(db: TtvCollections, units: number): Promise<boolean> {
  const _id = `quota:${pacificDay()}`
  const expireAt = new Date(Date.now() + 3 * 86400_000)
  const result = await db.meta.findOneAndUpdate(
    { _id, $or: [{ units: { $exists: false } }, { units: { $lte: API_DAILY_UNITS - units } }] },
    { $inc: { units }, $set: { expireAt } },
    { upsert: false, returnDocument: 'after' },
  )
  if (result.value) return true
  // First call of the day: create the counter (a race with another run is harmless).
  const created = await db.meta.updateOne({ _id }, { $setOnInsert: { units, expireAt } }, { upsert: true }).catch(() => null)
  return !!created?.upsertedCount
}

/** Units used today (for the cron's stats). */
export async function unitsToday(db: TtvCollections): Promise<number> {
  return (await db.meta.findOne({ _id: `quota:${pacificDay()}` }))?.units ?? 0
}

type ApiParams = Record<string, string | number>

/** One Data API call (never search.list), or null without a key, past the cap, or on failure. */
export async function youtubeApi<T>(db: TtvCollections, resource: 'channels' | 'playlists' | 'playlistItems' | 'videos', params: ApiParams, deadline?: number): Promise<T | null> {
  const key = youtubeApiKey()
  if (!key) return null
  if (!(await takeUnits(db, 1))) return null
  const query = new URLSearchParams(Object.fromEntries(Object.entries(params).map(([name, value]) => [name, String(value)])))
  query.set('key', key)
  try {
    const response = await fetch(`https://www.googleapis.com/youtube/v3/${resource}?${query}`, { cache: 'no-store', signal: signal(deadline) })
    if (!response.ok) {
      console.error(`tunisian-tv: YouTube Data API ${resource} answered ${response.status}`)
      return null
    }
    return (await response.json()) as T
  } catch {
    return null
  }
}

export const isPlaylistId = (value: unknown): value is string => typeof value === 'string' && PLAYLIST_ID.test(value)
