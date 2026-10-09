// Resolve a title to a torrent magnet, so the player can go straight from "a movie/episode" to a
// local stream. TMDB id → IMDB id → magnet (YTS for movies, EZTV for TV). Mirrors the site's
// src/lib/downloads.ts, in plain JS, plus the TMDB id→IMDB step.

const YTS_TRACKERS = [
  'udp://open.demonii.com:1337/announce',
  'udp://tracker.openbittorrent.com:80',
  'udp://tracker.opentrackr.org:1337/announce',
  'udp://tracker.coppersurfer.tk:6969',
  'udp://glotorrents.pw:6969/announce',
  'udp://tracker.leechers-paradise.org:6969',
  'udp://p4p.arenabg.com:1337',
]
const YTS_MIRRORS = ['https://yts.mx', 'https://yts.lt', 'https://yts.am']
const EZTV_HOST = 'https://eztvx.to'
const TMDB = 'https://api.themoviedb.org/3'

const normalizeImdb = (imdbId) => (/^tt?\d+$/.test(String(imdbId)) ? String(imdbId).replace(/^tt/, '') : null)

async function fetchJson(url, timeoutMs = 12000) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
    })
    return res.ok ? await res.json() : null
  } catch {
    return null
  }
}

function buildMagnet(hash, name) {
  const trackers = YTS_TRACKERS.map((t) => `&tr=${encodeURIComponent(t)}`).join('')
  return `magnet:?xt=urn:btih:${hash}&dn=${encodeURIComponent(name)}${trackers}`
}

/** TMDB id → IMDB id (needs a TMDB key). */
export async function tmdbToImdb(type, tmdbId, key) {
  if (!key) return null
  const json = await fetchJson(`${TMDB}/${type === 'tv' ? 'tv' : 'movie'}/${encodeURIComponent(tmdbId)}/external_ids?api_key=${key}`)
  return json?.imdb_id || null
}

/** Movie magnets from YTS, best-first. Each: {magnet, quality, type, seeds, label}. */
export async function movieMagnets(imdbId) {
  const id = normalizeImdb(imdbId)
  if (!id) return []
  for (const mirror of YTS_MIRRORS) {
    const json = await fetchJson(`${mirror}/api/v2/list_movies.json?query_term=tt${id}&limit=1`)
    const movie = json?.data?.movies?.[0]
    if (!movie?.torrents) continue
    return movie.torrents
      .map((t) => ({
        magnet: buildMagnet(t.hash, movie.title_long || movie.title),
        quality: t.quality, type: t.type, seeds: t.seeds,
        label: `${t.quality}${t.type ? ` ${t.type}` : ''}`,
      }))
      .sort((a, b) => (b.seeds ?? 0) - (a.seeds ?? 0))
  }
  return []
}

/** Episode magnets from EZTV for one season/episode, best-first. */
export async function tvMagnets(imdbId, season, episode) {
  const id = normalizeImdb(imdbId)
  if (!id) return []
  const json = await fetchJson(`${EZTV_HOST}/api/get-torrents?imdb_id=${id}&limit=100`)
  return (json?.torrents ?? [])
    .filter((t) => Number(t.season) === season && Number(t.episode) === episode && t.magnet_url)
    .map((t) => ({ magnet: t.magnet_url, seeds: t.seeds, label: (t.title || '').replace(/\[eztv\]/i, '').trim() || `S${season}E${episode}` }))
    .sort((a, b) => (b.seeds ?? 0) - (a.seeds ?? 0))
    .slice(0, 15)
}

/** Pick the magnet most likely to play with zero CPU: prefer 1080p/720p x264 over 2160p (x265). */
export function pickBest(options) {
  if (!options.length) return null
  const rank = (o) => {
    const q = o.quality || ''
    if (q === '1080p') return 3
    if (q === '720p') return 2
    if (q === '2160p') return 0   // almost always HEVC → needs transcode
    return 1
  }
  return [...options].sort((a, b) => rank(b) - rank(a) || (b.seeds ?? 0) - (a.seeds ?? 0))[0]
}
