// Download sources for a title, resolved from real, public, always-on torrent indexes keyed by
// IMDB id:
//   - movies  -> YTS   (several mirrors, tried in order)
//   - TV      -> EZTV  (filtered to the chosen season/episode)
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

/** Episode downloads from EZTV for one season/episode. Empty when nothing is found or EZTV is down. */
export async function getTvDownloads(imdbId: string, season: number, episode: number): Promise<DownloadOption[]> {
  const id = normalizeImdb(imdbId)
  if (!id) return []

  const json = await fetchJson(`${EZTV_HOST}/api/get-torrents?imdb_id=${id}&limit=100`)
  const torrents: any[] = json?.torrents ?? []

  return torrents
    .filter((torrent) => Number(torrent.season) === season && Number(torrent.episode) === episode && torrent.magnet_url)
    .map((torrent): DownloadOption => ({
      label: (torrent.title || '').replace(/\[eztv\]/i, '').trim() || `S${season}E${episode}`,
      size: formatBytes(Number(torrent.size_bytes)),
      seeds: torrent.seeds,
      magnet: torrent.magnet_url,
      source: 'EZTV',
    }))
    .sort((a, b) => (b.seeds ?? 0) - (a.seeds ?? 0))
    .slice(0, 15)
}
