// Download sources for a title, resolved from real, public, always-on torrent indexes keyed by
// IMDB id:
//   - movies  -> YTS (several mirrors) + The Pirate Bay
//   - TV      -> EZTV + The Pirate Bay (filtered to the chosen season/episode and to releases named
//                after the show)
//
// Unlike the streaming embeds, these return actual downloadable content (magnet links) and have
// stable APIs, so the download list keeps working even when individual stream providers go down.
// Everything here runs on the server (called through a server action), which avoids CORS and lets
// us query several indexes at once and merge them.

export type DownloadOption = {
  label: string
  quality?: string
  size?: string
  seeds?: number
  magnet: string
  source: 'YTS' | 'EZTV' | 'The Pirate Bay'
}

// Public BitTorrent trackers added to YTS magnets (YTS returns only the info-hash).
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

const normalizeImdb = (imdbId: string) => (/^tt?\d+$/.test(imdbId) ? imdbId.replace(/^tt/, '') : null)

function formatBytes(bytes: number): string {
  if (!bytes) return ''
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`
}

function buildMagnet(hash: string, name: string): string {
  const trackers = YTS_TRACKERS.map((tracker) => `&tr=${encodeURIComponent(tracker)}`).join('')
  return `magnet:?xt=urn:btih:${hash}&dn=${encodeURIComponent(name)}${trackers}`
}

async function fetchJson(url: string, revalidate = 3600): Promise<any | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
      next: { revalidate },
      signal: AbortSignal.timeout(12000),
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

// ---- The Pirate Bay (apibay) --------------------------------------------------------------------

// Its search API, no key: films by IMDB id, episodes by "<show> S01E01"; returns the info-hash.
const APIBAY = 'https://apibay.org/q.php'

/** The video torrents apibay returns for a query (its "no results" sentinel and non-video dropped). */
async function pirateBaySearch(query: string): Promise<any[]> {
  // apibay wants form-style spaces (+), not %20, or it answers "No results returned".
  const list = await fetchJson(`${APIBAY}?q=${encodeURIComponent(query).replace(/%20/g, '+')}`)
  return Array.isArray(list)
    ? list.filter((t) => t && t.id !== '0' && /^[0-9a-f]{40}$/i.test(t.info_hash || '') && Number(t.category) >= 200 && Number(t.category) < 300)
    : []
}

const pirateBayOption = (t: any): DownloadOption => ({
  label: String(t.name || '').trim(),
  quality: /\b(2160p|1080p|720p|480p)\b/i.exec(t.name || '')?.[1]?.toLowerCase(),
  size: formatBytes(Number(t.size)),
  seeds: Number(t.seeders) || 0,
  magnet: buildMagnet(String(t.info_hash).toLowerCase(), t.name),
  source: 'The Pirate Bay',
})

const hashOf = (magnet: string) => /btih:([0-9a-f]{40})/i.exec(magnet)?.[1]?.toLowerCase() ?? magnet

/** Merge several indexes' options: one entry per torrent, best quality first, best-seeded within. */
function merge(options: DownloadOption[]): DownloadOption[] {
  const seen = new Set<string>()
  return options
    .filter((option) => { const h = hashOf(option.magnet); if (seen.has(h)) return false; seen.add(h); return true })
    .sort((a, b) => (b.seeds ?? 0) - (a.seeds ?? 0))
    .slice(0, 20)
    .sort((a, b) => qualityRank(a.quality) - qualityRank(b.quality) || (b.seeds ?? 0) - (a.seeds ?? 0))
}

/** YTS copies for an IMDB id (its first mirror that answers). */
async function ytsMovies(id: string): Promise<DownloadOption[]> {
  for (const mirror of YTS_MIRRORS) {
    const json = await fetchJson(`${mirror}/api/v2/list_movies.json?query_term=tt${id}&limit=1`)
    const movie = json?.data?.movies?.[0]
    if (!movie?.torrents) continue
    return movie.torrents.map((torrent: any): DownloadOption => ({
      label: `${torrent.quality}${torrent.type ? ` ${torrent.type}` : ''}`,
      quality: torrent.quality,
      size: torrent.size,
      seeds: torrent.seeds,
      magnet: buildMagnet(torrent.hash, movie.title_long || movie.title),
      source: 'YTS',
    }))
  }
  return []
}

/** Movie downloads from YTS and The Pirate Bay, by IMDB id. Empty when nothing is found. */
export async function getMovieDownloads(imdbId: string): Promise<DownloadOption[]> {
  const id = normalizeImdb(imdbId)
  if (!id) return []
  const [yts, tpb] = await Promise.all([
    ytsMovies(id),
    pirateBaySearch(`tt${id}`).then((list) => list.filter((t) => t.imdb === `tt${id}`).map(pirateBayOption)),
  ])
  return merge([...yts, ...tpb])
}

// Comparable form of a show or release name: lower case, no accents or apostrophes, "&" as "and",
// punctuation as spaces, no leading "the". Same as player-service/resolve.js.
const simplify = (text: string) => text.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .replace(/['\u2019]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim().replace(/^the /, '')

/** Does a release name ("Sherlock S04E03 720p HDTV x264-FLEET") belong to one of these shows? */
function releaseMatches(release: string, names: string[]): boolean {
  const title = simplify(release)
  return names.some((name) => {
    const show = simplify(name)
    return show && (title === show || title.startsWith(`${show} `))
  })
}

// Best picture first; releases without a resolution in their name go last.
const QUALITY_ORDER = ['2160p', '1080p', '720p', '480p']
const qualityRank = (quality?: string) => {
  const index = quality ? QUALITY_ORDER.indexOf(quality) : -1
  return index === -1 ? QUALITY_ORDER.length : index
}

/** Episode downloads from EZTV for one season/episode. Empty when nothing is found or EZTV is down.
 *  EZTV files some releases under the wrong show (e.g. "Breaking Brad" under Breaking Bad's IMDB
 *  id), so when the show's names are known, only releases named after it are kept. */
/** EZTV episodes for an IMDB id, the chosen season/episode, named after the show. */
async function eztvEpisodes(id: string, season: number, episode: number, names: string[]): Promise<DownloadOption[]> {
  const json = await fetchJson(`${EZTV_HOST}/api/get-torrents?imdb_id=${id}&limit=100`)
  const torrents: any[] = json?.torrents ?? []
  return torrents
    .filter((torrent) => Number(torrent.season) === season && Number(torrent.episode) === episode && torrent.magnet_url)
    .filter((torrent) => !names.length || releaseMatches(String(torrent.title || ''), names))
    .map((torrent): DownloadOption => {
      const label = String(torrent.title || '').replace(/\[eztv\]/i, '').replace(/\s+EZTV$/i, '').trim() || `S${season}E${episode}`
      return {
        label,
        quality: /\b(2160p|1080p|720p|480p)\b/i.exec(label)?.[1]?.toLowerCase(),
        size: formatBytes(Number(torrent.size_bytes)),
        seeds: torrent.seeds,
        magnet: torrent.magnet_url,
        source: 'EZTV',
      }
    })
}

/** The Pirate Bay episodes, by "<show> S01E01", kept to the show and that episode. */
async function pirateBayEpisodes(names: string[], season: number, episode: number): Promise<DownloadOption[]> {
  if (!names.length) return []
  const code = `S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`
  const episodeRe = new RegExp(`(^|[^0-9])(s0*${season}[ ._-]*e0*${episode}|0*${season}x0*${episode})([^0-9]|$)`, 'i')
  const list = await pirateBaySearch(`${names[0]} ${code}`)
  return list.filter((t) => episodeRe.test(t.name) && releaseMatches(t.name, names)).map(pirateBayOption)
}

/** Episode downloads from EZTV and The Pirate Bay for one season/episode. Empty when nothing is found.
 *  EZTV files some releases under the wrong show (e.g. "Breaking Brad" under Breaking Bad's IMDB
 *  id), so when the show's names are known, only releases named after it are kept. */
export async function getTvDownloads(imdbId: string, season: number, episode: number, names: string[] = []): Promise<DownloadOption[]> {
  const id = normalizeImdb(imdbId)
  if (!id) return []
  const [eztv, tpb] = await Promise.all([
    eztvEpisodes(id, season, episode, names),
    pirateBayEpisodes(names, season, episode),
  ])
  return merge([...eztv, ...tpb])
}
