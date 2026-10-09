// Built-in subtitle providers, next to the extensions' (see addons.js), so subtitles work with no
// setup: each gives a list for a title, and the file of one entry.
//   - YIFY Subtitles: films, read from its site (no key).
//   - SubDL: films and series, a large Arabic catalogue; needs a free key (SUBDL_API_KEY).
// Their files come zipped: unzip() takes out the subtitle.

import zlib from 'node:zlib'
import { readCapped } from './addons.js'

const BROWSER = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'
const TIMEOUT = 12000

/** Language names as the sites write them → our three-letter codes. */
const NAMES = {
  arabic: 'ara', english: 'eng', french: 'fre', spanish: 'spa', german: 'ger', italian: 'ita', portuguese: 'por',
  'brazilian portuguese': 'pob', 'portuguese (brazil)': 'pob', 'brazillian portuguese': 'pob', turkish: 'tur', dutch: 'dut',
  russian: 'rus', polish: 'pol', romanian: 'rum', greek: 'gre', hebrew: 'heb', persian: 'per', 'farsi/persian': 'per', farsi: 'per',
  hindi: 'hin', indonesian: 'ind', malay: 'may', chinese: 'chi', 'chinese bg code': 'chi', japanese: 'jpn', korean: 'kor',
  swedish: 'swe', norwegian: 'nor', danish: 'dan', finnish: 'fin', czech: 'cze', hungarian: 'hun', bulgarian: 'bul',
  croatian: 'hrv', serbian: 'srp', ukrainian: 'ukr', vietnamese: 'vie', thai: 'tha', urdu: 'urd', bengali: 'ben',
  albanian: 'alb', slovenian: 'slv', slovak: 'slo', estonian: 'est', latvian: 'lav', lithuanian: 'lit', kurdish: 'kur',
}
export const codeOfName = (name) => NAMES[String(name || '').trim().toLowerCase()] || null

// ---- zip ------------------------------------------------------------------------------------------

/**
 * The subtitle inside a zip: the first .srt (else .vtt, else .sub/.txt), as bytes. Reads the
 * central directory, and inflates (or copies) that one entry. Null when there's none.
 */
export function unzip(buf) {
  const end = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]))
  if (end < 0) return null
  const count = buf.readUInt16LE(end + 10)
  let at = buf.readUInt32LE(end + 16)
  const entries = []
  for (let i = 0; i < count && at + 46 <= buf.length; i++) {
    if (buf.readUInt32LE(at) !== 0x02014b50) break
    const method = buf.readUInt16LE(at + 10)
    const size = buf.readUInt32LE(at + 20)
    const nameLength = buf.readUInt16LE(at + 28)
    const extraLength = buf.readUInt16LE(at + 30)
    const commentLength = buf.readUInt16LE(at + 32)
    const local = buf.readUInt32LE(at + 42)
    const name = buf.subarray(at + 46, at + 46 + nameLength).toString('utf8')
    entries.push({ name, method, size, local })
    at += 46 + nameLength + extraLength + commentLength
  }
  const pick = ['.srt', '.vtt', '.sub', '.txt'].map((ext) => entries.find((e) => e.name.toLowerCase().endsWith(ext) && !e.name.startsWith('__MACOSX'))).find(Boolean)
  if (!pick || pick.size > 10 * 1024 * 1024) return null
  const header = pick.local
  if (buf.readUInt32LE(header) !== 0x04034b50) return null
  const start = header + 30 + buf.readUInt16LE(header + 26) + buf.readUInt16LE(header + 28)
  const data = buf.subarray(start, start + pick.size)
  if (pick.method === 0) return data
  if (pick.method === 8) return zlib.inflateRawSync(data)
  return null
}

const isZip = (bytes) => bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b

/** A subtitle file's bytes, unzipped when it comes zipped. */
export async function downloadSubtitle(url, { referer } = {}) {
  const res = await fetch(url, { headers: { 'User-Agent': BROWSER, ...(referer ? { Referer: referer } : {}) }, redirect: 'follow', signal: AbortSignal.timeout(15000) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const bytes = Buffer.from(await res.arrayBuffer())
  if (bytes.length > 10 * 1024 * 1024) throw new Error('Subtitle file too big')
  if (!isZip(bytes)) return bytes
  const inside = unzip(bytes)
  if (!inside) throw new Error('No subtitle in the archive')
  return inside
}

// ---- YIFY Subtitles ------------------------------------------------------------------------------

const YIFY = 'https://yifysubtitles.ch'

/** Rows of a YIFY film page: [{ rating, language, release, page }]. */
export function readYifyPage(html) {
  const rows = []
  for (const match of String(html).matchAll(/<tr data-id="\d+">([\s\S]*?)<\/tr>/g)) {
    const row = match[1]
    const rating = Number(/rating-cell"><span class="label[^"]*">(-?\d+)</.exec(row)?.[1] || 0)
    const language = /class="sub-lang">([^<]+)</.exec(row)?.[1]?.trim()
    const link = /href="(\/subtitles\/[^"]+)"><span class="text-muted">subtitle<\/span>\s*([\s\S]*?)<\/a>/.exec(row)
    if (!language || !link) continue
    const release = link[2].split(/<br\s*\/?>/i).map((s) => s.replace(/<[^>]+>/g, '').trim()).filter(Boolean)
    rows.push({ rating, language, release, page: link[1] })
  }
  return rows
}

async function yify({ type, imdb }) {
  if (type !== 'movie') return []
  const res = await fetch(`${YIFY}/movie-imdb/${encodeURIComponent(imdb)}`, { headers: { 'User-Agent': BROWSER }, signal: AbortSignal.timeout(TIMEOUT) })
  if (!res.ok) return []
  const html = await readCapped(res, 3 * 1024 * 1024)
  return readYifyPage(html || '').slice(0, 150).map((row) => ({
    lang: codeOfName(row.language),
    languageName: row.language,
    release: row.release,
    rating: row.rating,
    url: `${YIFY}${row.page.replace('/subtitles/', '/subtitle/')}.zip`,
    referer: `${YIFY}${row.page}`,
  }))
}

// ---- SubDL (with a key) --------------------------------------------------------------------------

async function subdl({ type, imdb, season, episode }) {
  const key = process.env.SUBDL_API_KEY
  if (!key) return []
  const q = new URLSearchParams({ api_key: key, imdb_id: imdb, type: type === 'tv' ? 'tv' : 'movie', subs_per_page: '30', languages: 'AR,EN,FR,ES,DE,IT,TR,PT,NL,RU' })
  if (type === 'tv') { q.set('season_number', String(season)); q.set('episode_number', String(episode)) }
  const res = await fetch(`https://api.subdl.com/api/v1/subtitles?${q}`, { signal: AbortSignal.timeout(TIMEOUT) })
  if (!res.ok) return []
  const json = await res.json().catch(() => null)
  return (Array.isArray(json?.subtitles) ? json.subtitles : []).filter((s) => typeof s?.url === 'string').map((s) => ({
    lang: codeOfName(s.lang) || (typeof s.language === 'string' ? { AR: 'ara', EN: 'eng', FR: 'fre', ES: 'spa', DE: 'ger', IT: 'ita', TR: 'tur', PT: 'por', NL: 'dut', RU: 'rus' }[s.language.toUpperCase()] : null),
    languageName: s.lang,
    release: [s.release_name, s.name].filter((v) => typeof v === 'string'),
    rating: 0,
    url: `https://dl.subdl.com${s.url.startsWith('/') ? '' : '/'}${s.url}`,
  }))
}

export const PROVIDERS = [
  { name: 'YIFY Subtitles', find: yify },
  { name: 'SubDL', find: subdl },
]

/** Every built-in provider's subtitles for a title: [{ provider, lang, languageName, release, rating, url, referer? }]. */
export async function builtInSubtitles(title) {
  const lists = await Promise.all(PROVIDERS.map(async (provider) => {
    try { return (await provider.find(title)).map((s) => ({ ...s, provider: provider.name })) } catch { return [] }
  }))
  return lists.flat().filter((s) => s.lang)
}

// ---- which subtitle first ------------------------------------------------------------------------

const tokens = (text) => new Set(String(text || '').toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 1))

/** How well a subtitle's release names match the video's (0…1): matching releases stay in sync. */
export function releaseMatch(releases, videoName) {
  const video = tokens(videoName)
  if (!video.size) return 0
  let best = 0
  for (const release of releases || []) {
    const sub = tokens(release)
    if (!sub.size) continue
    let shared = 0
    for (const t of sub) if (video.has(t)) shared++
    best = Math.max(best, shared / Math.max(sub.size, video.size))
  }
  return best
}
