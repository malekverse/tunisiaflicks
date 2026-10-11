// Unit tests for the player's pure logic: no network, no torrent, no ffmpeg. Run: node --test test-unit.mjs
// (CI runs these plus test-codec.mjs; test-cast.mjs needs a LAN and a real swarm, so it stays manual.)
import test from 'node:test'
import assert from 'node:assert/strict'
import { analyze, withAudio } from './codec.js'
import { releaseMatches, rankOptions, pickBest } from './resolve.js'
import { isPack, streamScore, rankForTitle } from './providers.js'
import { manifestUrl, mediaId, sizeIn, seedsIn, serves } from './addons.js'
import { isPrivateIPv4, escapeXml } from './dlna.js'

const probe = (vcodec, acodec, format) => ({
  format: { format_name: format, duration: '5400.2' },
  streams: [{ codec_type: 'video', codec_name: vcodec }, { codec_type: 'audio', codec_name: acodec, tags: { language: 'eng' } }],
})

test('analyze: plays H.264/AAC MP4 as-is, remuxes H.264 elsewhere, transcodes the rest', () => {
  assert.equal(analyze(probe('h264', 'aac', 'mov,mp4,m4a,3gp,3g2,mj2'), 'a.mp4').decision, 'direct')
  assert.equal(analyze(probe('h264', 'ac3', 'matroska,webm'), 'a.mkv').decision, 'remux')
  assert.equal(analyze(probe('h264', 'aac', 'matroska,webm'), 'a.mkv').decision, 'remux')
  assert.equal(analyze(probe('hevc', 'aac', 'matroska,webm'), 'a.mkv').decision, 'transcode')
  assert.equal(analyze(probe('av1', 'opus', 'matroska,webm'), 'a.mkv').decision, 'transcode')
})

test('analyze: a failed probe guesses from the extension', () => {
  assert.equal(analyze(null, 'Sintel.mp4').decision, 'direct')
  assert.equal(analyze(null, 'Show.S01E01.mkv').decision, 'remux')
})

test('analyze: reads duration and audio tracks', () => {
  const info = analyze(probe('h264', 'aac', 'mp4'), 'a.mp4')
  assert.equal(info.durationSec, 5400)
  assert.deepEqual(info.audioTracks.map((t) => t.lang), ['eng'])
})

test('withAudio: picking another track on a direct file makes it a remux', () => {
  const info = analyze(probe('h264', 'aac', 'mp4'), 'a.mp4')
  assert.equal(withAudio(info, 0).decision, 'direct')
  assert.notEqual(withAudio(info, 1).decision, 'direct')
})

test('releaseMatches: keeps the show, drops look-alikes (EZTV files "Breaking Brad" under Breaking Bad)', () => {
  assert.equal(releaseMatches('Breaking Bad S01E01 720p HDTV x264', ['Breaking Bad']), true)
  assert.equal(releaseMatches('Breaking Brad S01E01 Geometry Wars', ['Breaking Bad']), false)
  assert.equal(releaseMatches('Marvels Agents of S H I E L D S01E01', ["Marvel's Agents of S.H.I.E.L.D."]), true)
  assert.equal(releaseMatches('The Office US S01E01', ['The Office']), true)
  assert.equal(releaseMatches('Pokémon S01E01', ['Pokemon']), true)
  assert.equal(releaseMatches('Sherlockian S01E01', ['Sherlock']), false)
})

test('rankOptions: 1080p x264 first, x265/AV1 and 2160p later, seeds break ties', () => {
  const ranked = rankOptions([
    { label: 'X 2160p x265', quality: '2160p', seeds: 900 },
    { label: 'X 1080p AV1 10bit', quality: '1080p', seeds: 500 },
    { label: 'X 720p x264', quality: '720p', seeds: 5 },
    { label: 'X 1080p x264 A', quality: '1080p', seeds: 10 },
    { label: 'X 1080p x264 B', quality: '1080p', seeds: 40 },
  ]).map((o) => o.label)
  assert.deepEqual(ranked.slice(0, 3), ['X 1080p x264 B', 'X 1080p x264 A', 'X 720p x264'])
  assert.equal(pickBest([]), null)
})

test('isPack: multi-film packs are recognised, single films are not', () => {
  assert.equal(isPack('The Matrix Trilogy 1080p BluRay'), true)
  assert.equal(isPack('Harry Potter Complete 8 Films Collection'), true)
  assert.equal(isPack('The Matrix 1999 1080p BluRay x264'), false)
})

test('streamScore: the right film beats a better-seeded pack', () => {
  const ctx = { type: 'movie', names: ['The Matrix'], year: 1999 }
  const film = { label: 'The Matrix 1999 1080p BluRay x264', quality: '1080p', seeds: 50, size: 2e9 }
  const pack = { label: 'The Matrix Trilogy 1080p BluRay x264', quality: '1080p', seeds: 2000, size: 9e9 }
  assert.ok(streamScore(film, ctx) > streamScore(pack, ctx))
  assert.equal(rankForTitle([pack, film], ctx)[0], film)
})

test('manifestUrl: normalises add-on addresses and refuses unsafe ones', () => {
  assert.equal(manifestUrl('https://addon.example/x/manifest.json'), 'https://addon.example/x/manifest.json')
  assert.equal(manifestUrl('https://addon.example/x/'), 'https://addon.example/x/manifest.json')
  assert.equal(manifestUrl('stremio://addon.example/manifest.json'), 'https://addon.example/manifest.json')
  assert.equal(manifestUrl('file:///etc/passwd'), null)
  assert.equal(manifestUrl('javascript://alert(1)'), null)
  assert.equal(manifestUrl('https://user:pass@addon.example/manifest.json'), null)
})

test('add-on helpers: ids, sizes, seeds, resources', () => {
  assert.equal(mediaId('movie', 'tt0133093'), 'tt0133093')
  assert.equal(mediaId('series', 'tt0903747', 1, 2), 'tt0903747:1:2')
  assert.equal(sizeIn('💾 1.4 GB'), 1.4e9)
  assert.equal(sizeIn('700,5 MB'), 700.5e6)
  assert.equal(sizeIn('no size'), null)
  assert.equal(seedsIn('👤 123 ⚙️ ThePirateBay'), 123)
  assert.equal(seedsIn('Seeds: 42'), 42)
  assert.equal(seedsIn('nothing'), null)
  const manifest = { types: ['movie', 'series'], idPrefixes: ['tt'], resources: ['stream', { name: 'subtitles', types: ['movie'] }] }
  assert.equal(serves(manifest, 'stream', 'series', 'tt0903747:1:1'), true)
  assert.equal(serves(manifest, 'subtitles', 'series', 'tt0903747:1:1'), false)
  assert.equal(serves(manifest, 'stream', 'movie', 'kitsu:1'), false)
})

test('dlna: only home-network addresses count as a LAN, XML is escaped', () => {
  for (const ip of ['10.0.0.5', '172.16.0.1', '172.31.255.255', '192.168.1.20', '169.254.1.1']) assert.equal(isPrivateIPv4(ip), true, ip)
  for (const ip of ['8.8.8.8', '172.32.0.1', '127.0.0.1', '192.169.0.1', '1.2.3', 'x.y.z.w']) assert.equal(isPrivateIPv4(ip), false, ip)
  assert.equal(escapeXml(`<a href="x">Tom & Jerry's</a>`), '&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&apos;s&lt;/a&gt;')
})
