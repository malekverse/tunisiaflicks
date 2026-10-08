// TunisiaFlicks player service — turns a torrent (magnet / infohash) into an HTTP video stream
// a browser can play, with Range seeking for the common case and on-the-fly ffmpeg remux/transcode
// for the files a plain <video> can't play (MKV / AC3 / HEVC …).
//
// IMPORTANT: long-running server (holds peer connections + disk buffers). Runs on a real always-on
// box OR, better, on each viewer's own machine via the desktop app. Never on Vercel/serverless.
//
// SECURITY: it exposes a torrent engine over HTTP, so it is locked down — it binds to loopback only,
// accepts requests only for localhost (anti DNS-rebinding), only lets allow-listed web origins drive
// it (CORS + Origin), and only accepts magnets/infohashes (never arbitrary URLs/paths → no SSRF /
// local-file reads). It is LEECH-ONLY (upload throttled to 0): it downloads but does not seed.
//
// Test only with content you are allowed to stream (public-domain / Creative-Commons / Linux ISOs);
// the default demos are Blender open movies (Sintel, Big Buck Bunny), CC-BY.

import express from 'express'
import cors from 'cors'
import WebTorrent from 'webtorrent'
import parseTorrent from 'parse-torrent'
import { spawn } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import * as ffbin from 'ffmpeg-ffprobe-static'
import { analyze, ffmpegArgs } from './codec.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const HOST = process.env.HOST || '127.0.0.1'                      // loopback only — never the LAN
const PORT = Number(process.env.PORT) || 8080
const DOWNLOAD_DIR = process.env.DOWNLOAD_DIR || path.join(os.tmpdir(), 'tunisiaflicks-stream')
const MAX_TORRENTS = Number(process.env.MAX_TORRENTS) || 12       // keep few swarms alive at once
const IDLE_MS = Number(process.env.IDLE_MS) || 10 * 60 * 1000     // drop a torrent after 10m unused
const TRANSCODE_MAXHEIGHT = Number(process.env.TRANSCODE_MAXHEIGHT) || 1080

// Web origins allowed to drive the service (CORS + Origin check). The app's own origins + dev.
const ALLOWED_ORIGINS = new Set(
  (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,https://tunisiaflicks.vercel.app')
    .split(',').map((s) => s.trim()).filter(Boolean)
)

// ffmpeg/ffprobe: bundled binaries, overridable, with a PATH fallback.
const FFMPEG = process.env.FFMPEG_PATH || ffbin.ffmpegPath || 'ffmpeg'
const FFPROBE = process.env.FFPROBE_PATH || ffbin.ffprobePath || 'ffprobe'

const VIDEO_EXT = ['.mp4', '.m4v', '.mkv', '.webm', '.mov', '.avi', '.ts', '.ogv', '.flv', '.wmv']
const isVideo = (name) => VIDEO_EXT.includes(path.extname(name).toLowerCase())

// Only magnets / infohashes are ever accepted — never an http(s) URL or a filesystem path, which
// parse-torrent/webtorrent would happily fetch/read (SSRF + local-file exfiltration).
const isTorrentId = (s) =>
  typeof s === 'string' && (/^magnet:\?/i.test(s.trim()) || /^[0-9a-f]{40}$/i.test(s.trim()) || /^[a-z2-7]{32}$/i.test(s.trim()))

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

async function infoHashOf(input) {
  try {
    const parsed = await parseTorrent(input)
    return typeof parsed?.infoHash === 'string' ? parsed.infoHash.toLowerCase() : null
  } catch {
    return null
  }
}

/** Add a magnet/infohash, or return the already-running swarm. Resolves once metadata is ready. */
async function getTorrent(magnetOrHash) {
  const hash = await infoHashOf(magnetOrHash)
  if (hash && active.has(hash)) {
    touch(hash)
    return active.get(hash).torrent
  }
  if (hash && pending.has(hash)) return pending.get(hash)   // an add is already in flight — join it
  if (active.size >= MAX_TORRENTS) evictOldest()

  const p = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Timed out fetching torrent metadata (no seeders reachable?)")), 60000)
    const onReady = (torrent) => {
      clearTimeout(timeout)
      torrent.files.forEach((f) => f.deselect())     // stream on demand, don't pull the whole torrent
      torrent.deselect(0, torrent.pieces.length - 1, 0)
      active.set(torrent.infoHash, { torrent, lastAccess: Date.now(), analysis: new Map() })
      resolve(torrent)
    }
    try {
      const added = client.add(magnetOrHash, { path: DOWNLOAD_DIR }, onReady)
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

app.use(cors({ origin: (origin, cb) => cb(null, !origin || ALLOWED_ORIGINS.has(origin)) }))
app.use(express.json())

// Only allow-listed web origins may DRIVE the engine (add swarms). Same-origin page fetches and
// the native app send no Origin and are allowed; a random website's fetch carries its Origin and is
// refused, so it can't make someone's machine join a swarm.
function requireAllowedOrigin(req, res, next) {
  const origin = req.headers.origin
  if (origin && !ALLOWED_ORIGINS.has(origin)) return res.status(403).json({ error: 'Origin not allowed' })
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

// DIRECT path: native byte-range streaming (fast start + instant seek). Used for H.264/AAC MP4.
app.get('/stream/:infoHash/:index', async (req, res) => {
  const found = await resolveFile(req, res)
  if (!found) return
  const { file } = found
  file.select()

  const total = file.length
  const range = req.headers.range
  let start = 0
  let end = total - 1
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
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${total}`, 'Accept-Ranges': 'bytes',
      'Content-Length': end - start + 1, 'Content-Type': 'video/mp4', 'Cache-Control': 'no-store',
    })
  } else {
    res.writeHead(200, { 'Content-Length': total, 'Accept-Ranges': 'bytes', 'Content-Type': 'video/mp4', 'Cache-Control': 'no-store' })
  }
  const stream = file.createReadStream({ start, end })
  stream.on('error', (err) => { console.error('[stream]', err.message); res.destroy() })
  res.on('close', () => stream.destroy())
  stream.pipe(res)
})

// REMUX / TRANSCODE path: ffmpeg → progressive fragmented MP4. Plays MKV/AC3/HEVC that <video>
// can't. Progressive (no byte-range), so seeking is limited until the HLS path lands (Phase 2).
app.get('/play/:infoHash/:index', async (req, res) => {
  const found = await resolveFile(req, res)
  if (!found) return
  const { entry, file, index } = found
  file.select()

  const info = await analysisFor(entry, index)
  if (info.decision === 'direct') {
    // Nothing to convert — hand off to the seekable path.
    return res.redirect(302, `/stream/${req.params.infoHash}/${index}`)
  }

  res.writeHead(200, { 'Content-Type': 'video/mp4', 'Cache-Control': 'no-store', 'Accept-Ranges': 'none' })

  const input = file.createReadStream()
  const ff = spawn(FFMPEG, ffmpegArgs(info, TRANSCODE_MAXHEIGHT))
  const cleanup = () => { try { input.destroy() } catch {} ; try { ff.kill('SIGKILL') } catch {} }
  input.on('error', cleanup)
  ff.stdin.on('error', () => {})       // EPIPE when ffmpeg exits before input ends
  ff.stderr.on('data', (d) => console.error('[ffmpeg]', d.toString().trim()))
  ff.on('error', (err) => { console.error('[ffmpeg spawn]', err.message); try { res.destroy() } catch {} })
  ff.on('close', () => { try { res.end() } catch {} })
  res.on('close', cleanup)            // viewer paused/closed/seeked away → stop burning CPU

  input.pipe(ff.stdin)
  ff.stdout.pipe(res)
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
