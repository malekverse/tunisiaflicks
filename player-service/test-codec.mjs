// Deterministic test of the playback policy + ffmpeg pipeline, with NO torrent needed: synthesize
// the exact problem files (H.264-in-MKV-with-AC3, HEVC-with-AC3) and verify analyze() + ffmpegArgs()
// turn them into browser-native H.264/AAC MP4.  Run: node test-codec.mjs
import { spawn } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'
import * as ffbin from 'ffmpeg-ffprobe-static'
import { analyze, ffmpegArgs } from './codec.js'
import { bestFit, speechSegments } from './autosync.js'
import { createIntroStore, learnIntro } from './segments.js'

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

// ---- subtitle auto-sync: real ffmpeg listening to a track with "voices" at known times --------------
{
  // Bursts of tone (1 kHz, in the voice band) for 1.4 to 3.2 s, gaps of 0.9 to 2.6 s: the "dialogue".
  const lines = []
  for (let t = 2, n = 0; t < 115; n++) {
    const length = 1.4 + ((n * 37) % 19) / 10
    lines.push([t, t + length])
    t += length + 0.9 + ((n * 53) % 18) / 10
  }
  const speaking = lines.map(([a, b]) => `between(t,${a.toFixed(2)},${b.toFixed(2)})`).join('+')
  const track = path.join(tmp, 'voices.m4a')
  await run(FFMPEG, ['-y', '-f', 'lavfi', '-i', 'sine=frequency=1000:sample_rate=16000:duration=120', '-af', `volume=0:enable='not(${speaking})'`, '-c:a', 'aac', track])
  const speech = await speechSegments(FFMPEG, track, { from: 20, duration: 80 })
  check('auto-sync: ffmpeg finds the voices', Array.isArray(speech) && speech.length > 15, `${speech?.length} segments`)
  const late = lines.map(([a, b]) => [a - 2.7, b - 2.7])
  const fit = bestFit(late, speech ?? [], { from: 20, to: 100 })
  check('auto-sync: a subtitle 2.7 s early is moved 2.7 s later', fit.confident && fit.scale === 1 && Math.abs(fit.offset - 2.7) <= 0.2, JSON.stringify(fit))
}

// ---- skip intro: real ffmpeg listening to two "episodes" that open with the same title song ---------
{
  // The song: two voices of notes that change every 0.4 and 0.77 s, on a beat. The episodes: pink
  // noise switched on and off like speech (each its own), the song after cold opens of 40 and 75 s.
  const songExpr = "0.25*sin(2*PI*(220+55*floor(mod(t*2.5,9)))*t)+0.18*sin(2*PI*(330+40*floor(mod(t*1.3,7)))*t)*(0.6+0.4*sin(2*PI*2*t))"
  const episode = async (name, coldOpen, seed) => {
    const file = path.join(tmp, `${name}.m4a`)
    const rest = 200 - coldOpen - 45
    await run(FFMPEG, ['-y',
      '-f', 'lavfi', '-i', `anoisesrc=color=pink:seed=${seed}:sample_rate=16000:duration=${coldOpen}`,
      '-f', 'lavfi', '-i', `aevalsrc='${songExpr}':s=16000:d=45`,
      '-f', 'lavfi', '-i', `anoisesrc=color=pink:seed=${seed + 1}:sample_rate=16000:duration=${rest}`,
      '-filter_complex', `[0:a]volume=0.5,volume=0:enable='lt(mod(t,1.7),0.5)'[a];[2:a]volume=0.5,volume=0:enable='lt(mod(t,1.3),0.4)'[c];[a][1:a][c]concat=n=3:v=0:a=1`,
      '-c:a', 'aac', file])
    return file
  }
  const [one, two] = [await episode('ep1', 40, 11), await episode('ep2', 75, 23)]
  const store = createIntroStore(path.join(tmp, 'data'))
  const checkpoints = [100, 200]
  const first = await learnIntro({ store, ffmpeg: FFMPEG, input: one, tmdb: 9, season: 1, episode: 1, checkpoints })
  check('skip intro: the first episode has nothing to compare with yet', first === null, JSON.stringify(first))
  const second = await learnIntro({ store, ffmpeg: FFMPEG, input: two, tmdb: 9, season: 1, episode: 2, checkpoints })
  check('skip intro: the second episode’s intro is found from the sound', !!second && Math.abs(second[0] - 75) <= 2 && Math.abs(second[1] - 120) <= 2, JSON.stringify(second))
  const taught = store.learned(9, 1, 1)?.intro
  check('skip intro: and the first episode learns its own', !!taught && Math.abs(taught[0] - 40) <= 2 && Math.abs(taught[1] - 85) <= 2, JSON.stringify(taught))
}

fs.rmSync(tmp, { recursive: true, force: true })
console.log(`\n${failed === 0 ? 'ALL PASSED' : failed + ' CHECK(S) FAILED'}`)
process.exit(failed === 0 ? 0 : 1)
