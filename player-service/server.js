// TunisiaFlicks player service — turns a torrent (magnet / infohash) into an HTTP video stream
// a browser can play, with Range seeking for the common case and on-the-fly ffmpeg remux/transcode
// for the files a plain <video> can't play (MKV / AC3 / HEVC …).
//
// IMPORTANT: long-running server (holds peer connections + disk buffers). Runs on a real always-on
// box OR, better, on each viewer's own machine via the desktop app. Never on Vercel/serverless.
//
// SECURITY: it exposes a torrent engine over HTTP, so it is locked down — it binds to loopback only,
// accepts requests only for localhost (anti DNS-rebinding), only lets allow-listed web origins drive
// it (CORS + Origin), and never takes a URL or a path from a page: it plays magnets/infohashes, and
// the links of the extensions the viewer installed, which it keeps behind random ids (the page only
// ever sends an id back); ffmpeg/ffprobe may only open them over http(s). See README "Security".
//
// Test only with content you are allowed to stream (public-domain / Creative-Commons / Linux ISOs);
// the default demos are Blender open movies (Sintel, Big Buck Bunny), CC-BY.

import express from 'express'
import cors from 'cors'
import WebTorrent from 'webtorrent'
import parseTorrent from 'parse-torrent'
import { spawn } from 'node:child_process'
import http from 'node:http'
import crypto from 'node:crypto'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import * as ffbin from 'ffmpeg-ffprobe-static'
import { analyze, ffmpegArgs, withAudio } from './codec.js'
import { tmdbTitle, movieMagnets, tvMagnets, rankOptions } from './resolve.js'
import * as dlna from './dlna.js'
import { audioLanguagesOf, createAddonStore, decodeSubtitle, languageOf, sourceFromStream, mediaId } from './addons.js'
import { createStateStore, isTitleKey } from './state.js'
import { MAX_CHARS, MAX_LINES, TARGETS, translateLines } from './translate.js'
import { builtInSubtitles, downloadSubtitle } from './subtitles.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const HOST = process.env.HOST || '127.0.0.1'                      // loopback only — never the LAN
const PORT = Number(process.env.PORT) || 8080
const DOWNLOAD_DIR = process.env.DOWNLOAD_DIR || path.join(os.tmpdir(), 'tunisiaflicks-stream')
const MAX_TORRENTS = Number(process.env.MAX_TORRENTS) || 12       // keep few swarms alive at once
const IDLE_MS = Number(process.env.IDLE_MS) || 10 * 60 * 1000     // drop a torrent after 10m unused
const TRANSCODE_MAXHEIGHT = Number(process.env.TRANSCODE_MAXHEIGHT) || 1080
// What the player keeps between runs (the installed add-ons). The desktop app passes its own folder.
const DATA_DIR = process.env.DATA_DIR || path.join(os.homedir(), '.tunisiaflicks-player')

// Web origins allowed to drive the service (CORS + Origin check). The app's own origins + dev.
const ALLOWED_ORIGINS = new Set(
  (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,https://tunisiaflicks.vercel.app')
    .split(',').map((s) => s.trim()).filter(Boolean)
)

// ffmpeg/ffprobe: bundled binaries, overridable, with a PATH fallback.
const FFMPEG = process.env.FFMPEG_PATH || ffbin.ffmpegPath || 'ffmpeg'
const FFPROBE = process.env.FFPROBE_PATH || ffbin.ffprobePath || 'ffprobe'

// TMDB key — lets /resolve turn a TMDB id into a magnet, and powers the browse proxy. Server-side
// only (the viewer never sees it). Falls back to the project's public key for local dev.
const TMDB_KEY = process.env.TMDB_API_KEY || 'b5d2609c326586f7f753f77b085a0b31'
const TMDB_API = 'https://api.themoviedb.org/3'

const VIDEO_EXT = ['.mp4', '.m4v', '.mkv', '.webm', '.mov', '.avi', '.ts', '.ogv', '.flv', '.wmv']
const isVideo = (name) => VIDEO_EXT.includes(path.extname(name).toLowerCase())

// Only magnets / infohashes are ever accepted — never an http(s) URL or a filesystem path, which
// parse-torrent/webtorrent would happily fetch/read (SSRF + local-file exfiltration).
const isTorrentId = (s) =>
  typeof s === 'string' && (/^magnet:\?/i.test(s.trim()) || /^[0-9a-f]{40}$/i.test(s.trim()) || /^[a-z2-7]{32}$/i.test(s.trim()))

// The download folder is only a streaming cache. A swarm's files are deleted when it's dropped,
// but a player that's killed (closing the desktop app ends it at once) never gets to, and every
// title watched would stay on disk for good. So each start clears what the last run left behind.
// Only our own default folder: a DOWNLOAD_DIR someone set by hand is never emptied.
const DEFAULT_DOWNLOAD_DIR = path.join(os.tmpdir(), 'tunisiaflicks-stream')
if (path.resolve(DOWNLOAD_DIR) === path.resolve(DEFAULT_DOWNLOAD_DIR)) {
  try { fs.rmSync(DOWNLOAD_DIR, { recursive: true, force: true }) } catch (err) { console.error('[cache] could not clear', err.message) }
}
fs.mkdirSync(DOWNLOAD_DIR, { recursive: true })

// NOTE on seeding: we do NOT throttle upload to 0 — that would block the BitTorrent handshake
// (which must send bytes) and the client would find no peers. The viewer is a normal swarm member
// while a title is open (their IP is visible, inherent to torrents), but we keep seeding minimal by
// only pulling the pieces being watched and dropping the swarm as soon as the stream ends/idles
// (see the idle reaper + destroyTorrent). This is normal leech behaviour, not a no-upload guarantee.
const client = new WebTorrent()
client.on('error', (err) => console.error('[webtorrent]', err.message))

// A single malformed magnet or a peer-layer hiccup must never take the whole service down.
process.on('uncaughtException', (err) => console.error('[uncaught]', err?.message || err))
process.on('unhandledRejection', (err) => console.error('[unhandledRejection]', err?.message || err))

// infoHash -> { torrent, lastAccess, analysis: Map<index, decision> }
const active = new Map()
// infoHash -> Promise<torrent> for an add that's still fetching metadata (dedupes concurrent adds).
const pending = new Map()

/** Largest video file in a torrent (the feature, not a sample/extra). */
function pickBestFile(torrent) {
  const videos = torrent.files.filter((f) => isVideo(f.name))
  const pool = videos.length ? videos : torrent.files
  return pool.reduce((best, f) => (!best || f.length > best.length ? f : best), null)
}

/** The file to play: the one the source names, else the episode's in a season pack, else the largest. */
function pickFile(torrent, { fileIdx = null, season = null, episode = null } = {}) {
  if (Number.isInteger(fileIdx) && torrent.files[fileIdx] && isVideo(torrent.files[fileIdx].name)) return torrent.files[fileIdx]
  if (season && episode) {
    const code = new RegExp(`(^|[^0-9])(s0*${season}[ ._-]*e0*${episode}|0*${season}x0*${episode})([^0-9]|$)`, 'i')
    const matches = torrent.files.filter((f) => isVideo(f.name) && code.test(f.name))
    if (matches.length) return matches.reduce((best, f) => (f.length > best.length ? f : best))
  }
  return pickBestFile(torrent)
}

async function infoHashOf(input) {
  try {
    const parsed = await parseTorrent(input)
    return typeof parsed?.infoHash === 'string' ? parsed.infoHash.toLowerCase() : null
  } catch {
    return null
  }
}

/** Add a magnet/infohash, or return the already-running swarm. Resolves once metadata is ready;
 *  a swarm that doesn't answer in time is dropped again (so a dead copy doesn't linger). */
async function getTorrent(magnetOrHash, timeoutMs = 60000) {
  const hash = await infoHashOf(magnetOrHash)
  if (hash && active.has(hash)) {
    touch(hash)
    return active.get(hash).torrent
  }
  if (hash && pending.has(hash)) return pending.get(hash)   // an add is already in flight — join it
  if (active.size >= MAX_TORRENTS) evictOldest()

  const p = new Promise((resolve, reject) => {
    let added = null
    const timeout = setTimeout(() => {
      try { added?.destroy({ destroyStore: true }) } catch {}
      reject(new Error('Timed out fetching torrent metadata (no seeders reachable?)'))
    }, timeoutMs)
    const onReady = (torrent) => {
      clearTimeout(timeout)
      torrent.files.forEach((f) => f.deselect())     // stream on demand, don't pull the whole torrent
      torrent.deselect(0, torrent.pieces.length - 1, 0)
      active.set(torrent.infoHash, { torrent, lastAccess: Date.now(), analysis: new Map() })
      resolve(torrent)
    }
    try {
      added = client.add(magnetOrHash, { path: DOWNLOAD_DIR }, onReady)
      added.on('error', (err) => { clearTimeout(timeout); reject(err) })
    } catch (err) {
      clearTimeout(timeout)
      reject(err)
    }
  })

  if (hash) {
    pending.set(hash, p)
    const clear = () => pending.delete(hash)
    p.then(clear, clear)   // both handlers → no unhandled rejection from the cleanup chain
  }
  return p
}

const touch = (infoHash) => {
  const entry = active.get(infoHash)
  if (entry) entry.lastAccess = Date.now()
}

function destroyTorrent(infoHash) {
  const entry = active.get(infoHash)
  if (!entry) return
  active.delete(infoHash)
  entry.torrent.destroy({ destroyStore: true }, () => {})
}

function evictOldest() {
  let oldest = null
  for (const [hash, entry] of active) {
    if (!oldest || entry.lastAccess < oldest.lastAccess) oldest = { hash, lastAccess: entry.lastAccess }
  }
  if (oldest) destroyTorrent(oldest.hash)
}

setInterval(() => {
  const now = Date.now()
  for (const [hash, entry] of active) {
    if (now - entry.lastAccess > IDLE_MS) destroyTorrent(hash)
  }
}, 60 * 1000).unref()

// ---- codec probing + playback policy --------------------------------------------------------

/** ffprobe the head of a torrent file (read through webtorrent's piece-prioritized stream). */
function probeFile(file) {
  const HEAD = 5 * 1024 * 1024   // the moov/mkv header lives near the front; 5MB is plenty and quick
  return new Promise((resolve) => {
    let out = ''
    let settled = false
    const finish = (val) => { if (!settled) { settled = true; clearTimeout(timer); try { ff.kill('SIGKILL') } catch {} ; resolve(val) } }
    const ff = spawn(FFPROBE, ['-v', 'error', '-probesize', '5M', '-analyzeduration', '5M', '-show_streams', '-show_format', '-of', 'json', '-i', 'pipe:0'])
    const timer = setTimeout(() => finish(null), 30000)
    ff.stdout.on('data', (d) => { out += d })
    ff.on('error', () => finish(null))
    ff.on('close', () => {
      try {
        const json = JSON.parse(out)
        // Partial input yields a valid-but-empty object; treat that as "unknown", not "no video".
        finish(json && Array.isArray(json.streams) && json.streams.length ? json : null)
      } catch { finish(null) }
    })
    file.select()   // mark the file wanted so webtorrent prioritises pulling its early pieces
    // ffprobe stops reading once it has the header → EPIPE on further writes; swallow it.
    const rs = file.createReadStream({ start: 0, end: Math.min(file.length - 1, HEAD) })
    ff.stdin.on('error', () => {})
    rs.on('error', () => { try { ff.kill('SIGKILL') } catch {} })
    rs.pipe(ff.stdin)
  })
}

/** ffprobe a direct http(s) link (an add-on's stream): only network protocols, a time limit. */
function probeUrl(url) {
  return new Promise((resolve) => {
    let out = ''
    let settled = false
    const finish = (val) => { if (!settled) { settled = true; clearTimeout(timer); try { ff.kill('SIGKILL') } catch {} ; resolve(val) } }
    const ff = spawn(FFPROBE, ['-v', 'error', '-protocol_whitelist', 'http,https,tcp,tls,crypto', '-probesize', '5M', '-analyzeduration', '5M',
      '-show_streams', '-show_format', '-of', 'json', '-i', url])
    const timer = setTimeout(() => finish(null), 25000)
    ff.stdout.on('data', (d) => { out += d })
    ff.on('error', () => finish(null))
    ff.on('close', () => {
      try {
        const json = JSON.parse(out)
        finish(json && Array.isArray(json.streams) && json.streams.length ? json : null)
      } catch { finish(null) }
    })
  })
}

/** Analysis for a file index. A real ffprobe result is cached; a failed probe returns a provisional
 *  extension-based guess WITHOUT caching, so a later request re-probes once the header has arrived. */
async function analysisFor(entry, index) {
  if (entry.analysis.has(index)) return entry.analysis.get(index)
  const file = entry.torrent.files[index]
  const probe = await probeFile(file)
  const info = analyze(probe, file.name)
  if (probe) entry.analysis.set(index, info)
  return info
}

// ---- HTTP -----------------------------------------------------------------------------------

const app = express()

// Anti-DNS-rebinding: only answer for localhost. A malicious page that rebinds a domain to
// 127.0.0.1 would arrive with a foreign Host header; reject it.
app.use((req, res, next) => {
  const host = (req.headers.host || '').split(':')[0]
  if (host === '127.0.0.1' || host === 'localhost' || host === '[::1]') return next()
  res.status(403).end()
})

// The app's own page is served from http://127.0.0.1:<dynamic port>, so loopback origins are always
// allowed (the Host guard above already blocks anything that isn't localhost).
const LOOPBACK_ORIGIN = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/
const isAllowedOrigin = (origin) => !origin || ALLOWED_ORIGINS.has(origin) || LOOPBACK_ORIGIN.test(origin)

app.use(cors({ origin: (origin, cb) => cb(null, isAllowedOrigin(origin)) }))
app.use(express.json())

// Only allow-listed web origins may DRIVE the engine (add swarms). Same-origin page fetches and
// the native app send no Origin and are allowed; a random website's fetch carries its Origin and is
// refused, so it can't make someone's machine join a swarm.
function requireAllowedOrigin(req, res, next) {
  if (!isAllowedOrigin(req.headers.origin)) return res.status(403).json({ error: 'Origin not allowed' })
  next()
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, active: active.size, downloaded: client.downloaded, uploaded: client.uploaded })
})

const base = (req) => `${req.protocol}://${req.get('host')}`

/** Resolve a magnet to its file list + a ready-to-play URL (direct/remux/transcode) for the best file. */
async function handleAdd(req, res) {
  const magnet = (req.body?.magnet || req.query.magnet || '').toString().trim()
  if (!isTorrentId(magnet)) {
    return res.status(400).json({ error: 'Provide a magnet link or infohash (nothing else is accepted)' })
  }
  try {
    const torrent = await getTorrent(magnet)
    const entry = active.get(torrent.infoHash)
    const best = pickBestFile(torrent)
    const bestIndex = best ? torrent.files.indexOf(best) : -1

    let bestOut = null
    if (best) {
      const info = await analysisFor(entry, bestIndex)
      const playPath = info.decision === 'direct' ? `/stream/${torrent.infoHash}/${bestIndex}` : `/play/${torrent.infoHash}/${bestIndex}`
      bestOut = {
        index: bestIndex, name: best.name, length: best.length,
        decision: info.decision, seekable: info.decision === 'direct',
        container: info.container, video: info.vcodec, audio: info.acodec, durationSec: info.durationSec,
        playUrl: `${base(req)}${playPath}`,
      }
    }

    res.json({
      infoHash: torrent.infoHash,
      name: torrent.name,
      peers: torrent.numPeers,
      files: torrent.files.map((f, index) => ({ index, name: f.name, length: f.length, video: isVideo(f.name) })),
      best: bestOut,
    })
  } catch (err) {
    console.error('[add]', err.message)
    res.status(502).json({ error: err.message })
  }
}
app.get('/add', requireAllowedOrigin, handleAdd)
app.post('/add', requireAllowedOrigin, handleAdd)

// ---- sources: every copy of a title, from YTS/EZTV and the installed add-ons -----------------
//
// The player lists them (the source picker) and plays the one picked, or the best one. Each source
// gets a random id; the page only ever sends that id back, never a magnet or a link, so the
// service still never fetches an address a page gave it.

const addonStore = createAddonStore(DATA_DIR)
const sources = new Map()       // id -> source { kind, magnet | url, fileIdx, … , at }
const titleSources = new Map()  // 'tv:1399:1:1' -> { at, payload }
const subtitleFiles = new Map() // id -> { url, lang, at, text? }
const SOURCES_TTL = 10 * 60 * 1000
const newId = () => crypto.randomBytes(9).toString('hex')

setInterval(() => {
  const old = Date.now() - 6 * 60 * 60 * 1000
  for (const map of [sources, subtitleFiles]) for (const [id, item] of map) if (item.at < old) map.delete(id)
}, 30 * 60 * 1000).unref()

/** The title of a request: { type, tmdb, season, episode, key } or null. */
function titleOf(query) {
  const type = query.type === 'tv' ? 'tv' : 'movie'
  const tmdb = /^\d{1,9}$/.test(String(query.tmdb || '')) ? String(query.tmdb) : null
  if (!tmdb) return null
  const season = type === 'tv' ? Math.max(0, Math.min(999, Number(query.season) || 1)) : null
  const episode = type === 'tv' ? Math.max(0, Math.min(9999, Number(query.episode) || 1)) : null
  return { type, tmdb, season, episode, key: [type, tmdb, season, episode].filter((v) => v !== null).join(':') }
}

const hashOfMagnet = (magnet) => /xt=urn:btih:([0-9a-f]{40})/i.exec(magnet)?.[1]?.toLowerCase() || null

/** Every source for a title, best first (see rankOptions), cached for a few minutes. */
async function sourcesFor(title) {
  const cached = titleSources.get(title.key)
  if (cached && Date.now() - cached.at < SOURCES_TTL) return cached.payload

  const info = await tmdbTitle(title.type, title.tmdb, TMDB_KEY)
  const imdb = info?.imdb || null
  const names = info?.names ?? []
  if (!imdb) return { imdb: null, names, list: [] }

  const kind = title.type === 'tv' ? 'series' : 'movie'
  const [builtIn, answers] = await Promise.all([
    title.type === 'movie' ? movieMagnets(imdb) : tvMagnets(imdb, title.season, title.episode, names),
    addonStore.ask('stream', kind, mediaId(kind, imdb, title.season, title.episode)),
  ])

  const list = builtIn.map((option) => ({
    kind: 'torrent', provider: title.type === 'movie' ? 'YTS' : 'EZTV', name: title.type === 'movie' ? 'YTS' : 'EZTV',
    label: option.label, quality: option.quality || null, type: option.type, seeds: option.seeds ?? null, size: null,
    magnet: option.magnet, infoHash: hashOfMagnet(option.magnet), fileIdx: null,
  }))
  for (const { addon, items } of answers) {
    for (const stream of items) {
      const source = sourceFromStream(stream, addon)
      if (source) list.push(source)
    }
  }

  // One entry per torrent (the first add-on to list it, with the details it gave).
  const seen = new Set()
  const unique = list.filter((s) => {
    const key = s.kind === 'torrent' ? `${s.infoHash || s.magnet}:${s.fileIdx ?? ''}` : s.url
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  // A direct link needs no swarm: among equals, it goes first.
  const ranked = rankOptions(unique.map((s) => ({ ...s, seeds: s.kind === 'url' ? (s.seeds ?? 0) + 1e6 : s.seeds })))
    .map((s) => ({ ...s, seeds: s.kind === 'url' ? (s.seeds - 1e6 || null) : s.seeds }))
  for (const source of ranked) {
    source.id = newId()
    Object.assign(source, audioLanguagesOf(`${source.label} ${source.name || ''}`))
    sources.set(source.id, { ...source, title, at: Date.now() })
  }

  const payload = { imdb, names, list: ranked }
  titleSources.set(title.key, { at: Date.now(), payload })
  return payload
}

/** A source as the page sees it: what to show, and its id. */
const publicSource = (s) => ({ id: s.id, kind: s.kind, provider: s.provider, name: s.name, label: s.label, quality: s.quality, size: s.size, seeds: s.seeds, languages: s.languages || [], multi: !!s.multi })

/** Every copy of a title, for the source picker. */
app.get('/sources', requireAllowedOrigin, async (req, res) => {
  const title = titleOf(req.query)
  if (!title) return res.status(400).json({ error: 'Provide type and tmdb' })
  try {
    const { names, list } = await sourcesFor(title)
    res.json({ name: names[0] || null, sources: list.map(publicSource), addons: (await addonStore.list()).length })
  } catch (err) {
    console.error('[sources]', err.message)
    res.status(502).json({ error: err.message })
  }
})

/** Play one source: join its swarm (or probe its link) and answer how to play it. */
async function playSource(req, source, timeoutMs) {
  const { title } = source
  if (source.kind === 'url') {
    const probe = await probeUrl(source.url)
    const info = analyze(probe, new URL(source.url).pathname)
    if (probe) source.analysis = info   // /uplay converts with it
    return {
      kind: 'url',
      decision: info.decision,
      seekable: info.decision === 'direct',
      durationSec: info.durationSec,
      audioTracks: info.audioTracks || [],
      playUrl: info.decision === 'direct' ? source.url : `${base(req)}/uplay/${source.id}`,
    }
  }
  const torrent = await getTorrent(source.magnet, timeoutMs)
  const entry = active.get(torrent.infoHash)
  const file = pickFile(torrent, { fileIdx: source.fileIdx, season: title?.season, episode: title?.episode })
  const index = file ? torrent.files.indexOf(file) : -1
  if (index < 0) throw Object.assign(new Error('Torrent has no playable file'), { status: 404 })
  const info = await analysisFor(entry, index)
  const playPath = info.decision === 'direct' ? `/stream/${torrent.infoHash}/${index}` : `/play/${torrent.infoHash}/${index}`
  return {
    kind: 'torrent',
    title: torrent.name,
    infoHash: torrent.infoHash,
    index,
    decision: info.decision,
    seekable: info.decision === 'direct',
    durationSec: info.durationSec,
    audioTracks: info.audioTracks || [],
    playUrl: `${base(req)}${playPath}`,
  }
}

/**
 * Given a title (TMDB id), play a source: the one picked (?source=<id> from /sources), or the best
 * ones in turn (see rankOptions): one whose swarm doesn't answer makes way for the next, so a single
 * dead torrent doesn't mean "not available". Also takes ?imdb= alone (YTS/EZTV only), as before.
 */
const RESOLVE_ATTEMPTS = [30000, 20000, 20000]   // metadata timeout per copy tried
app.get('/resolve', requireAllowedOrigin, async (req, res) => {
  try {
    let candidates
    let names = []
    if (typeof req.query.source === 'string') {
      const source = sources.get(req.query.source)
      if (!source) return res.status(404).json({ error: 'That source is gone. Reopen the source list.' })
      candidates = [source]
      names = (source.title && titleSources.get(source.title.key)?.payload.names) || []
    } else if (req.query.tmdb) {
      const title = titleOf(req.query)
      if (!title) return res.status(400).json({ error: 'Provide type and tmdb' })
      const found = await sourcesFor(title)
      names = found.names
      candidates = found.list.map((s) => sources.get(s.id)).filter(Boolean)
      // The viewer's audio language (?audioLang=fre): copies dubbed in it, or with several tracks, first.
      const lang = typeof req.query.audioLang === 'string' ? req.query.audioLang : null
      if (lang) {
        const has = (s) => (s.languages || []).includes(lang) ? 0 : s.multi ? 1 : 2
        candidates = candidates.map((s, i) => ({ s, i })).sort((a, b) => has(a.s) - has(b.s) || a.i - b.i).map(({ s }) => s)
      }
    } else if (typeof req.query.imdb === 'string') {
      const type = req.query.type === 'tv' ? 'tv' : 'movie'
      const options = type === 'movie' ? await movieMagnets(req.query.imdb) : await tvMagnets(req.query.imdb, Number(req.query.season) || 1, Number(req.query.episode) || 1)
      candidates = rankOptions(options).map((o) => ({ kind: 'torrent', magnet: o.magnet, label: o.label, quality: o.quality, provider: type === 'movie' ? 'YTS' : 'EZTV', fileIdx: null, title: null }))
    } else {
      return res.status(400).json({ error: 'Provide tmdb (or imdb)' })
    }
    if (!candidates.length) return res.status(404).json({ error: 'No torrent found for this title' })

    let played = null
    let choice = null
    let lastError = null
    for (const [i, source] of candidates.slice(0, RESOLVE_ATTEMPTS.length).entries()) {
      try {
        played = await playSource(req, source, RESOLVE_ATTEMPTS[i])
        choice = source
        break
      } catch (err) {
        lastError = err
        if (err.status === 404 && candidates.length === 1) break
        console.error('[resolve] copy failed, trying the next:', source.label, '-', err.message)
      }
    }
    if (!played) throw lastError || new Error('No copy answered')

    res.json({
      ...played,
      name: names[0] || null,   // the title as TMDB has it (what a TV shows while casting)
      sourceId: choice.id || null,
      provider: choice.provider || null,
      label: choice.label || null,
      quality: choice.quality || null,
    })
  } catch (err) {
    console.error('[resolve]', err.message)
    res.status(err.status || 502).json({ error: err.message })
  }
})

// ---- subtitles, from the add-ons --------------------------------------------------------------

/**
 * Every subtitle for a title, from the built-in providers (subtitles.js) and the extensions:
 * [{ id, lang, language, provider, release, rating }]. The player ranks them (the ones whose
 * release matches the video first).
 */
app.get('/subtitles', requireAllowedOrigin, async (req, res) => {
  const title = titleOf(req.query)
  if (!title) return res.status(400).json({ error: 'Provide type and tmdb' })
  try {
    const info = await tmdbTitle(title.type, title.tmdb, TMDB_KEY)
    if (!info?.imdb) return res.json({ subtitles: [] })
    const kind = title.type === 'tv' ? 'series' : 'movie'
    const [answers, builtIn] = await Promise.all([
      addonStore.ask('subtitles', kind, mediaId(kind, info.imdb, title.season, title.episode)),
      builtInSubtitles({ type: title.type, imdb: info.imdb, season: title.season, episode: title.episode }),
    ])
    const subtitles = []
    const add = (entry) => {
      const id = newId()
      subtitleFiles.set(id, { url: entry.url, referer: entry.referer, lang: entry.lang, at: Date.now() })
      subtitles.push({ id, lang: entry.lang, language: entry.language, provider: entry.provider, release: (entry.release || []).slice(0, 6), rating: entry.rating || 0 })
    }
    for (const { addon, items } of answers) {
      for (const item of items) {
        if (!item || typeof item.url !== 'string' || !/^https?:\/\//i.test(item.url)) continue
        const { code, name } = languageOf(item.lang)
        add({ url: item.url, lang: code, language: name, provider: addon.name })
      }
    }
    for (const entry of builtIn) add({ ...entry, language: languageOf(entry.lang).name })
    res.json({ subtitles })
  } catch (err) {
    console.error('[subtitles]', err.message)
    res.status(502).json({ error: err.message })
  }
})

/** One subtitle file as UTF-8 text (SRT or WebVTT; the player reads both), unzipped if need be. */
app.get('/subtitle/:id', requireAllowedOrigin, async (req, res) => {
  const file = subtitleFiles.get(String(req.params.id))
  if (!file) return res.status(404).json({ error: 'Unknown subtitle' })
  try {
    if (file.text == null) file.text = decodeSubtitle(await downloadSubtitle(file.url, { referer: file.referer }), file.lang)
    res.set('Cache-Control', 'no-store')
    res.type('text/plain; charset=utf-8').send(file.text)
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
})

/** Translate a batch of subtitle lines: { to, lines } → { lines } (see translate.js). */
app.post('/translate', requireAllowedOrigin, async (req, res) => {
  const { to, lines } = req.body ?? {}
  if (!Object.hasOwn(TARGETS, to)) return res.status(400).json({ error: 'Unknown language' })
  if (!Array.isArray(lines) || !lines.length || lines.length > MAX_LINES || !lines.every((l) => typeof l === 'string')) {
    return res.status(400).json({ error: `Send 1 to ${MAX_LINES} lines` })
  }
  if (lines.reduce((n, l) => n + l.length, 0) > MAX_CHARS) return res.status(413).json({ error: 'Too much text at once' })
  try {
    res.json({ lines: await translateLines(lines, to) })
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
})

// ---- what the player remembers (see state.js) -------------------------------------------------

const stateStore = createStateStore(DATA_DIR)

/** The preferences, and where the viewer stopped in ?key= ('movie:550', 'tv:1399:1:2'). */
app.get('/state', requireAllowedOrigin, (req, res) => {
  const key = String(req.query.key || '')
  res.json({ prefs: stateStore.prefs(), progress: isTitleKey(key) ? stateStore.progress(key) : null })
})

app.put('/prefs', requireAllowedOrigin, (req, res) => {
  res.json({ prefs: stateStore.setPrefs(req.body) })
})

app.put('/progress/:key', requireAllowedOrigin, (req, res) => {
  const key = String(req.params.key)
  if (!isTitleKey(key)) return res.status(400).json({ error: 'Bad key' })
  stateStore.setProgress(key, Number(req.body?.t), Number(req.body?.d))
  res.json({ ok: true })
})

// ---- add-ons ----------------------------------------------------------------------------------

app.get('/addons', requireAllowedOrigin, async (_req, res) => {
  res.json({ addons: await addonStore.list() })
})

/** The ready list (extensions.json), each marked installed or not. */
app.get('/addons/catalog', requireAllowedOrigin, async (_req, res) => {
  res.json({ extensions: await addonStore.catalog() })
})

app.post('/addons', requireAllowedOrigin, async (req, res) => {
  try {
    const addon = await addonStore.install(req.body?.url)
    titleSources.clear()   // the next source list asks the new add-on too
    res.json({ addon })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

app.delete('/addons/:id', requireAllowedOrigin, async (req, res) => {
  const removed = await addonStore.remove(String(req.params.id))
  titleSources.clear()
  res.status(removed ? 200 : 404).json({ ok: removed })
})

/** Swarm stats for the embed's loading screen (peers, speed). Read-only, no input but a hash. */
app.get('/stats/:infoHash', (req, res) => {
  const entry = active.get(String(req.params.infoHash).toLowerCase())
  if (!entry) return res.status(404).json({ error: 'Not active' })
  const { torrent } = entry
  res.json({ peers: torrent.numPeers, downloadSpeed: Math.round(torrent.downloadSpeed), progress: torrent.progress })
})

// The player as an embed for the TunisiaFlicks site (a source in its player frame, desktop app only).
// Only the site's own origins (and loopback) may frame it — no other page can put it in an iframe.
const FRAME_ANCESTORS = ["'self'", 'http://127.0.0.1:*', 'http://localhost:*', ...ALLOWED_ORIGINS].join(' ')
const sendEmbed = (_req, res) => {
  res.set('Content-Security-Policy', `frame-ancestors ${FRAME_ANCESTORS}`)
  res.set('Cache-Control', 'no-store')
  res.sendFile(path.join(__dirname, 'views', 'embed.html'))
}
app.get('/embed/movie/:tmdb', sendEmbed)
app.get('/embed/tv/:tmdb/:season/:episode', sendEmbed)

// Minimal TMDB browse proxy for the desktop app's own page (keeps the key server-side).
app.get('/api/tmdb/:kind', requireAllowedOrigin, async (req, res) => {
  const { kind } = req.params   // 'trending' | 'search'
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
  const url = kind === 'search' && q
    ? `${TMDB_API}/search/movie?api_key=${TMDB_KEY}&query=${encodeURIComponent(q)}&include_adult=false`
    : `${TMDB_API}/trending/movie/week?api_key=${TMDB_KEY}`
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(12000) })
    const json = await r.json()
    res.json({ results: (json.results || []).map((m) => ({ id: m.id, title: m.title, year: (m.release_date || '').slice(0, 4), poster: m.poster_path, vote: m.vote_average })) })
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
})

/** Resolve :infoHash/:index to a torrent file, with bounds checks. */
async function resolveFile(req, res) {
  const { infoHash } = req.params
  const index = Number(req.params.index)
  let entry = active.get(infoHash)
  if (!entry) {
    if (!/^[0-9a-f]{40}$/i.test(infoHash)) { res.status(400).end(); return null }
    try { await getTorrent(infoHash); entry = active.get(infoHash) } catch (err) { res.status(502).send(err.message); return null }
  }
  if (!entry) { res.status(404).send('Torrent not found'); return null }
  touch(infoHash)
  if (!Number.isInteger(index) || index < 0 || index >= entry.torrent.files.length) { res.status(404).send('File not found'); return null }
  return { entry, file: entry.torrent.files[index], index }
}

/** Send a torrent file with HTTP Range support (206 / 416), for a <video> or a TV. HEAD too. */
function sendRange(req, res, file, mime, extraHeaders = {}) {
  const total = file.length
  const range = req.headers.range
  let start = 0
  let end = total - 1
  const headers = { 'Accept-Ranges': 'bytes', 'Content-Type': mime, 'Cache-Control': 'no-store', ...extraHeaders }
  if (range) {
    const match = /bytes=(\d*)-(\d*)/.exec(range)
    if (match) {
      if (match[1]) start = Number(match[1])
      if (match[2]) end = Number(match[2])
    }
    if (Number.isNaN(start) || Number.isNaN(end) || start > end || end >= total) {
      res.writeHead(416, { 'Content-Range': `bytes */${total}` })
      return res.end()
    }
    res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${total}`, 'Content-Length': end - start + 1 })
  } else {
    res.writeHead(200, { ...headers, 'Content-Length': total })
  }
  if (req.method === 'HEAD') return res.end()
  const stream = file.createReadStream({ start, end })
  stream.on('error', (err) => { console.error('[stream]', err.message); res.destroy() })
  res.on('close', () => stream.destroy())
  stream.pipe(res)
}

// DIRECT path: native byte-range streaming (fast start + instant seek). Used for H.264/AAC MP4.
app.get('/stream/:infoHash/:index', async (req, res) => {
  const found = await resolveFile(req, res)
  if (!found) return
  const { file } = found
  file.select()
  sendRange(req, res, file, 'video/mp4')
})

/** The start time a converted stream was asked for (?t=seconds), or 0. */
const startOf = (req) => Math.max(0, Math.min(24 * 3600, Math.round((Number(req.query.t) || 0) * 1000) / 1000))
/** The audio track asked for (?audio=, 0 = the first). */
const audioOf = (req, info) => {
  const n = Math.floor(Number(req.query.audio) || 0)
  return n > 0 && n < (info.audioTracks?.length || 0) ? n : 0
}

/** The keyframe at or before `t` in a file (a remux can only start on one), or `t` if unknown. */
function keyframeAt(input, t) {
  return new Promise((resolve) => {
    let out = ''
    const ff = spawn(FFPROBE, ['-v', 'error', '-protocol_whitelist', 'http,https,tcp,tls,crypto', '-read_intervals', `${t}%+#1`,
      '-select_streams', 'v:0', '-show_entries', 'packet=pts_time,flags', '-of', 'csv=p=0', '-i', input])
    const timer = setTimeout(() => { try { ff.kill('SIGKILL') } catch {} ; resolve(t) }, 15000)
    ff.stdout.on('data', (d) => { out += d })
    ff.on('error', () => { clearTimeout(timer); resolve(t) })
    ff.on('close', () => {
      clearTimeout(timer)
      const line = out.split('\n').find((l) => /,K/.test(l)) || out.split('\n')[0]
      const pts = Number(String(line || '').split(',')[0])
      resolve(Number.isFinite(pts) && pts >= 0 && pts <= t + 0.001 ? pts : t)
    })
  })
}

/** Where a converted stream asked to start at ?t= really starts: { start } (see ffmpegArgs). */
async function seekPoint(info, input, t) {
  if (!(t > 0) || info.decision !== 'remux') return { start: t }
  return { start: await keyframeAt(input, t) }
}

app.get('/seek/u/:id', async (req, res) => {
  const source = sources.get(String(req.params.id))
  if (!source || source.kind !== 'url' || !source.analysis) return res.status(404).json({ error: 'Unknown source' })
  res.json(await seekPoint(withAudio(source.analysis, audioOf(req, source.analysis)), source.url, startOf(req)))
})

app.get('/seek/:infoHash/:index', async (req, res) => {
  const found = await resolveFile(req, res)
  if (!found) return
  const { entry, index } = found
  const probed = await analysisFor(entry, index)
  const info = withAudio(probed, audioOf(req, probed))
  res.json(await seekPoint(info, `http://127.0.0.1:${server.address().port}/stream/${entry.torrent.infoHash}/${index}`, startOf(req)))
})

/** Run ffmpeg into the response (a progressive fragmented MP4), stopping it when the viewer leaves. */
function sendConverted(res, args, input = null) {
  res.writeHead(200, { 'Content-Type': 'video/mp4', 'Cache-Control': 'no-store', 'Accept-Ranges': 'none' })
  const ff = spawn(FFMPEG, args)
  const cleanup = () => { try { input?.destroy() } catch {} ; try { ff.kill('SIGKILL') } catch {} }
  input?.on('error', cleanup)
  ff.stdin.on('error', () => {})       // EPIPE when ffmpeg exits before input ends
  ff.stderr.on('data', (d) => console.error('[ffmpeg]', d.toString().trim()))
  ff.on('error', (err) => { console.error('[ffmpeg spawn]', err.message); try { res.destroy() } catch {} })
  ff.on('close', () => { try { res.end() } catch {} })
  res.on('close', cleanup)            // viewer paused/closed/seeked away → stop burning CPU
  if (input) input.pipe(ff.stdin)
  else ff.stdin.end()
  ff.stdout.pipe(res)
}

// REMUX / TRANSCODE path: ffmpeg → progressive fragmented MP4. Plays MKV/AC3/HEVC that <video>
// can't. Progressive (no byte-range): to seek, the player asks again with ?t=<seconds>, and ffmpeg
// starts there, reading the file through our own byte-range /stream so it can jump straight to it.
// ?audio=<n> plays another audio track (a dubbed version).
app.get('/play/:infoHash/:index', async (req, res) => {
  const found = await resolveFile(req, res)
  if (!found) return
  const { entry, file, index } = found
  file.select()

  // Another audio track than the first (a dubbed version) makes even a direct file a remux.
  const probed = await analysisFor(entry, index)
  const info = withAudio(probed, audioOf(req, probed))
  if (info.decision === 'direct') {
    // Nothing to convert — hand off to the seekable path.
    return res.redirect(302, `/stream/${req.params.infoHash}/${index}`)
  }

  const start = startOf(req)
  if (start > 0) {
    const self = `http://127.0.0.1:${server.address().port}/stream/${entry.torrent.infoHash}/${index}`
    return sendConverted(res, ffmpegArgs(info, TRANSCODE_MAXHEIGHT, { input: self, start }))
  }
  sendConverted(res, ffmpegArgs(info, TRANSCODE_MAXHEIGHT), file.createReadStream())
})

// An add-on's direct link that a browser can't play as it is (MKV, HEVC…): converted the same way,
// ffmpeg reading the link itself (seekable with ?t=). Only links an add-on gave, by their id.
app.get('/uplay/:id', async (req, res) => {
  const source = sources.get(String(req.params.id))
  if (!source || source.kind !== 'url') return res.status(404).end()
  source.at = Date.now()
  if (!source.analysis) {
    const probe = await probeUrl(source.url)
    const info = analyze(probe, new URL(source.url).pathname)
    if (!probe) return res.status(502).end()
    source.analysis = info
  }
  const info = withAudio(source.analysis, audioOf(req, source.analysis))
  if (info.decision === 'direct') return res.redirect(302, source.url)
  sendConverted(res, ffmpegArgs(info, TRANSCODE_MAXHEIGHT, { input: source.url, start: startOf(req) }))
})

// ---- Play on TV (DLNA) --------------------------------------------------------------------------
//
// The TV fetches the video from this machine, so for this one thing the player answers on the home
// network: a separate small server on the LAN address the TV was found from, serving only
// /media/<token>/<name>, where the token is a random 256-bit secret made for that one cast and
// dropped when it stops. Everything else (driving the engine, the API) stays loopback-only.
//
// The TV gets the original file, never a conversion: TVs decode MKV, HEVC, AC3 and DTS in hardware,
// so even the copies a browser can't play go straight through, seekable, with no CPU spent.

const MIME = {
  '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.mkv': 'video/x-matroska', '.webm': 'video/webm',
  '.mov': 'video/quicktime', '.avi': 'video/x-msvideo', '.ts': 'video/mp2t', '.wmv': 'video/x-ms-wmv',
  '.flv': 'video/x-flv', '.ogv': 'video/ogg',
}
const mimeOf = (name) => MIME[path.extname(name).toLowerCase()] || 'video/mp4'

const devices = new Map()      // id -> TV, only ever from our own discovery
const casts = new Map()        // token -> { infoHash, index, device }
const lanServers = new Map()   // our LAN address -> Promise<port>

function lanServer(address) {
  if (!lanServers.has(address)) {
    const started = new Promise((resolve, reject) => {
      const srv = http.createServer((req, res) => {
        const match = /^\/media\/([0-9a-f]{64})\/[^/]*$/.exec((req.url || '').split('?')[0])
        const cast = match && casts.get(match[1])
        if (!cast || (req.method !== 'GET' && req.method !== 'HEAD')) { res.writeHead(404); return res.end() }
        const entry = active.get(cast.infoHash)
        if (!entry) { res.writeHead(410); return res.end() }
        touch(cast.infoHash)
        const file = entry.torrent.files[cast.index]
        file.select()
        sendRange(req, res, file, mimeOf(file.name), { 'transferMode.dlna.org': 'Streaming', 'contentFeatures.dlna.org': dlna.DLNA_FEATURES })
      })
      srv.on('error', reject)
      srv.listen(0, address, () => resolve(srv.address().port))
    })
    started.catch(() => lanServers.delete(address))
    lanServers.set(address, started)
  }
  return lanServers.get(address)
}

/** The TVs on the home network that can play a video sent to them. */
app.get('/cast/devices', requireAllowedOrigin, async (_req, res) => {
  try {
    const found = await dlna.discover()
    for (const device of found) devices.set(device.id, device)
    res.json({ devices: found.map((d) => ({ id: d.id, name: d.name, model: [d.manufacturer, d.model].filter(Boolean).join(' ') })) })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/** Send a file of an active swarm to a TV: { deviceId, infoHash, index, title, position }. */
app.post('/cast/start', requireAllowedOrigin, async (req, res) => {
  const { deviceId, infoHash, index, title, position } = req.body ?? {}
  const device = devices.get(deviceId)
  if (!device) return res.status(404).json({ error: 'That TV is gone. Search again.' })
  const entry = typeof infoHash === 'string' ? active.get(infoHash.toLowerCase()) : null
  const i = Number(index)
  if (!entry || !Number.isInteger(i) || i < 0 || i >= entry.torrent.files.length) return res.status(404).json({ error: 'Nothing playing to send' })
  try {
    const port = await lanServer(device.localAddress)
    const token = crypto.randomBytes(32).toString('hex')
    const file = entry.torrent.files[i]
    for (const [other, cast] of casts) if (cast.device.id === device.id) casts.delete(other)   // one video per TV
    casts.set(token, { infoHash: entry.torrent.infoHash, index: i, device })
    const url = `http://${device.localAddress}:${port}/media/${token}/${encodeURIComponent(file.name)}`
    await dlna.load(device, { url, title: String(title || file.name).slice(0, 200), mime: mimeOf(file.name), size: file.length })
    // Pick up where the viewer was (a TV only seeks once it's playing).
    if (Number(position) > 5) setTimeout(() => dlna.seek(device, Number(position)).catch(() => {}), 3000)
    res.json({ cast: token, device: device.name })
  } catch (err) {
    console.error('[cast]', err.message)
    res.status(502).json({ error: err.message })
  }
})

function castFor(req, res) {
  const cast = casts.get(String(req.params.cast))
  if (!cast) res.status(404).json({ error: 'Not casting' })
  return cast
}

/** Where the TV is (the player polls this while casting; it also keeps the swarm alive). */
app.get('/cast/:cast/status', requireAllowedOrigin, async (req, res) => {
  const cast = castFor(req, res)
  if (!cast) return
  touch(cast.infoHash)
  try { res.json(await dlna.status(cast.device)) } catch (err) { res.status(502).json({ error: err.message }) }
})

/** play | pause | seek ({ position }) | stop. */
app.post('/cast/:cast/:action', requireAllowedOrigin, async (req, res) => {
  const cast = castFor(req, res)
  if (!cast) return
  const { device } = cast
  try {
    switch (req.params.action) {
      case 'play': await dlna.play(device); break
      case 'pause': await dlna.pause(device); break
      case 'seek': await dlna.seek(device, Math.max(0, Number(req.body?.position) || 0)); break
      case 'stop':
        casts.delete(String(req.params.cast))
        await dlna.stop(device).catch(() => {})
        break
      default: return res.status(400).json({ error: 'Unknown action' })
    }
    res.json({ ok: true })
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
})

app.use(express.static(path.join(__dirname, 'public')))

const server = app.listen(PORT, HOST, () => {
  console.log(`player-service on http://${HOST}:${PORT}  (ffmpeg: ${path.basename(FFMPEG)})`)
})

function shutdown() {
  console.log('\nshutting down…')
  server.close()
  client.destroy(() => process.exit(0))
  setTimeout(() => process.exit(0), 3000).unref()
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
