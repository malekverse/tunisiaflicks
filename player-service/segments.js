// Skip intro, skip recap, and when the credits start (for "Next episode"), for an episode of a show.
//
// Two ways, the first that knows wins:
// 1. TheIntroDB (theintrodb.org): a free, community-made database of intro, recap and credits times
//    by TMDB id, season and episode. Only those three numbers are sent.
// 2. What this player learned itself: shows the database doesn't know (Ramadan and Tunisian series
//    among them) open every episode with the same title song. The player listens to the first minutes
//    of each episode watched from the start (ffmpeg, as for auto-sync), keeps a small audio
//    fingerprint of them (DATA_DIR/intros/<tmdb>.json), and finds the stretch two episodes share:
//    that's the intro. So it works from the second episode on.
//
// The fingerprint is the classic one (Haitsma and Kalker): 8 frames a second, and per frame 32 bits,
// each saying whether the energy difference between two neighbouring frequency bands rose or fell
// since the frame before (in log energy, so loudness doesn't change it): the same music gives the same
// bits, wherever it is in the episode.

import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

// ---- 1. TheIntroDB ------------------------------------------------------------------------------

const INTRODB = 'https://api.theintrodb.org/v2/media'
const DB_TTL = 12 * 60 * 60 * 1000
const DB_MISS_TTL = 60 * 60 * 1000
const dbCache = new Map() // 'tmdb:s:e' -> { at, value }

/** A segment as [start, end] seconds, from TheIntroDB's { start_ms, end_ms } (null end: till the end). */
function span(item, { maxLength = 300 } = {}) {
  if (!item || typeof item !== 'object') return null
  const start = item.start_ms == null ? 0 : Number(item.start_ms) / 1000
  const end = item.end_ms == null ? null : Number(item.end_ms) / 1000
  if (!Number.isFinite(start) || start < 0) return null
  if (end === null) return [start, null]
  if (!Number.isFinite(end) || end - start < 3 || end - start > maxLength) return null
  return [Math.round(start * 10) / 10, Math.round(end * 10) / 10]
}

/** TheIntroDB's answer → { intro, recap, credits } (intro and recap [start, end], credits a start). */
export function fromIntroDb(body) {
  const first = (list, opts) => (Array.isArray(list) ? list.map((item) => span(item, opts)).find(Boolean) ?? null : null)
  const intro = first(body?.intro)
  const recap = first(body?.recap)
  const credits = first(body?.credits, { maxLength: 1e6 })
  return {
    intro: intro && intro[1] !== null ? intro : null,
    recap: recap && recap[1] !== null ? recap : null,
    credits: credits ? credits[0] : null,
  }
}

export async function introDb(tmdb, season, episode, { fetchImpl = fetch } = {}) {
  const key = `${tmdb}:${season}:${episode}`
  const hit = dbCache.get(key)
  if (hit && Date.now() - hit.at < (hit.value ? DB_TTL : DB_MISS_TTL)) return hit.value
  let value = null
  try {
    const q = new URLSearchParams({ tmdb_id: String(tmdb), season: String(season), episode: String(episode) })
    const res = await fetchImpl(`${INTRODB}?${q}`, { headers: { 'User-Agent': 'TunisiaFlicks-Player' }, signal: AbortSignal.timeout(8000) })
    if (res.ok) {
      const found = fromIntroDb(await res.json())
      if (found.intro || found.recap || found.credits !== null) value = found
    }
  } catch {}
  dbCache.set(key, { at: Date.now(), value })
  if (dbCache.size > 500) dbCache.delete(dbCache.keys().next().value)
  return value
}

// ---- 2. Learning: the fingerprint ------------------------------------------------------------------

export const RATE = 8000
export const HOP = 1000                    // samples: 8 frames a second
export const FPS = RATE / HOP
const SIZE = 2048                          // the FFT's window (256 ms): two frames' windows overlap, so
                                           // the same sound heard a few ms apart still hashes alike
const BANDS = 33                           // 32 differences, so 32 bits
const SILENT_RMS = 120                     // of 32768: quieter frames count as silence (hash 0)

const hann = Float64Array.from({ length: SIZE }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (SIZE - 1)))
// Band edges, spaced evenly on a log scale from 250 Hz to 3.5 kHz (the voice and the melody).
const EDGES = Array.from({ length: BANDS + 1 }, (_, i) => Math.round((250 * Math.pow(3500 / 250, i / BANDS)) / (RATE / SIZE)))
const cosT = Float64Array.from({ length: SIZE / 2 }, (_, i) => Math.cos((-2 * Math.PI * i) / SIZE))
const sinT = Float64Array.from({ length: SIZE / 2 }, (_, i) => Math.sin((-2 * Math.PI * i) / SIZE))
const rev = Uint16Array.from({ length: SIZE }, (_, i) => { let r = 0; for (let b = 1, x = i; b < SIZE; b <<= 1, x >>= 1) r = (r << 1) | (x & 1); return r })

/** In-place radix-2 FFT of (re, im), SIZE points. */
function fft(re, im) {
  for (let i = 0; i < SIZE; i++) {
    const j = rev[i]
    if (j > i) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t }
  }
  for (let len = 2; len <= SIZE; len <<= 1) {
    const half = len >> 1, step = SIZE / len
    for (let i = 0; i < SIZE; i += len) {
      for (let k = 0; k < half; k++) {
        const c = cosT[k * step], s = sinT[k * step]
        const a = i + k, b = a + half
        const tr = re[b] * c - im[b] * s, ti = re[b] * s + im[b] * c
        re[b] = re[a] - tr; im[b] = im[a] - ti
        re[a] += tr; im[a] += ti
      }
    }
  }
}

/**
 * 16-bit mono PCM at 8 kHz → one 32-bit hash per 1/8 s (0 for a silent frame), the frames starting
 * `phase` samples in.
 */
export function fingerprint(samples, phase = 0) {
  const frames = Math.max(0, Math.floor((samples.length - phase - SIZE) / HOP) + 1)
  const out = new Uint32Array(frames)
  const re = new Float64Array(SIZE), im = new Float64Array(SIZE)
  let prev = null
  for (let f = 0; f < frames; f++) {
    const at = phase + f * HOP
    let power = 0
    for (let i = 0; i < SIZE; i++) { const x = samples[at + i]; power += x * x; re[i] = x * hann[i]; im[i] = 0 }
    if (Math.sqrt(power / SIZE) < SILENT_RMS) { out[f] = 0; prev = null; continue }
    fft(re, im)
    const energy = new Float64Array(BANDS)
    for (let b = 0; b < BANDS; b++) {
      let e = 0
      for (let k = EDGES[b]; k < EDGES[b + 1]; k++) e += re[k] * re[k] + im[k] * im[k]
      energy[b] = Math.log(e + 1)   // in logs, a louder frame is the same frame: only the shape counts
    }
    // The first frame after a silence has nothing to compare with: it counts as silence too.
    let hash = 0
    if (prev) for (let b = 0; b < 32; b++) if ((energy[b] - energy[b + 1]) - (prev[b] - prev[b + 1]) > 0) hash |= (1 << b)
    out[f] = prev ? ((hash >>> 0) || 1) : 0
    prev = energy
  }
  return out
}

/** Both halves of the frame (two episodes' frames never line up exactly; the closer half wins). */
const halves = (samples) => ({ fp: fingerprint(samples), alt: fingerprint(samples, HOP / 2) })

// ---- 2. Learning: two episodes' shared stretch -----------------------------------------------------

const popcount = (x) => { x -= (x >>> 1) & 0x55555555; x = (x & 0x33333333) + ((x >>> 2) & 0x33333333); return (((x + (x >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24 }

/**
 * The longest stretch `a` and `b` share (in seconds, in each), when it's intro-like: `minLength` to
 * `maxLength` long. Frame by frame, the same sound differs in a few of its 32 bits and unrelated
 * sound in about half; so a stretch is shared where the bits differing, averaged over `window`
 * seconds, stay at most `threshold` (unrelated sound averages 16). Null when there's none.
 * Async: it yields now and then, so the player keeps streaming while it compares.
 */
export async function sharedStretch(a, b, { minLength = 15, maxLength = 200, window = 3, threshold = 12, gap = 1.5 } = {}) {
  const minFrames = minLength * FPS, maxFrames = maxLength * FPS, gapFrames = gap * FPS, W = window * FPS
  const ring = new Int8Array(W)
  let best = null
  let n = 0
  for (let shift = -(b.length - minFrames); shift <= a.length - minFrames; shift++) {
    if (++n % 300 === 0) await new Promise((resolve) => setImmediate(resolve))
    // a[i] lines up with b[i - shift].
    const from = Math.max(0, shift), to = Math.min(a.length, b.length + shift)
    const err = (i) => (a[i] && b[i - shift] ? popcount(a[i] ^ b[i - shift]) : 99)
    ring.fill(-1)
    let sum = 0, valid = 0, first = -1, last = -1
    const close = () => {
      if (first < 0) return
      // The windows that averaged well reach back a window's length: trim to frames alike at both ends.
      let s0 = Math.max(from, first - W + 1), s1 = last
      while (s0 < s1 && err(s0) > threshold) s0++
      while (s1 > s0 && err(s1) > threshold) s1--
      const length = s1 - s0 + 1
      if (length >= minFrames && length <= maxFrames && (!best || length > best.length)) best = { length, a: s0, b: s0 - shift }
      first = -1
    }
    for (let i = from; i < to; i++) {
      const k = (i - from) % W
      if (ring[k] >= 0) { sum -= ring[k]; valid-- }
      const e = err(i)
      ring[k] = e === 99 ? -1 : e
      if (e !== 99) { sum += e; valid++ }
      const good = i - from >= W - 1 && valid * 3 >= W && sum <= threshold * valid
      if (good) {
        if (first < 0) first = i
        last = i
      } else if (first >= 0 && i - last > gapFrames) close()
    }
    close()
  }
  if (!best) return null
  const round = (frames) => Math.round((frames / FPS) * 10) / 10
  return { a: [round(best.a), round(best.a + best.length)], b: [round(best.b), round(best.b + best.length)] }
}

/**
 * The intro of an episode from the stretches it shares with others: the one most of them agree on
 * (overlapping by half or more), the longest when they don't.
 */
export function agree(stretches) {
  const list = stretches.filter(Boolean)
  if (!list.length) return null
  const overlap = ([a0, a1], [b0, b1]) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0)) / Math.min(a1 - a0, b1 - b0)
  let best = null
  for (const s of list) {
    const votes = list.filter((other) => overlap(s, other) >= 0.5).length
    const length = s[1] - s[0]
    if (!best || votes > best.votes || (votes === best.votes && length > best.length)) best = { span: s, votes, length }
  }
  return best.span
}

// ---- 2. Learning: what's kept ------------------------------------------------------------------------

const KEEP = 10   // episodes kept per show

const toBase64 = (fp) => Buffer.from(fp.buffer, fp.byteOffset, fp.byteLength).toString('base64')
const fromBase64 = (text) => { const b = Buffer.from(text, 'base64'); return new Uint32Array(b.buffer.slice(b.byteOffset, b.byteOffset + (b.byteLength & ~3))) }

export function createIntroStore(dataDir) {
  const dir = path.join(dataDir, 'intros')
  const fileOf = (tmdb) => path.join(dir, `${String(tmdb).replace(/\D/g, '')}.json`)
  const read = (tmdb) => { try { return JSON.parse(fs.readFileSync(fileOf(tmdb), 'utf8')) } catch { return { episodes: {} } } }
  const write = (tmdb, doc) => {
    const keys = Object.keys(doc.episodes).sort((x, y) => (doc.episodes[y].at || 0) - (doc.episodes[x].at || 0))
    for (const key of keys.slice(KEEP)) delete doc.episodes[key]
    fs.mkdirSync(dir, { recursive: true })
    const tmp = `${fileOf(tmdb)}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(doc))
    fs.renameSync(tmp, fileOf(tmdb))
  }
  return {
    /** What was learned about an episode: { intro } or null. */
    learned(tmdb, season, episode) {
      const item = read(tmdb).episodes[`${season}:${episode}`]
      return item?.intro ? { intro: item.intro } : null
    },
    /** The other episodes' fingerprints, the same season's nearest first. */
    references(tmdb, season, episode) {
      const doc = read(tmdb)
      return Object.entries(doc.episodes)
        .filter(([key, item]) => key !== `${season}:${episode}` && item.fp)
        .map(([key, item]) => { const [s, e] = key.split(':').map(Number); return { key, s, e, fp: fromBase64(item.fp), intro: item.intro || null } })
        .sort((x, y) => (x.s === season ? 0 : 1) - (y.s === season ? 0 : 1) || Math.abs(x.s - season) - Math.abs(y.s - season) || Math.abs(x.e - episode) - Math.abs(y.e - episode))
    },
    save(tmdb, season, episode, { fp, intro }) {
      const doc = read(tmdb)
      const key = `${season}:${episode}`
      const item = doc.episodes[key] || {}
      if (fp) item.fp = toBase64(fp)
      if (intro !== undefined) item.intro = intro
      item.at = Date.now()
      doc.episodes[key] = item
      write(tmdb, doc)
    },
    /** A reference's intro, found while comparing (it didn't know it yet). */
    teach(tmdb, key, intro) {
      const doc = read(tmdb)
      if (!doc.episodes[key] || doc.episodes[key].intro) return
      doc.episodes[key].intro = intro
      write(tmdb, doc)
    },
  }
}

/** When an episode's start is compared while it's heard: at 2.5, 5 and 8 minutes in. */
export const CHECKPOINTS = [150, 300, 480]

/**
 * Learn an episode's intro: listen to its first minutes in one go (ffmpeg, as fast as the file
 * arrives), and at each checkpoint compare what's been heard with the episodes heard before; stop
 * once an intro is found that ends before what's been heard. Keeps the fingerprint either way (the
 * next episode needs it). Resolves to the intro ([start, end]) or null.
 */
export async function learnIntro({ store, ffmpeg, input, audio = 0, tmdb, season, episode, checkpoints = CHECKPOINTS, timeoutMs = 8 * 60 * 1000 }) {
  const refs = store.references(tmdb, season, episode).slice(0, 3)
  const total = checkpoints[checkpoints.length - 1]
  const ff = spawn(ffmpeg, [
    '-hide_banner', '-nostats', '-loglevel', 'error', '-protocol_whitelist', 'file,http,https,tcp,tls,crypto',
    '-t', String(total), '-i', input,
    '-map', `0:a:${audio}`, '-vn', '-ac', '1', '-ar', String(RATE), '-f', 's16le', '-',
  ])
  ff.on('error', () => {})
  ff.stderr.on('data', () => {})
  const timer = setTimeout(() => { try { ff.kill('SIGKILL') } catch {} }, timeoutMs)

  const chunks = []
  let size = 0
  /** Compare what's been heard; the intro once it's sure (it ends before what's been heard). */
  const check = async (final) => {
    const buffer = Buffer.concat(chunks, size)
    const samples = new Int16Array(buffer.buffer, buffer.byteOffset, Math.floor(size / 2))
    const { fp, alt } = halves(samples)
    if (fp.length < 10 * FPS) return null
    store.save(tmdb, season, episode, { fp })
    if (!refs.length) return null
    const shares = []
    for (const ref of refs) {
      const [x, y] = [await sharedStretch(fp, ref.fp), await sharedStretch(alt, ref.fp)]
      shares.push(!x ? y : !y ? x : (y.a[1] - y.a[0] > x.a[1] - x.a[0] ? y : x))
    }
    const intro = agree(shares.map((share) => share?.a ?? null))
    const heard = fp.length / FPS
    if (!intro || (!final && intro[1] >= heard - 3)) return null
    store.save(tmdb, season, episode, { intro })
    // The episodes compared with learn theirs too (the stretch they share with this one's intro).
    refs.forEach((ref, i) => { const share = shares[i]; if (share && !ref.intro && Math.min(share.a[1], intro[1]) - Math.max(share.a[0], intro[0]) > 0) store.teach(tmdb, ref.key, share.b) })
    return intro
  }

  let next = 0
  try {
    for await (const data of ff.stdout) {
      chunks.push(data)
      size += data.length
      if (next < checkpoints.length - 1 && size >= checkpoints[next] * RATE * 2) {
        next++
        const intro = await check(false)
        if (intro) return intro
      }
    }
    return await check(true)
  } finally {
    clearTimeout(timer)
    try { ff.kill('SIGKILL') } catch {}
  }
}
