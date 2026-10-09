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
  return (await tmdbTitle(type, tmdbId, key))?.imdb ?? null
}

/** TMDB id → { imdb, names } (the title and the original title, to check torrent names against). */
export async function tmdbTitle(type, tmdbId, key) {
  if (!key) return null
  const kind = type === 'tv' ? 'tv' : 'movie'
  const json = await fetchJson(`${TMDB}/${kind}/${encodeURIComponent(tmdbId)}?api_key=${key}&append_to_response=external_ids`)
  if (!json) return null
  const names = [json.name, json.original_name, json.title, json.original_title].filter((n) => typeof n === 'string' && n.trim())
  return { imdb: json.imdb_id || json.external_ids?.imdb_id || null, names: [...new Set(names)] }
}

/** "Marvel's Agents of S.H.I.E.L.D." → "marvels agents of s h i e l d" (for comparing names). */
const simplify = (text) => String(text).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .replace(/['\u2019]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim().replace(/^the /, '')

/** Does a release name ("Sherlock S04E03 720p HDTV x264-FLEET") belong to one of these shows? */
export function releaseMatches(release, names) {
  const title = simplify(release)
  return names.some((name) => {
    const show = simplify(name)
    return show && (title === show || title.startsWith(`${show} `))
  })
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

/** Episode magnets from EZTV for one season/episode, best-first. EZTV files some releases under
 *  the wrong show (e.g. "Breaking Brad" under Breaking Bad's IMDB id), so when the show's names are
 *  known, only releases named after it are kept. */
export async function tvMagnets(imdbId, season, episode, names = []) {
  const id = normalizeImdb(imdbId)
  if (!id) return []
  const json = await fetchJson(`${EZTV_HOST}/api/get-torrents?imdb_id=${id}&limit=100`)
  return (json?.torrents ?? [])
    .filter((t) => Number(t.season) === season && Number(t.episode) === episode && t.magnet_url)
    .filter((t) => !names.length || releaseMatches(t.title || '', names))
    .map((t) => {
      const label = (t.title || '').replace(/\[eztv\]/i, '').replace(/\s+EZTV$/i, '').trim() || `S${season}E${episode}`
      return { magnet: t.magnet_url, seeds: t.seeds, quality: /\b(2160p|1080p|720p|480p)\b/i.exec(label)?.[1]?.toLowerCase(), label }
    })
    .sort((a, b) => (b.seeds ?? 0) - (a.seeds ?? 0))
    .slice(0, 15)
}

/** Options ordered by how likely they are to play well with zero CPU: 1080p, then 720p, x264 over
 *  x265/HEVC/AV1 (which need a live transcode), then by seeds. 2160p goes last (almost always HEVC). */
export function rankOptions(options) {
  const rank = (o) => {
    const q = o.quality || ''
    let score = q === '1080p' ? 3 : q === '720p' ? 2 : q === '2160p' ? 0 : 1
    if (/\b(x265|hevc|h\.?265|av1)\b/i.test(o.label || '') || o.type === 'x265') score -= 1.5
    return score
  }
  return [...options].sort((a, b) => rank(b) - rank(a) || (b.seeds ?? 0) - (a.seeds ?? 0))
}

/** The single best option (see rankOptions). */
export function pickBest(options) {
  return options.length ? rankOptions(options)[0] : null
}
