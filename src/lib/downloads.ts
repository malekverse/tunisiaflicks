// Download sources for a title, resolved from real, public torrent indexes keyed by IMDB id:
//   - movies  -> YTS (several mirrors) + Torrentio
//   - TV      -> EZTV (the chosen episode, named after the show) + Torrentio (the episode's id)
//
// Torrentio aggregates many indexers (The Pirate Bay, 1337x, TorrentGalaxy, RARBG, MagnetDL…) and,
// being a public add-on API, answers from the server — unlike apibay, which blocks datacenter IPs,
// so it works in the desktop player (the viewer's own machine) but not from Vercel. The streaming
// player keeps apibay too (see player-service/providers.js); this list, running on Vercel, uses
// Torrentio. Everything here runs server-side (a server action), which avoids CORS and merges indexes.

export type DownloadOption = {
  label: string
  quality?: string
  size?: string
  seeds?: number
  magnet: string
  /** The index the copy came from: 'YTS', 'EZTV', or an indexer Torrentio names ('The Pirate Bay', '1337x'…). */
  source: string
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

// ---- Torrentio (aggregates The Pirate Bay, 1337x, YTS, EZTV, TorrentGalaxy and more) -------------
//
// A public add-on API callable from anywhere (so it works from the server, unlike apibay, which
// blocks datacenter IPs). One request returns dozens of copies for a title, each a line like:
//   name:  "Torrentio\n1080p"
//   title: "The Matrix 1999 1080p BluRay x264\n👤 120 💾 1.9 GB ⚙️ ThePirateBay"
const TORRENTIO = 'https://torrentio.strem.fun'

const sizeText = (text: string) => {
  const m = /(\d+(?:\.\d+)?)\s?(TB|GB|MB|KB)\b/i.exec(text)
  return m ? `${m[1]} ${m[2].toUpperCase()}` : ''
}
const seedsFrom = (text: string) => Number(/(?:\u{1F464}|seeds?:?|\bS:)\s*(\d+)/iu.exec(text)?.[1]) || 0
// The indexer Torrentio got a copy from ("⚙️ ThePirateBay" → "The Pirate Bay"), for the source chip.
const PROVIDER_NAMES: Record<string, string> = { thepiratebay: 'The Pirate Bay', yts: 'YTS', eztv: 'EZTV', torrentgalaxy: 'TorrentGalaxy', rarbg: 'RARBG', magnetdl: 'MagnetDL', horriblesubs: 'HorribleSubs', nyaasi: 'Nyaa' }
const providerFrom = (text: string) => {
  const raw = /⚙️?\s*([^\n]+)/.exec(text)?.[1]?.trim()
  return raw ? (PROVIDER_NAMES[raw.toLowerCase().replace(/[^a-z0-9]/g, '')] ?? raw) : 'Torrentio'
}

/** Copies for a title from Torrentio ('movie'/tt… or 'series'/tt…:s:e). */
async function torrentio(type: 'movie' | 'series', id: string): Promise<DownloadOption[]> {
  const json = await fetchJson(`${TORRENTIO}/stream/${type}/${encodeURIComponent(id)}.json`)
  const streams: any[] = Array.isArray(json?.streams) ? json.streams : []
  return streams
    .filter((s) => /^[0-9a-f]{40}$/i.test(s?.infoHash || ''))
    .map((s): DownloadOption => {
      const text = [s.name, s.title].filter((v) => typeof v === 'string').join('\n')
      const release = (typeof s.title === 'string' ? s.title : '').split('\n')[0].trim()
      return {
        label: release || String(s.name || '').replace(/\n/g, ' '),
        quality: /\b(2160p|4k|1080p|720p|480p)\b/i.exec(text)?.[1]?.toLowerCase().replace('4k', '2160p'),
        size: sizeText(text) ?? '',
        seeds: seedsFrom(text),
        magnet: buildMagnet(String(s.infoHash).toLowerCase(), release || 'download'),
        source: providerFrom(text),
      }
    })
}

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

/** Movie downloads from YTS and Torrentio (The Pirate Bay, 1337x…), by IMDB id. Empty when none. */
export async function getMovieDownloads(imdbId: string): Promise<DownloadOption[]> {
  const id = normalizeImdb(imdbId)
  if (!id) return []
  const [yts, more] = await Promise.all([ytsMovies(id), torrentio('movie', `tt${id}`)])
  return merge([...yts, ...more])
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

/** Episode downloads from EZTV and Torrentio for one season/episode. Empty when nothing is found.
 *  EZTV files some releases under the wrong show (e.g. "Breaking Brad" under Breaking Bad's IMDB
 *  id), so when the show's names are known, only releases named after it are kept. Torrentio is
 *  queried by the episode's id, so its results are already the right show and episode. */
export async function getTvDownloads(imdbId: string, season: number, episode: number, names: string[] = []): Promise<DownloadOption[]> {
  const id = normalizeImdb(imdbId)
  if (!id) return []
  const [eztv, more] = await Promise.all([
    eztvEpisodes(id, season, episode, names),
    torrentio('series', `tt${id}:${season}:${episode}`),
  ])
  return merge([...eztv, ...more])
}
