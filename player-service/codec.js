// Pure playback-policy logic (no I/O), so it can be unit-tested deterministically.
//
// Browsers reliably play only H.264 video + AAC/MP3 audio in an MP4 container. Everything else
// (MKV/AVI containers, AC3/DTS/EAC3 audio, HEVC/VP9/AV1 video) must be converted. Because the
// service runs on the viewer's own machine, their CPU/GPU does that conversion locally.

import path from 'node:path'

/**
 * Decide how to play a file from its ffprobe output:
 *   direct    — H.264 + AAC/MP3 in MP4: stream as-is with byte-range seeking (zero CPU).
 *   remux     — H.264 but wrong container/audio (e.g. H.264-in-MKV with AC3): copy video, fix audio.
 *   transcode — non-H.264 video (HEVC/VP9/AV1…): re-encode video + audio.
 */
export function analyze(probe, name) {
  const streams = (probe && probe.streams) || []
  const v = streams.find((s) => s.codec_type === 'video')
  const a = streams.find((s) => s.codec_type === 'audio')
  const subs = streams.filter((s) => s.codec_type === 'subtitle')
  const container = ((probe && probe.format && probe.format.format_name) || '').toLowerCase()
  const vcodec = (v && v.codec_name) || null
  const acodec = (a && a.codec_name) || null
  const durationSec = Math.round(Number(probe && probe.format && probe.format.duration) || 0) || null
  const ext = path.extname(name || '').toLowerCase()
  const mp4Family = /mp4|mov|m4a/.test(container) || ['.mp4', '.m4v', '.mov'].includes(ext)
  const videoNative = vcodec === 'h264'
  const audioNative = !acodec || acodec === 'aac' || acodec === 'mp3'

  let decision
  if (!probe) decision = mp4Family ? 'direct' : 'remux'          // probe failed → best guess
  else if (videoNative && audioNative && mp4Family) decision = 'direct'
  else if (videoNative) decision = 'remux'                        // e.g. H.264-in-MKV with AC3
  else decision = 'transcode'                                     // HEVC / VP9 / AV1 …

  return { decision, container, vcodec, acodec, durationSec, hasSubs: subs.length > 0 }
}

/**
 * ffmpeg args for remux (copy video) or transcode (re-encode video) → progressive fragmented MP4.
 * Audio is copied only when already AAC/MP3, else re-encoded to AAC (browsers can't play AC3/DTS).
 */
export function ffmpegArgs(info, maxHeight = 1080) {
  const video = info.decision === 'remux'
    ? ['-c:v', 'copy']
    : ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p',
       '-vf', `scale=-2:'min(${maxHeight},ih)'`]
  const audio = info.acodec === 'aac' || info.acodec === 'mp3'
    ? ['-c:a', 'copy']
    : ['-c:a', 'aac', '-b:a', '192k']
  return [
    '-hide_banner', '-loglevel', 'error',
    '-i', 'pipe:0',
    '-map', '0:v:0', '-map', '0:a:0?',
    ...video, ...audio,
    '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
    '-f', 'mp4', 'pipe:1',
  ]
}
