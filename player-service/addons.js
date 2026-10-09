// Extensions: more sources and subtitles, from servers that speak the common add-on protocol. The
// viewer installs one by the address of its manifest (https://…/manifest.json), or from the ready
// list (extensions.json), and the player asks every installed one for the title being watched:
//   GET <base>/stream/<movie|series>/<tt…[:season:episode]>.json     → { streams: [...] }
//   GET <base>/subtitles/<movie|series>/<tt…[:season:episode]>.json  → { subtitles: [...] }
// A stream is a torrent (infoHash + fileIdx), which our engine plays, or a direct http(s) link.
//
// The installed extensions live in DATA_DIR/addons.json. A first run installs the ones
// extensions.json marks "default".
//
// Only the player's own pages may install or list add-ons (requireAllowedOrigin in server.js), and
// what an add-on answers is data: its links are kept server-side behind random ids, so a page never
// hands the service a URL to fetch.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** The ready list: [{ url, default }] from extensions.json, next to this file. */
export function readCatalog(file = path.join(path.dirname(fileURLToPath(import.meta.url)), 'extensions.json')) {
  try {
    const list = JSON.parse(fs.readFileSync(file, 'utf8')).extensions
    return (Array.isArray(list) ? list : []).map((e) => ({ url: manifestUrl(e?.url), default: e?.default === true })).filter((e) => e.url)
  } catch {
    return []
  }
}
const DEFAULT_ADDONS = () => readCatalog().filter((e) => e.default).map((e) => e.url)

const MAX_MANIFEST_BYTES = 256 * 1024
const MAX_ANSWER_BYTES = 2 * 1024 * 1024
const ADDON_TIMEOUT_MS = 9000

/** An extension's address (https://host/x/manifest.json, or the same as an app link) → the https URL, or null. */
export function manifestUrl(input) {
  let text = String(input || '').trim()
  // Extension sites often offer an app link (scheme://host/manifest.json): it's the same address.
  const scheme = /^([a-z][a-z0-9+.-]*):\/\//i.exec(text)
  if (scheme && /^(file|data|javascript|blob)$/i.test(scheme[1])) return null
  if (scheme && !/^https?$/i.test(scheme[1])) text = `https://${text.slice(scheme[0].length)}`
  let url
  try { url = new URL(text) } catch { return null }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  if (url.username || url.password) return null
  if (!/\/manifest\.json$/i.test(url.pathname)) url.pathname = `${url.pathname.replace(/\/+$/, '')}/manifest.json`
  url.hash = ''
  return url.toString()
}

/** The add-on's base address (its manifest URL without /manifest.json): where its resources are. */
export const baseOf = (manifest) => manifest.replace(/\/manifest\.json(\?.*)?$/i, '')

/** A manifest's resources as [{ name, types, idPrefixes }] (it may list plain names or objects). */
export function resourcesOf(manifest) {
  const types = Array.isArray(manifest?.types) ? manifest.types : []
  const prefixes = Array.isArray(manifest?.idPrefixes) ? manifest.idPrefixes : null
  return (Array.isArray(manifest?.resources) ? manifest.resources : [])
    .map((resource) => typeof resource === 'string'
      ? { name: resource, types, idPrefixes: prefixes }
      : resource && typeof resource.name === 'string'
        ? { name: resource.name, types: Array.isArray(resource.types) ? resource.types : types, idPrefixes: Array.isArray(resource.idPrefixes) ? resource.idPrefixes : prefixes }
        : null)
    .filter(Boolean)
}

/** Does this add-on answer `resource` for this type and IMDB id? */
export function serves(manifest, resource, type, id) {
  return resourcesOf(manifest).some((r) => r.name === resource && r.types.includes(type) && (!r.idPrefixes || r.idPrefixes.some((p) => id.startsWith(p))))
}

/** A title's id in the protocol: 'tt0133093', or 'tt0903747:1:1' for an episode. */
export const mediaId = (type, imdb, season, episode) => (type === 'series' ? `${imdb}:${season}:${episode}` : imdb)

/** Only what we show and use of a manifest. */
export function cleanManifest(json) {
  if (!json || typeof json !== 'object' || typeof json.id !== 'string' || typeof json.name !== 'string') return null
  if (!Array.isArray(json.resources)) return null
  const text = (value, max) => (typeof value === 'string' ? value.slice(0, max) : '')
  // Shown in our player, in our words: "… Addon for <another app>" reads "… extension".
  const ours = (value) => value
    .replace(/\s*\b(for|on|in)\s+stremio\b/gi, '')
    .replace(/\bstremio\s*/gi, '')
    .replace(/\badd-?ons?\b/gi, (word) => (/s$/i.test(word) ? 'extensions' : 'extension'))
    .replace(/\s{2,}/g, ' ')
    .trim()
  return {
    id: text(json.id, 120),
    name: ours(text(json.name, 80)).replace(/\s+v\d+(\.\d+)*$/i, '') || text(json.name, 80),
    version: text(json.version, 30),
    description: ours(text(json.description, 400)),
    logo: /^https:\/\//.test(json.logo || '') ? text(json.logo, 500) : '',
    resources: json.resources.slice(0, 20),
    types: Array.isArray(json.types) ? json.types.filter((t) => typeof t === 'string').slice(0, 20) : [],
    idPrefixes: Array.isArray(json.idPrefixes) ? json.idPrefixes.filter((p) => typeof p === 'string').slice(0, 20) : undefined,
  }
}

/** GET a JSON document with a timeout and a size cap; null on any failure. */
export async function fetchJsonCapped(url, { timeoutMs = ADDON_TIMEOUT_MS, maxBytes = MAX_ANSWER_BYTES } = {}) {
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' }, redirect: 'follow', signal: AbortSignal.timeout(timeoutMs) })
    if (!res.ok) return null
    const text = await readCapped(res, maxBytes)
    return text === null ? null : JSON.parse(text)
  } catch {
    return null
  }
}

/** A response body as text, or null when it's bigger than maxBytes. */
export async function readCapped(res, maxBytes) {
  const declared = Number(res.headers.get('content-length'))
  if (declared > maxBytes) return null
  const reader = res.body.getReader()
  const chunks = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.length
    if (size > maxBytes) { reader.cancel().catch(() => {}); return null }
    chunks.push(value)
  }
  return Buffer.concat(chunks).toString('utf8')
}

// ---- the installed add-ons --------------------------------------------------------------------

export function createAddonStore(dataDir) {
  const file = path.join(dataDir, 'addons.json')
  let addons = null   // [{ url, manifest }]
  const manifestCache = new Map()   // the ready list's manifests

  const save = () => {
    try {
      fs.mkdirSync(dataDir, { recursive: true })
      fs.writeFileSync(file, JSON.stringify(addons, null, 2))
    } catch (err) {
      console.error('[addons] could not save', err.message)
    }
  }

  async function load() {
    if (addons) return addons
    try {
      const saved = JSON.parse(fs.readFileSync(file, 'utf8'))
      addons = Array.isArray(saved) ? saved.filter((a) => a && typeof a.url === 'string' && a.manifest) : []
    } catch {
      // First run: the default add-ons (those that answer).
      addons = []
      for (const url of DEFAULT_ADDONS()) {
        const manifest = cleanManifest(await fetchJsonCapped(url, { maxBytes: MAX_MANIFEST_BYTES }))
        if (manifest) addons.push({ url, manifest })
      }
      save()
    }
    return addons
  }

  return {
    async list() {
      // Cleaned again: extensions installed before a wording change show the new wording.
      return (await load()).map(({ url, manifest }) => ({ url, ...(cleanManifest(manifest) || manifest) }))
    },

    /** Install (or refresh) an add-on from its manifest address. Throws a message to show. */
    async install(input) {
      const url = manifestUrl(input)
      if (!url) throw new Error('That isn’t an extension address. It looks like https://…/manifest.json')
      const manifest = cleanManifest(await fetchJsonCapped(url, { maxBytes: MAX_MANIFEST_BYTES }))
      if (!manifest) throw new Error('No extension answered at that address.')
      const usable = resourcesOf(manifest).some((r) => (r.name === 'stream' || r.name === 'subtitles') && (r.types.includes('movie') || r.types.includes('series')))
      if (!usable) throw new Error(`${manifest.name} has no streams or subtitles for films and series.`)
      const list = await load()
      const others = list.filter((a) => a.manifest.id !== manifest.id && a.url !== url)
      addons = [...others, { url, manifest }]
      save()
      return { url, ...manifest }
    },

    async remove(id) {
      const list = await load()
      addons = list.filter((a) => a.manifest.id !== id)
      save()
      return addons.length !== list.length
    },

    /** The ready list, with each extension's details and whether it's installed. */
    async catalog() {
      const installed = new Set((await load()).map((a) => a.url))
      const entries = await Promise.all(readCatalog().map(async ({ url }) => {
        const manifest = manifestCache.get(url) || cleanManifest(await fetchJsonCapped(url, { maxBytes: MAX_MANIFEST_BYTES }))
        if (!manifest) return null
        manifestCache.set(url, manifest)
        return { url, ...manifest, installed: installed.has(url) }
      }))
      return entries.filter(Boolean)
    },

    /** Every extension's answer for one resource: [{ addon, items }]. Slow or broken ones are skipped. */
    async ask(resource, type, id) {
      const list = (await load()).filter((a) => serves(a.manifest, resource, type, id))
      const key = resource === 'stream' ? 'streams' : 'subtitles'
      return Promise.all(list.map(async ({ url, manifest }) => {
        const json = await fetchJsonCapped(`${baseOf(url)}/${resource}/${type}/${encodeURIComponent(id)}.json`)
        return { addon: cleanManifest(manifest) || manifest, items: Array.isArray(json?.[key]) ? json[key].slice(0, 200) : [] }
      }))
    },
  }
}

// ---- reading an add-on's streams ---------------------------------------------------------------

const QUALITY = /\b(2160p|4k|1440p|1080p|720p|576p|480p|360p)\b/i

/** '1.4 GB' → bytes, from a stream's description (add-ons write the size in its title). */
export function sizeIn(text) {
  const match = /(\d+(?:[.,]\d+)?)\s*(TB|GB|MB|KB)\b/i.exec(text || '')
  if (!match) return null
  const unit = { KB: 1e3, MB: 1e6, GB: 1e9, TB: 1e12 }[match[2].toUpperCase()]
  return Math.round(Number(match[1].replace(',', '.')) * unit)
}

/** Seeders from a stream's description ('👤 123', 'Seeds: 123', 'S: 123'). */
export function seedsIn(text) {
  const match = /(?:👤|seeds?:?|seeders?:?|\bS:)\s*(\d+)/i.exec(text || '')
  return match ? Number(match[1]) : null
}

/** One add-on stream as a source, or null for what the player can't play (YouTube, external links). */
export function sourceFromStream(stream, addon) {
  if (!stream || typeof stream !== 'object') return null
  const text = [stream.name, stream.title, stream.description].filter((v) => typeof v === 'string').join('\n')
  const quality = QUALITY.exec(text)?.[1]?.toLowerCase().replace('4k', '2160p') || null
  // The first line of the title is usually the release name; the rest is size/seeds/provider.
  const release = (typeof stream.title === 'string' ? stream.title : typeof stream.description === 'string' ? stream.description : '').split('\n')[0].trim()
  const label = (release || String(stream.name || addon.name)).replace(/\s+/g, ' ').slice(0, 160)
  const base = {
    provider: addon.name,
    name: typeof stream.name === 'string' ? stream.name.replace(/\s+/g, ' ').slice(0, 60) : addon.name,
    label,
    quality,
    size: sizeIn(text),
    seeds: seedsIn(text),
  }
  if (typeof stream.infoHash === 'string' && /^[0-9a-f]{40}$/i.test(stream.infoHash)) {
    const trackers = (Array.isArray(stream.sources) ? stream.sources : [])
      .filter((s) => typeof s === 'string' && /^tracker:(udp|https?|wss?):\/\//i.test(s))
      .slice(0, 20)
      .map((s) => `&tr=${encodeURIComponent(s.slice('tracker:'.length))}`)
      .join('')
    const hash = stream.infoHash.toLowerCase()
    return {
      ...base,
      kind: 'torrent',
      infoHash: hash,
      fileIdx: Number.isInteger(stream.fileIdx) && stream.fileIdx >= 0 ? stream.fileIdx : null,
      magnet: `magnet:?xt=urn:btih:${hash}&dn=${encodeURIComponent(label)}${trackers}`,
    }
  }
  if (typeof stream.url === 'string' && /^https?:\/\//i.test(stream.url)) {
    return { ...base, kind: 'url', url: stream.url }
  }
  return null
}

// ---- the audio languages a copy says it has -------------------------------------------------------

// Release names and extension titles say when a copy is dubbed: words (FRENCH, VFF, LATINO…) or
// flags. Three-letter codes, as the subtitles use.
const DUBS = [
  ['fre', /\b(french|truefrench|vff|vfq|vfi|vf2|vf|vostfr-vf)\b|🇫🇷/i],
  ['ara', /\b(arabic|arab(ic)?[ ._-]?dub(bed)?|ar[ ._-]?dub)\b|🇸🇦|🇪🇬|🇹🇳|🇲🇦|🇩🇿|🇦🇪/i],
  ['spa', /\b(spanish|latino|castellano|español|espanol)\b|🇪🇸|🇲🇽/i],
  ['ger', /\b(german|deutsch)\b|🇩🇪/i],
  ['ita', /\b(italian|italiano)\b|🇮🇹/i],
  ['tur', /\b(turkish|türkçe|turkce)\b|🇹🇷/i],
  ['por', /\b(portuguese|dublado|pt[ ._-]?br)\b|🇵🇹|🇧🇷/i],
  ['rus', /\b(russian)\b|🇷🇺/i],
  ['hin', /\b(hindi)\b|🇮🇳/i],
  ['jpn', /\b(japanese)\b|🇯🇵/i],
  ['kor', /\b(korean)\b|🇰🇷/i],
]
const MULTI = /\b(multi(-?audio)?|dual[ ._-]?audio|multi[ ._-]?lang(uage)?s?)\b/i

/** { languages: ['fre', …], multi } from a copy's name: what dubbed audio it has, as far as it says. */
export function audioLanguagesOf(text) {
  const name = String(text || '')
  return { languages: DUBS.filter(([, pattern]) => pattern.test(name)).map(([code]) => code), multi: MULTI.test(name) }
}

// ---- subtitles ---------------------------------------------------------------------------------

const LANGUAGES = {
  ara: 'Arabic', eng: 'English', fre: 'French', fra: 'French', spa: 'Spanish', ger: 'German', deu: 'German',
  ita: 'Italian', por: 'Portuguese', pob: 'Portuguese (Brazil)', tur: 'Turkish', dut: 'Dutch', nld: 'Dutch',
  rus: 'Russian', pol: 'Polish', rum: 'Romanian', ron: 'Romanian', gre: 'Greek', ell: 'Greek', heb: 'Hebrew',
  per: 'Persian', fas: 'Persian', hin: 'Hindi', ind: 'Indonesian', may: 'Malay', msa: 'Malay', chi: 'Chinese',
  zho: 'Chinese', jpn: 'Japanese', kor: 'Korean', swe: 'Swedish', nor: 'Norwegian', dan: 'Danish', fin: 'Finnish',
  cze: 'Czech', ces: 'Czech', hun: 'Hungarian', bul: 'Bulgarian', hrv: 'Croatian', srp: 'Serbian', ukr: 'Ukrainian',
  vie: 'Vietnamese', tha: 'Thai', urd: 'Urdu', ben: 'Bengali', alb: 'Albanian', sqi: 'Albanian', slv: 'Slovenian',
  slo: 'Slovak', slk: 'Slovak', est: 'Estonian', lav: 'Latvian', lit: 'Lithuanian', kur: 'Kurdish', amh: 'Amharic',
}

/** 'ara' / 'ar' / 'Arabic' → { code: 'ara', name: 'Arabic' }. */
export function languageOf(lang) {
  const text = String(lang || '').trim()
  const lower = text.toLowerCase()
  if (LANGUAGES[lower]) return { code: lower, name: LANGUAGES[lower] }
  try {
    const name = new Intl.DisplayNames(['en'], { type: 'language' }).of(lower)
    if (name && name.toLowerCase() !== lower) return { code: lower, name }
  } catch { /* not a language code */ }
  return { code: lower || 'und', name: text || 'Unknown' }
}

/**
 * Subtitle bytes as text. Most files are UTF-8; older Arabic ones are often Windows-1256 and
 * Western ones Windows-1252, which read as UTF-8 come out full of '�'.
 */
export function decodeSubtitle(bytes, langCode = '') {
  const utf8 = new TextDecoder('utf-8').decode(bytes)
  const broken = (utf8.match(/�/g) || []).length
  if (broken < 3) return utf8.replace(/^﻿/, '')
  const fallback = /^(ara|ar|per|fas|fa|urd|ur)$/i.test(langCode) ? 'windows-1256' : 'windows-1252'
  try { return new TextDecoder(fallback).decode(bytes) } catch { return utf8 }
}
