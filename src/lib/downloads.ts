// Download sources for a title, resolved from real, public, always-on torrent indexes keyed by
// IMDB id:
//   - movies  -> YTS   (several mirrors, tried in order)
//   - TV      -> EZTV  (filtered to the chosen season/episode and to releases named after the show)
//
// Unlike the streaming embeds, these return actual downloadable content (magnet links) and have
// stable APIs, so the download list keeps working even when individual stream providers go down.
// Everything here runs on the server (called through a server action), which avoids CORS and lets
// us fall back between mirrors.

export type DownloadOption = {
  label: string
  quality?: string
  size?: string
  seeds?: number
  magnet: string
  source: 'YTS' | 'EZTV'
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

/** Movie downloads from YTS, resolved by IMDB id. Empty array when nothing is found or YTS is down. */
export async function getMovieDownloads(imdbId: string): Promise<DownloadOption[]> {
  const id = normalizeImdb(imdbId)
  if (!id) return []

  for (const mirror of YTS_MIRRORS) {
    const json = await fetchJson(`${mirror}/api/v2/list_movies.json?query_term=tt${id}&limit=1`)
    const movie = json?.data?.movies?.[0]
    if (!movie?.torrents) continue

    return movie.torrents
      .map((torrent: any): DownloadOption => ({
        label: `${torrent.quality}${torrent.type ? ` ${torrent.type}` : ''}`,
        quality: torrent.quality,
        size: torrent.size,
        seeds: torrent.seeds,
        magnet: buildMagnet(torrent.hash, movie.title_long || movie.title),
        source: 'YTS',
      }))
      .sort((a: DownloadOption, b: DownloadOption) => (b.seeds ?? 0) - (a.seeds ?? 0))
  }
  return []
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
export async function getTvDownloads(imdbId: string, season: number, episode: number, names: string[] = []): Promise<DownloadOption[]> {
  const id = normalizeImdb(imdbId)
  if (!id) return []

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
    // The 15 best-seeded, then by quality (best seeded first within one).
    .sort((a, b) => (b.seeds ?? 0) - (a.seeds ?? 0))
    .slice(0, 15)
    .sort((a, b) => qualityRank(a.quality) - qualityRank(b.quality) || (b.seeds ?? 0) - (a.seeds ?? 0))
}
