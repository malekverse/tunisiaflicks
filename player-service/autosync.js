// Subtitle auto-sync: line a subtitle up with the film it's shown on. ffmpeg listens to a few
// minutes of the film's audio around where the viewer is and marks where someone is speaking
// (speechSegments); then the subtitle's lines are slid along (and, for a release made at another
// frame rate, stretched) until they cover that speech best (bestFit). Pure except speechSegments.
//
// What's fixed: a subtitle that's early or late by up to 40 seconds, and one made for a 25 fps
// release played on a 23.976 one (or the reverse), which drifts further every minute.

import { spawn } from 'node:child_process'

/** Frame-rate stretches worth trying: none, and the 23.976 ↔ 25 fps pair. */
export const SCALES = [1, 25 / 23.976, 23.976 / 25]
const BIN = 0.1
const RANGE = 40

/**
 * Where people speak in [from, from + duration] of the input: ffmpeg's silence detection on the
 * voice band (music and effects get less weight there), as [start, end] pairs in film seconds.
 * Null when ffmpeg can't read that part.
 */
export function speechSegments(ffmpeg, input, { from = 0, duration = 240, audio = 0, timeoutMs = 90000 } = {}) {
  return new Promise((resolve) => {
    const args = [
      '-hide_banner', '-nostats', '-protocol_whitelist', 'file,http,https,tcp,tls,crypto',
      '-ss', String(from), '-t', String(duration), '-i', input,
      '-map', `0:a:${audio}`, '-vn', '-ac', '1', '-ar', '16000',
      '-af', 'highpass=f=250,lowpass=f=3400,silencedetect=noise=-30dB:d=0.35',
      '-f', 'null', '-',
    ]
    const ff = spawn(ffmpeg, args)
    let log = ''
    const timer = setTimeout(() => { try { ff.kill('SIGKILL') } catch {} }, timeoutMs)
    ff.stderr.on('data', (data) => { log += data.toString(); if (log.length > 2e6) log = log.slice(-1e6) })
    ff.on('error', () => { clearTimeout(timer); resolve(null) })
    ff.on('close', () => {
      clearTimeout(timer)
      const silences = parseSilences(log, duration)
      resolve(silences ? speechFrom(silences, duration).map(([a, b]) => [a + from, b + from]) : null)
    })
  })
}

/** silencedetect's log → [start, end] silences (relative). Null when the log has no audio at all. */
export function parseSilences(log, duration) {
  if (!/Audio:|time=|silence_/.test(log)) return null
  const silences = []
  let open = null
  for (const line of log.split('\n')) {
    const start = /silence_start:\s*(-?[\d.]+)/.exec(line)
    const end = /silence_end:\s*([\d.]+)/.exec(line)
    if (start) open = Math.max(0, Number(start[1]))
    if (end) {
      silences.push([open ?? 0, Number(end[1])])
      open = null
    }
  }
  if (open !== null) silences.push([open, duration])
  return silences
}

/** The parts between the silences (shorter than 0.2 s left out). */
export function speechFrom(silences, duration) {
  const speech = []
  let at = 0
  for (const [start, end] of silences) {
    if (start - at >= 0.2) speech.push([at, start])
    at = Math.max(at, end)
  }
  if (duration - at >= 0.2) speech.push([at, duration])
  return speech
}

/**
 * The shift (seconds) and stretch that make `cues` ([start, end], in the subtitle's own times)
 * cover `speech` ([start, end], film times inside [from, to]) best. A cue at s then shows at
 * s × scale + offset. `score`: the share of the window's subtitle time that lands on speech;
 * `base`: the same with the timing as it is now (`current`). `confident` when the fit is clearly
 * better than now and good in itself.
 */
export function bestFit(cues, speech, { from, to, current = { offset: 0, scale: 1 }, range = RANGE, scales = SCALES } = {}) {
  const bins = Math.ceil((to - from) / BIN)
  const voice = new Uint8Array(bins)
  for (const [a, b] of speech) {
    for (let i = Math.max(0, Math.floor((a - from) / BIN)); i < Math.min(bins, Math.ceil((b - from) / BIN)); i++) voice[i] = 1
  }
  const covered = (scale, offset) => {
    let hit = 0, total = 0
    for (const [s, e] of cues) {
      const a = s * scale + offset, b = e * scale + offset
      if (b <= from || a >= to) continue
      for (let i = Math.max(0, Math.floor((a - from) / BIN)); i < Math.min(bins, Math.ceil((b - from) / BIN)); i++) {
        total++
        hit += voice[i]
      }
    }
    return total >= 20 ? hit / total : null
  }

  let best = null
  for (const scale of scales) {
    // Around a stretch, the shift that keeps the window's middle where it is, ± the range.
    const middle = (from + to) / 2
    const centre = middle - middle * scale + (scale === current.scale ? current.offset : 0)
    for (let step = -range / BIN; step <= range / BIN; step++) {
      const offset = Math.round((centre + step * BIN) * 100) / 100
      const score = covered(scale, offset)
      if (score === null) continue
      // A stretch must earn its place: a little handicap, so a plain shift wins a tie.
      const weighted = score - (scale === 1 ? 0 : 0.02)
      if (!best || weighted > best.weighted) best = { offset, scale, score, weighted }
    }
  }
  const base = covered(current.scale, current.offset)
  if (!best) return { offset: current.offset, scale: current.scale, score: null, base, confident: false }
  const confident = best.score >= 0.5 && (base === null || best.score - base >= 0.08)
  return { offset: best.offset, scale: best.scale, score: Math.round(best.score * 1000) / 1000, base: base === null ? null : Math.round(base * 1000) / 1000, confident }
}
