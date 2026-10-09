// More built-in torrent providers, beyond YTS (movies) and EZTV (TV) in resolve.js, so the player
// finds a copy even when those two don't have one. Each returns the same shape resolve.js uses, plus
// a provider name and size: { provider, magnet, quality, seeds, size, label, type }. No key needed.
//
// - The Pirate Bay (apibay.org): a very large catalogue of films and series, searched by IMDB id
//   (films) or by "<show> S01E01" (series), returning the info_hash directly.
//
// The site's heavy lifting (aggregators that each cover a dozen indexers, like Torrentio) comes
// through the extensions (see addons.js, extensions.json); this file is the always-on core.

import { releaseMatches } from './resolve.js'

// A broad public tracker set added to the magnets (apibay returns only the info_hash).
const TRACKERS = [
  'udp://tracker.opentrackr.org:1337/announce',
  'udp://open.demonii.com:1337/announce',
  'udp://tracker.openbittorrent.com:6969/announce',
  'udp://open.stealth.si:80/announce',
  'udp://tracker.torrent.eu.org:451/announce',
  'udp://exodus.desync.com:6969/announce',
  'udp://tracker.coppersurfer.tk:6969/announce',
  'udp://9.rarbg.to:2710/announce',
  'udp://explodie.org:6969/announce',
]

const normalizeImdb = (imdbId) => {
  const text = String(imdbId || '')
  if (/^tt\d+$/.test(text)) return text
  if (/^\d+$/.test(text)) return `tt${text}`
  return null
}

const readQuality = (name) => /\b(2160p|4k|uhd|1080p|720p|480p)\b/i.exec(name)?.[1]?.toLowerCase().replace(/4k|uhd/, '2160p') || null

function buildMagnet(hash, name) {
  const trackers = TRACKERS.map((t) => `&tr=${encodeURIComponent(t)}`).join('')
  return `magnet:?xt=urn:btih:${hash.toLowerCase()}&dn=${encodeURIComponent(name)}${trackers}`
}

// apibay returns [{ id:"0", name:"No results returned", ... }] for nothing found.
const isVideoCategory = (category) => Number(category) >= 200 && Number(category) < 300

async function apibay(query, timeoutMs = 10000) {
  try {
    // apibay wants form-style spaces (+), not %20, or it answers "No results returned".
    const res = await fetch(`https://apibay.org/q.php?q=${encodeURIComponent(query).replace(/%20/g, '+')}`, {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!res.ok) return []
    const list = await res.json()
    return Array.isArray(list) ? list.filter((t) => t && t.id !== '0' && /^[0-9a-f]{40}$/i.test(t.info_hash || '')) : []
  } catch {
    return []
  }
}

const normalize = (provider) => (t) => ({
  provider,
  magnet: buildMagnet(t.info_hash, t.name),
  quality: readQuality(t.name),
  seeds: Number(t.seeders) || 0,
  size: Number(t.size) || null,
  label: String(t.name || '').trim(),
  type: /\b(x265|hevc|h\.?265|av1)\b/i.test(t.name || '') ? 'x265' : null,
})

/** The Pirate Bay films for an IMDB id (name as a fallback). */
export async function pirateBayMovie(imdbId, names = []) {
  const id = normalizeImdb(imdbId)
  if (!id) return []
  let list = (await apibay(id)).filter((t) => t.imdb === id && isVideoCategory(t.category))
  if (!list.length && names.length) {
    list = (await apibay(names[0])).filter((t) => isVideoCategory(t.category) && releaseMatches(t.name, names))
  }
  return list.map(normalize('The Pirate Bay'))
}

/** The Pirate Bay episodes, by "<show> S01E01", kept to the show and that episode. */
export async function pirateBayTv(names, season, episode) {
  if (!names.length) return []
  const code = `S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`
  const episodeRe = new RegExp(`(^|[^0-9])(s0*${season}[ ._-]*e0*${episode}|0*${season}x0*${episode})([^0-9]|$)`, 'i')
  const list = await apibay(`${names[0]} ${code}`)
  return list
    .filter((t) => isVideoCategory(t.category) && episodeRe.test(t.name) && releaseMatches(t.name, names))
    .map(normalize('The Pirate Bay'))
}

// A multi-film pack ("The Matrix Trilogy", "Essential Films super pack", "1-4 Collection"): huge and
// well-seeded, so it would rank first by seeds, but it isn't the single film the viewer asked for.
const PACK = /\b(tri|du|quadri|tetra|penta|hexa)logy\b|\bduology\b|\b(anthology|collection|complete|saga|boxset|filmography|bundle|megapack|superpack)\b|\bbox[ ._-]?set\b|\bsuper[ ._-]?pack\b|\ball[ ._-]*(the[ ._-]*)?(parts|movies|films)\b|\b\d+[ ._-]*(movies|films)\b|\b\d{1,2}[ ._-]*in[ ._-]*1\b|\bpack\b/i
export const isPack = (label) => PACK.test(String(label || ''))

const GB = 1e9
// A copy's size at which it is comfortable to stream for its quality; well over it buffers on an
// average connection (a 1080p REMUX is 30 GB+). Used to favour copies that play well, not just big ones.
const SIZE_BUDGET = { '2160p': 18 * GB, '1080p': 6 * GB, '720p': 3 * GB, '480p': 1.5 * GB }
const qualityBase = (q) => ({ '1080p': 4, '720p': 3.5, '2160p': 2.5, '480p': 2 }[q] ?? 3)

/**
 * How well a copy streams on a normal connection, higher first: its quality, minus live-transcode
 * (HEVC/AV1) and oversized/REMUX copies that buffer, plus how well it is seeded (more peers download
 * faster) — and, for a film, how well its name and year match (packs sink). This is the auto-pick:
 * the player plays the top one and tries the rest in turn, and the viewer can still choose any.
 */
export function streamScore(s, { type, names = [], year = null }) {
  let score = qualityBase(s.quality)
  if (/\b(x265|hevc|h\.?265|av1)\b/i.test(s.label || '') || s.type === 'x265') score -= 1.5
  if (/\bremux\b/i.test(s.label || '')) score -= 2.5
  if (s.size) score -= Math.min(4, Math.max(0, (s.size - (SIZE_BUDGET[s.quality] || 4 * GB)) / (SIZE_BUDGET[s.quality] || 4 * GB)))
  score += Math.log10(1 + (s.seeds || 0))          // a well-seeded copy arrives faster
  if (s.kind === 'url') score += 1.5               // a direct link needs no swarm
  if (type === 'movie') {
    if (releaseMatches(s.label, names)) score += 3.5
    if (year && new RegExp(`\\b${year}\\b`).test(s.label || '')) score += 1
    if (isPack(s.label)) score -= 8
  }
  return score
}

/** A title's sources, the best to stream first (see streamScore). */
export function rankForTitle(sources, ctx) {
  return [...sources].sort((a, b) => streamScore(b, ctx) - streamScore(a, ctx) || (b.seeds ?? 0) - (a.seeds ?? 0))
}

/** Every extra built-in provider's copies of a title, as one list. */
export async function extraBuiltIns({ type, imdb, names, season, episode }) {
  const lists = await Promise.all([
    type === 'movie' ? pirateBayMovie(imdb, names) : pirateBayTv(names, season, episode),
  ])
  return lists.flat()
}
