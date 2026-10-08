// Deterministic test of the playback policy + ffmpeg pipeline, with NO torrent needed: synthesize
// the exact problem files (H.264-in-MKV-with-AC3, HEVC-with-AC3) and verify analyze() + ffmpegArgs()
// turn them into browser-native H.264/AAC MP4.  Run: node test-codec.mjs
import { spawn } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'
import * as ffbin from 'ffmpeg-ffprobe-static'
import { analyze, ffmpegArgs } from './codec.js'

const FFMPEG = ffbin.ffmpegPath
const FFPROBE = ffbin.ffprobePath
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'codec-test-'))

const run = (bin, args, inFile, outFile) => new Promise((resolve, reject) => {
  const p = spawn(bin, args)
  let err = ''
  p.stderr.on('data', (d) => { err += d })
  if (inFile) fs.createReadStream(inFile).pipe(p.stdin)
  if (outFile) p.stdout.pipe(fs.createWriteStream(outFile))
  p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${path.basename(bin)} exit ${code}: ${err.slice(-400)}`))))
})

const probe = (file) => new Promise((resolve, reject) => {
  const p = spawn(FFPROBE, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file])
  let out = ''
  p.stdout.on('data', (d) => { out += d })
  p.on('close', () => { try { resolve(JSON.parse(out)) } catch (e) { reject(e) } })
})

const codecs = (pr) => {
  const v = (pr.streams || []).find((s) => s.codec_type === 'video')
  const a = (pr.streams || []).find((s) => s.codec_type === 'audio')
  return { container: (pr.format.format_name || '').split(',')[0], video: v?.codec_name, audio: a?.codec_name }
}

let failed = 0
const check = (label, cond, detail) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${detail ? '  — ' + detail : ''}`)
  if (!cond) failed++
}

const CASES = [
  { name: 'h264-ac3.mkv', venc: ['-c:v', 'libx264'], aenc: ['-c:a', 'ac3'], expectDecision: 'remux', expectVideo: 'h264' },
  { name: 'hevc-ac3.mkv', venc: ['-c:v', 'libx265'], aenc: ['-c:a', 'ac3'], expectDecision: 'transcode', expectVideo: 'h264' },
  { name: 'h264-aac.mp4', venc: ['-c:v', 'libx264'], aenc: ['-c:a', 'aac'], expectDecision: 'direct', expectVideo: 'h264' },
]

for (const c of CASES) {
  const src = path.join(tmp, c.name)
  const out = path.join(tmp, 'out-' + c.name.replace(/\.\w+$/, '.mp4'))
  // 5s synthetic clip in the target container/codecs.
  await run(FFMPEG, [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'lavfi', '-i', 'testsrc=size=640x360:rate=24',
    '-f', 'lavfi', '-i', 'sine=frequency=440',
    '-t', '5', ...c.venc, ...c.aenc,
    ...(c.name.endsWith('.mkv') ? ['-f', 'matroska'] : ['-movflags', '+faststart', '-f', 'mp4']),
    src,
  ])
  const srcProbe = await probe(src)
  const info = analyze(srcProbe, c.name)
  const srcC = codecs(srcProbe)
  console.log(`\n[${c.name}] source = ${srcC.container}/${srcC.video}/${srcC.audio}  →  decision = ${info.decision}`)
  check(`${c.name}: decision is ${c.expectDecision}`, info.decision === c.expectDecision, info.decision)

  if (info.decision === 'direct') { check(`${c.name}: direct needs no conversion`, true); continue }

  // Run the real ffmpeg args the server would use, source via stdin like the torrent stream.
  await run(FFMPEG, ffmpegArgs(info, 1080), src, out)
  const outProbe = await probe(out)
  const outC = codecs(outProbe)
  console.log(`    converted → ${outC.container}/${outC.video}/${outC.audio}  (${fs.statSync(out).size} bytes)`)
  check(`${c.name}: output video is h264`, outC.video === c.expectVideo, outC.video)
  check(`${c.name}: output audio is aac (browser-playable)`, outC.audio === 'aac', outC.audio)
  check(`${c.name}: output container is mp4`, /mp4|mov/.test(outC.container), outC.container)
}

fs.rmSync(tmp, { recursive: true, force: true })
console.log(`\n${failed === 0 ? 'ALL PASSED' : failed + ' CHECK(S) FAILED'}`)
process.exit(failed === 0 ? 0 : 1)
