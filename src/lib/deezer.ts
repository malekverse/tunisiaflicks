// Deezer's public API (no key): album search, an album, its tracks, a track's fresh preview link.
// Server only. Every call goes to the one fixed host with a 6 second timeout, and answers null
// when Deezer can't be reached or says something unexpected.
import 'server-only'

const HOST = 'https://api.deezer.com'
const TIMEOUT_MS = 6000

export type DeezerAlbumHit = { id: number, title: string, artist: { id: number, name: string } | null, nbTracks: number, explicit: boolean, recordType: string }
export type DeezerAlbum = DeezerAlbumHit & { releaseDate: string | null, cover: string | null, link: string, contributors: string[] }
export type DeezerTrack = { id: number, title: string, artist: string, duration: number, explicit: boolean, hasPreview: boolean }

/** GET a Deezer API path (relative to the fixed host), JSON or null. */
async function get(path: string, params: Record<string, string | number> = {}, revalidate = 86400): Promise<any | null> {
  const url = new URL(path.replace(/^\/+/, ''), `${HOST}/`)
  if (url.origin !== HOST) return null
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value))
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    // revalidate 0: never cached (a preview link must be fresh).
    const response = await fetch(url, revalidate > 0 ? { signal: controller.signal, next: { revalidate } } : { signal: controller.signal, cache: 'no-store' })
    if (!response.ok) return null
    const body = await response.json()
    // Deezer answers errors with 200 and {error: {...}}.
    return body && typeof body === 'object' && !body.error ? body : null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

const text = (value: unknown, max = 200) => (typeof value === 'string' ? value.trim().slice(0, max) : '')
const id = (value: unknown) => (typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null)

/** Only Deezer's own image CDN, over https (the URL ends up in an <img>). */
const deezerImage = (value: unknown) => {
  if (typeof value !== 'string') return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && /(^|\.)dzcdn\.net$/.test(url.hostname) ? url.href : null
  } catch {
    return null
  }
}

function toHit(raw: any): DeezerAlbumHit | null {
  const albumId = id(raw?.id)
  if (!albumId || !text(raw?.title)) return null
  const artistId = id(raw?.artist?.id)
  return {
    id: albumId,
    title: text(raw.title),
    artist: artistId && text(raw.artist?.name) ? { id: artistId, name: text(raw.artist.name) } : null,
    nbTracks: typeof raw.nb_tracks === 'number' ? raw.nb_tracks : 0,
    explicit: raw.explicit_lyrics === true,
    recordType: text(raw.record_type, 20),
  }
}

/** Albums matching a free-text query (at most `limit`). */
export async function searchAlbums(query: string, limit = 25): Promise<DeezerAlbumHit[] | null> {
  const body = await get('search/album', { q: query.slice(0, 120), limit })
  if (!body) return null
  return (Array.isArray(body.data) ? body.data : []).map(toHit).filter((hit: DeezerAlbumHit | null): hit is DeezerAlbumHit => hit !== null)
}

/** One album, with its release date and cover. */
export async function getAlbum(albumId: number): Promise<DeezerAlbum | null> {
  const body = await get(`album/${albumId}`)
  const hit = body && toHit(body)
  if (!hit) return null
  const link = `https://www.deezer.com/album/${hit.id}`
  return {
    ...hit,
    releaseDate: /^\d{4}-\d{2}-\d{2}$/.test(body.release_date ?? '') ? body.release_date : null,
    cover: deezerImage(body.cover_xl) ?? deezerImage(body.cover_big),
    link,
    contributors: (Array.isArray(body.contributors) ? body.contributors : []).map((person: any) => text(person?.name)).filter(Boolean).slice(0, 12),
  }
}

/** An album's tracks (at most 40), without their preview links (those expire: see previewUrl). */
export async function getAlbumTracks(albumId: number): Promise<DeezerTrack[] | null> {
  const body = await get(`album/${albumId}/tracks`, { limit: 40 }, 3600)
  if (!body) return null
  return (Array.isArray(body.data) ? body.data : []).flatMap((raw: any): DeezerTrack[] => {
    const trackId = id(raw?.id)
    if (!trackId || !text(raw?.title) || raw?.readable === false) return []
    return [{
      id: trackId,
      title: text(raw.title),
      artist: text(raw.artist?.name),
      duration: typeof raw.duration === 'number' ? raw.duration : 0,
      explicit: raw.explicit_lyrics === true,
      hasPreview: typeof raw.preview === 'string' && raw.preview.length > 0,
    }]
  })
}

/**
 * A track's 30-second preview, as a fresh signed link (Deezer's links expire after about 15
 * minutes, so they are never stored or cached long). Only Deezer's preview CDN over https.
 */
export async function previewUrl(trackId: number): Promise<{ url: string, explicit: boolean } | null> {
  const body = await get(`track/${trackId}`, {}, 0)
  const preview = body?.preview
  if (typeof preview !== 'string') return null
  try {
    const url = new URL(preview)
    if (url.protocol !== 'https:' || !/(^|\.)dzcdn\.net$/.test(url.hostname)) return null
    return { url: url.href, explicit: body.explicit_lyrics === true }
  } catch {
    return null
  }
}
