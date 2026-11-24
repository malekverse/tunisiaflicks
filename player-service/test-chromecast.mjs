// Tests for chromecast.js ("Play on TV" for Chromecasts and Google TVs): discovery against a fake
// mDNS responder, the Cast protocol against a fake receiver (over plain TCP: a real one speaks TLS,
// with a self-signed certificate), and the subtitles' shift. No network beyond this machine.
// Run: node --test test-chromecast.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import dgram from 'node:dgram'
import http from 'node:http'
import net from 'node:net'
import * as chromecast from './chromecast.js'

// ---- a DNS answer, built by hand -------------------------------------------------------------------
const name = (n) => Buffer.concat([...n.split('.').map((l) => Buffer.concat([Buffer.from([l.length]), Buffer.from(l)])), Buffer.from([0])])
const u16 = (n) => { const b = Buffer.alloc(2); b.writeUInt16BE(n); return b }
const record = (owner, type, rdata) => Buffer.concat([name(owner), u16(type), u16(0x8001), Buffer.from([0, 0, 0, 120]), u16(rdata.length), rdata])
const txt = (pairs) => Buffer.concat(Object.entries(pairs).map(([k, v]) => { const s = Buffer.from(`${k}=${v}`); return Buffer.concat([Buffer.from([s.length]), s]) }))
const INSTANCE = 'Chromecast-abc123._googlecast._tcp.local'
function answer({ ip = '192.168.1.50', id = '0123456789abcdef0123456789abcdef' } = {}) {
  const records = [
    record('_googlecast._tcp.local', 12, name(INSTANCE)),
    record(INSTANCE, 33, Buffer.concat([u16(0), u16(0), u16(8009), name('abc123.local')])),
    record(INSTANCE, 16, txt({ id, fn: 'Living Room TV', md: 'Google TV Streamer' })),
    record('abc123.local', 1, Buffer.from(ip.split('.').map(Number))),
  ]
  return Buffer.concat([Buffer.from([0, 0, 0x84, 0, 0, 0, 0, 1, 0, 0, 0, 3]), ...records])
}

test('mDNS: the question asks for _googlecast._tcp', () => {
  const query = chromecast.mdnsQuery()
  assert.equal(query.readUInt16BE(4), 1)
  assert.ok(query.includes(Buffer.from('_googlecast')))
})

test('mDNS: an answer gives the device, its name, model and address', () => {
  const devices = chromecast.devicesFrom(chromecast.parseMdns(answer()), '192.168.1.50', '192.168.1.10')
  assert.deepEqual(devices, [{
    id: 'cast-0123456789abcdef0123456789abcdef', kind: 'cast', name: 'Living Room TV', manufacturer: 'Google',
    model: 'Google TV Streamer', host: '192.168.1.50', port: 8009, localAddress: '192.168.1.10',
  }])
})

test('mDNS: never a public address, never without an id', () => {
  assert.deepEqual(chromecast.devicesFrom(chromecast.parseMdns(answer({ ip: '8.8.8.8' })), '8.8.4.4', '192.168.1.10'), [])
  assert.deepEqual(chromecast.devicesFrom(chromecast.parseMdns(answer({ id: '<script>' })), '192.168.1.50', '192.168.1.10'), [])
  assert.deepEqual(chromecast.parseMdns(Buffer.from([1, 2, 3])), [])
})

test('discover: asks, and hears the answers straight back', async () => {
  const responder = dgram.createSocket('udp4')
  await new Promise((resolve) => responder.bind(0, '127.0.0.1', resolve))
  responder.on('message', (msg, rinfo) => {
    if (msg.includes(Buffer.from('_googlecast'))) responder.send(answer(), rinfo.port, rinfo.address)
  })
  const found = await chromecast.discover(400, { addresses: ['127.0.0.1'], port: responder.address().port, group: '127.0.0.1' })
  responder.close()
  assert.equal(found.length, 1)
  assert.equal(found[0].name, 'Living Room TV')
  assert.equal(found[0].localAddress, '127.0.0.1')
})

test('messages: encoded and read back', () => {
  const framed = chromecast.encodeMessage({ source: 'a', destination: 'b', namespace: 'urn:x-cast:test', data: { type: 'PING', n: 'é' } })
  assert.equal(framed.readUInt32BE(0), framed.length - 4)
  assert.deepEqual(chromecast.decodeMessage(framed.subarray(4)), { source: 'a', destination: 'b', namespace: 'urn:x-cast:test', data: { type: 'PING', n: 'é' } })
})

test('load request: the video, its title, and the subtitles as a text track', () => {
  const request = chromecast.loadRequest('s-1', { url: 'http://192.168.1.10:5000/media/x/a.mp4', mime: 'video/mp4', title: 'Sintel', position: 42, subtitles: { url: 'http://192.168.1.10:5000/media/x/subs.vtt', lang: 'fr', label: 'Français' } })
  assert.equal(request.media.contentId, 'http://192.168.1.10:5000/media/x/a.mp4')
  assert.equal(request.currentTime, 42)
  assert.deepEqual(request.activeTrackIds, [1])
  assert.equal(request.media.tracks[0].trackContentType, 'text/vtt')
  assert.equal(chromecast.loadRequest('s-1', { url: 'u', title: 't' }).activeTrackIds, undefined)
})

test('subtitles: moved earlier for a stream that starts later, the past dropped', () => {
  const vtt = 'WEBVTT\n\n00:00:05.000 --> 00:00:07.000\nGone\n\n00:01:05.500 --> 00:01:08.000 line:90%\nStill here'
  assert.equal(chromecast.shiftVtt(vtt, 60), 'WEBVTT\n\n00:00:05.500 --> 00:00:08.000 line:90%\nStill here')
  assert.equal(chromecast.shiftVtt(vtt, 0), vtt)
  assert.equal(chromecast.cleanVtt('1\n00:00:01,000 --> 00:00:02,000\nSRT'), null)
  assert.ok(chromecast.cleanVtt(vtt))
})

// ---- a fake receiver ---------------------------------------------------------------------------------
test('the Cast protocol: launch, load (the receiver fetches the video), pause, seek, status, stop', async () => {
  const video = http.createServer((req, res) => { res.writeHead(200, { 'Content-Type': 'video/mp4' }); res.end(Buffer.alloc(1024)) })
  await new Promise((resolve) => video.listen(0, '127.0.0.1', resolve))
  const seen = []
  let fetched = null
  let state = { playerState: 'IDLE', currentTime: 0 }
  const receiver = net.createServer((socket) => {
    let buffer = Buffer.alloc(0)
    const reply = (to, namespace, data) => socket.write(chromecast.encodeMessage({ source: to.destination, destination: to.source, namespace, data }))
    socket.on('data', async (chunk) => {
      buffer = Buffer.concat([buffer, chunk])
      while (buffer.length >= 4 && buffer.length >= 4 + buffer.readUInt32BE(0)) {
        const message = chromecast.decodeMessage(buffer.subarray(4, 4 + buffer.readUInt32BE(0)))
        buffer = buffer.subarray(4 + buffer.readUInt32BE(0))
        const { data, namespace } = message
        seen.push(data.type)
        const id = data.requestId
        if (data.type === 'LAUNCH') reply(message, namespace, { type: 'RECEIVER_STATUS', requestId: id, status: { applications: [{ appId: data.appId, transportId: 'web-7', sessionId: 'session-7' }] } })
        if (data.type === 'LOAD') {
          const res = await fetch(data.media.contentId)
          fetched = { status: res.status, type: res.headers.get('content-type'), title: data.media.metadata.title, at: data.currentTime, to: message.destination }
          state = { playerState: 'PLAYING', currentTime: data.currentTime }
          reply(message, namespace, { type: 'MEDIA_STATUS', requestId: id, status: [{ mediaSessionId: 3, ...state, media: { duration: 888 } }] })
        }
        if (data.type === 'PAUSE') { state.playerState = 'PAUSED'; reply(message, namespace, { type: 'MEDIA_STATUS', requestId: id, status: [{ mediaSessionId: 3, ...state }] }) }
        if (data.type === 'SEEK') { state.currentTime = data.currentTime; reply(message, namespace, { type: 'MEDIA_STATUS', requestId: id, status: [{ mediaSessionId: 3, ...state }] }) }
        if (data.type === 'GET_STATUS') reply(message, namespace, { type: 'MEDIA_STATUS', requestId: id, status: [{ mediaSessionId: 3, ...state }] })
        if (data.type === 'STOP') reply(message, namespace, { type: 'RECEIVER_STATUS', requestId: id, status: { applications: [] } })
      }
    })
  })
  await new Promise((resolve) => receiver.listen(0, '127.0.0.1', resolve))
  const device = { id: 'cast-test', kind: 'cast', name: 'Fake', host: '127.0.0.1', port: receiver.address().port, localAddress: '127.0.0.1' }
  try {
    await chromecast.load(device, { url: `http://127.0.0.1:${video.address().port}/a.mp4`, mime: 'video/mp4', title: 'Sintel', position: 12 }, { secure: false })
    assert.deepEqual(fetched, { status: 200, type: 'video/mp4', title: 'Sintel', at: 12, to: 'web-7' })
    assert.deepEqual(await chromecast.status(device), { state: 'PLAYING', position: 12, duration: 888 })
    await chromecast.pause(device)
    await chromecast.seek(device, 300)
    assert.deepEqual(await chromecast.status(device), { state: 'PAUSED_PLAYBACK', position: 300, duration: 888 })
    await chromecast.stop(device)
    assert.deepEqual(await chromecast.status(device), { state: 'STOPPED', position: null, duration: null })
    assert.deepEqual(seen.filter((type) => type !== 'PING'), ['CONNECT', 'LAUNCH', 'CONNECT', 'LOAD', 'GET_STATUS', 'PAUSE', 'SEEK', 'GET_STATUS', 'STOP'])
  } finally {
    receiver.close()
    video.close()
  }
})
