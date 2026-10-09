// The desktop app's player (player-service/): extensions, sources, subtitles, what it remembers,
// and the converted streams' seeking. No network: the pure parts only.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import zlib from 'node:zlib'
import { audioLanguagesOf, cleanManifest, decodeSubtitle, languageOf, manifestUrl, mediaId, seedsIn, serves, sizeIn, sourceFromStream } from '../player-service/addons.js'
import { codeOfName, readYifyPage, releaseMatch, unzip } from '../player-service/subtitles.js'
import { cleanPrefs, isTitleKey } from '../player-service/state.js'
import { ffmpegArgs, withAudio } from '../player-service/codec.js'

test('an extension address: https, an app link turned into https, /manifest.json added; nothing else', () => {
  assert.equal(manifestUrl('https://example.com/abc/manifest.json'), 'https://example.com/abc/manifest.json')
  assert.equal(manifestUrl('https://example.com/abc'), 'https://example.com/abc/manifest.json')
  assert.equal(manifestUrl('someapp://example.com/x/manifest.json'), 'https://example.com/x/manifest.json')
  assert.equal(manifestUrl('ftp://example.com/manifest.json'), 'https://example.com/manifest.json')
  assert.equal(manifestUrl('https://user:pass@example.com/manifest.json'), null)
  assert.equal(manifestUrl('file:///etc/passwd'), null)
  assert.equal(manifestUrl('not a url'), null)
})

test('a manifest is kept in our words, and says what it serves', () => {
  const manifest = cleanManifest({
    id: 'org.example.subs', name: 'Great Subs v3', description: 'Great Subs Addon for Stremio', version: '3.0.0',
    resources: ['subtitles', { name: 'stream', types: ['movie'], idPrefixes: ['tt'] }], types: ['movie', 'series'],
  })
  assert.equal(manifest.name, 'Great Subs')
  assert.equal(manifest.description, 'Great Subs extension')
  assert.ok(serves(manifest, 'subtitles', 'series', 'tt1:1:1'))
  assert.ok(serves(manifest, 'stream', 'movie', 'tt0133093'))
  assert.ok(!serves(manifest, 'stream', 'series', 'tt0903747:1:1'))
  assert.equal(cleanManifest({ name: 'no id' }), null)
  assert.equal(mediaId('series', 'tt0903747', 1, 2), 'tt0903747:1:2')
  assert.equal(mediaId('movie', 'tt0133093', null, null), 'tt0133093')
})

test('an extension stream becomes a torrent or a direct link, with its quality, size and seeders', () => {
  const torrent = sourceFromStream({
    name: 'Ext\n1080p', title: 'Movie.2010.1080p.BluRay.x264\n👤 120 💾 2.1 GB',
    infoHash: 'A'.repeat(40), fileIdx: 2, sources: ['tracker:udp://tracker.example:1337/announce', 'dht:abc'],
  }, { name: 'Ext' })
  assert.equal(torrent.kind, 'torrent')
  assert.equal(torrent.infoHash, 'a'.repeat(40))
  assert.equal(torrent.fileIdx, 2)
  assert.equal(torrent.quality, '1080p')
  assert.equal(torrent.size, 2.1e9)
  assert.equal(torrent.seeds, 120)
  assert.match(torrent.magnet, /^magnet:\?xt=urn:btih:a{40}&dn=.+&tr=udp%3A%2F%2Ftracker\.example/)
  assert.ok(!torrent.magnet.includes('dht'))
  const link = sourceFromStream({ name: 'Ext 4K', title: 'Movie 4K HDR', url: 'https://cdn.example/movie.mkv' }, { name: 'Ext' })
  assert.deepEqual([link.kind, link.quality, link.url], ['url', '2160p', 'https://cdn.example/movie.mkv'])
  assert.equal(sourceFromStream({ ytId: 'abc' }, { name: 'Ext' }), null)
  assert.equal(sourceFromStream({ url: 'javascript:alert(1)' }, { name: 'Ext' }), null)
  assert.equal(sizeIn('💾 700 MB'), 7e8)
  assert.equal(seedsIn('Seeds: 42'), 42)
})

test('subtitle languages and encodings: Arabic files that aren’t UTF-8 still read right', () => {
  assert.deepEqual(languageOf('ara'), { code: 'ara', name: 'Arabic' })
  assert.equal(languageOf('pob').name, 'Portuguese (Brazil)')
  assert.equal(codeOfName('Arabic'), 'ara')
  assert.equal(codeOfName('Farsi/Persian'), 'per')
  const salam = new Uint8Array([0xd3, 0xe1, 0xc7, 0xe3])   // 'سلام' in Windows-1256
  assert.equal(decodeSubtitle(new Uint8Array([...salam, 32, ...salam, 32, ...salam, 32, ...salam]), 'ara'), 'سلام سلام سلام سلام')
  assert.equal(decodeSubtitle(new TextEncoder().encode('﻿Hello'), 'eng'), 'Hello')
})

test('a zipped subtitle comes out of its archive', () => {
  const content = Buffer.from('1\n00:00:01,000 --> 00:00:02,000\nHello\n')
  const name = Buffer.from('movie.srt')
  const data = zlib.deflateRawSync(content)
  const local = Buffer.alloc(30)
  local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(8, 8); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(content.length, 22); local.writeUInt16LE(name.length, 26)
  const central = Buffer.alloc(46)
  central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(8, 10); central.writeUInt32LE(data.length, 20); central.writeUInt32LE(content.length, 24); central.writeUInt16LE(name.length, 28); central.writeUInt32LE(0, 42)
  const centralAt = local.length + name.length + data.length
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10); end.writeUInt32LE(central.length + name.length, 12); end.writeUInt32LE(centralAt, 16)
  const zip = Buffer.concat([local, name, data, central, name, end])
  assert.equal(unzip(zip).toString(), content.toString())
  assert.equal(unzip(Buffer.from('not a zip')), null)
})

test('YIFY rows, and which subtitle matches the video', () => {
  const html = `<tr data-id="1"><td class="rating-cell"><span class="label label-success">30</span></td>
    <td class="flag-cell"><span class="flag"></span><span class="sub-lang">Arabic</span></td>
    <td><a href="/subtitles/the-film-arabic-yify-1"><span class="text-muted">subtitle</span> The.Film.2020.1080p.BluRay.x264-GRP<br />The.Film.2020.720p.WEB</a></td></tr>`
  const [row] = readYifyPage(html)
  assert.deepEqual(row, { rating: 30, language: 'Arabic', release: ['The.Film.2020.1080p.BluRay.x264-GRP', 'The.Film.2020.720p.WEB'], page: '/subtitles/the-film-arabic-yify-1' })
  assert.ok(releaseMatch(row.release, 'The Film 2020 1080p BluRay x264-GRP') > releaseMatch(['Other.Film.2019.HDTV'], 'The Film 2020 1080p BluRay x264-GRP'))
})

test('what the player remembers: known preferences only, and real title keys', () => {
  assert.deepEqual(cleanPrefs({ volume: 0.5, speed: 9, subLang: 'off', subTranslate: 'ar', evil: true }), { volume: 0.5, subLang: 'off', subTranslate: 'ar' })
  assert.ok(isTitleKey('movie:550'))
  assert.ok(isTitleKey('tv:1399:1:2'))
  assert.ok(!isTitleKey('movie:550/../x'))
})

test('dubbed copies: the audio languages a name says it has', () => {
  assert.deepEqual(audioLanguagesOf('Movie.2020.MULTi.VFF.1080p.BluRay'), { languages: ['fre'], multi: true })
  assert.deepEqual(audioLanguagesOf('Movie 2020 1080p 🇪🇸 Latino'), { languages: ['spa'], multi: false })
  assert.deepEqual(audioLanguagesOf('Movie.2020.Arabic.Dubbed.720p'), { languages: ['ara'], multi: false })
  assert.deepEqual(audioLanguagesOf('Movie.2020.1080p.BluRay.x264-GRP'), { languages: [], multi: false })
  assert.deepEqual(audioLanguagesOf('Movie.2020.Dual.Audio.Hindi.English'), { languages: ['hin'], multi: true })
})

test('another audio track: even a direct file is remuxed, with that track mapped and converted if need be', () => {
  const info = { decision: 'direct', acodec: 'aac', audioTracks: [{ lang: 'eng', codec: 'aac' }, { lang: 'fre', codec: 'ac3' }] }
  assert.equal(withAudio(info, 0), info)
  const french = withAudio(info, 1)
  assert.deepEqual([french.decision, french.acodec, french.audio], ['remux', 'ac3', 1])
  const args = ffmpegArgs(french)
  assert.equal(args[args.indexOf('-map', args.indexOf('-map') + 1) + 1], '0:a:1?')
  assert.equal(args[args.indexOf('-c:a') + 1], 'aac', 'AC3 becomes AAC')
})

test('a converted stream starts where asked: a remux just after its keyframe, a transcode exactly', () => {
  const remux = ffmpegArgs({ decision: 'remux', acodec: 'ac3' }, 1080, { input: 'http://127.0.0.1:9/stream/x/0', start: 115.833 })
  assert.deepEqual(remux.slice(remux.indexOf('-ss'), remux.indexOf('-ss') + 2), ['-ss', '115.883'])
  assert.ok(remux.indexOf('-ss') < remux.indexOf('-i'), 'seeks the input')
  assert.equal(remux[remux.indexOf('-protocol_whitelist') + 1], 'http,https,tcp,tls,crypto')
  const transcode = ffmpegArgs({ decision: 'transcode', acodec: 'aac' }, 1080, { input: 'https://cdn.example/a.mkv', start: 60 })
  assert.equal(transcode[transcode.indexOf('-ss') + 1], '60.000')
  const piped = ffmpegArgs({ decision: 'remux', acodec: 'aac' })
  assert.ok(!piped.includes('-ss') && piped.includes('pipe:0') && !piped.includes('-protocol_whitelist'))
})
