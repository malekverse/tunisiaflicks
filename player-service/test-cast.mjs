// End-to-end test of "Play on TV" against a fake TV on this machine's LAN address.
//
// The fake TV answers the SSDP search like a DLNA renderer, serves a device description, takes
// SetAVTransportURI / Play / GetPositionInfo / Stop over SOAP, and — like a real TV — fetches the
// video it was given (HEAD, then a Range GET). The player runs as a child process and streams Sintel
// (Blender Foundation, CC-BY; it has a web seed, so it doesn't depend on peers).
//
//   node test-cast.mjs
//
// It only ever casts to the fake TV. Real TVs on the network may show up in the device list (it
// prints them), but nothing is sent to them.

import dgram from 'node:dgram'
import http from 'node:http'
import { spawn } from 'node:child_process'
import { lanAddresses } from './dlna.js'

const SINTEL = 'magnet:?xt=urn:btih:08ada5a7a6183aae1e09d831df6748d566095a10&dn=Sintel&tr=udp%3A%2F%2Fexplodie.org%3A6969&tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337&tr=wss%3A%2F%2Ftracker.btorrent.xyz&tr=wss%3A%2F%2Ftracker.openwebtorrent.com&ws=https%3A%2F%2Fwebtorrent.io%2Ftorrents%2F'
const PORT = 8097
const API = `http://127.0.0.1:${PORT}`
const UDN = 'uuid:tunisiaflicks-fake-tv-0001'

let failures = 0
const check = (ok, label) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`); if (!ok) failures++ }

const lan = lanAddresses()
if (!lan.length) { console.log('No LAN address: connect to a network to run this test.'); process.exit(0) }

// ---- the fake TV -------------------------------------------------------------------------------
const tv = { uri: null, metadata: null, fetched: null, state: 'NO_MEDIA_PRESENT', actions: [] }

const tvHttp = http.createServer((req, res) => {
  if (req.url === '/desc.xml') {
    res.writeHead(200, { 'Content-Type': 'text/xml' })
    return res.end(`<?xml version="1.0"?><root xmlns="urn:schemas-upnp-org:device-1-0"><device>
      <deviceType>urn:schemas-upnp-org:device:MediaRenderer:1</deviceType><friendlyName>[TV] Fake Samsung</friendlyName>
      <manufacturer>Samsung Electronics</manufacturer><modelName>QE55 (test)</modelName><UDN>${UDN}</UDN>
      <serviceList><service><serviceType>urn:schemas-upnp-org:service:AVTransport:1</serviceType>
      <serviceId>urn:upnp-org:serviceId:AVTransport</serviceId><controlURL>/upnp/control/AVTransport1</controlURL>
      <eventSubURL>/upnp/event/AVTransport1</eventSubURL><SCPDURL>/avt.xml</SCPDURL></service></serviceList></device></root>`)
  }
  if (req.url === '/upnp/control/AVTransport1' && req.method === 'POST') {
    let body = ''
    req.on('data', (d) => { body += d })
    req.on('end', async () => {
      const action = /#(\w+)"?$/.exec(req.headers.soapaction || '')?.[1]
      tv.actions.push(action)
      const tag = (t) => /<(\w+)>([\s\S]*?)<\/\1>/g && new RegExp(`<${t}>([\\s\\S]*?)</${t}>`).exec(body)?.[1]
      let out = ''
      if (action === 'SetAVTransportURI') { tv.uri = tag('CurrentURI').replace(/&amp;/g, '&'); tv.metadata = tag('CurrentURIMetaData'); tv.state = 'STOPPED' }
      if (action === 'Play') {
        tv.state = 'PLAYING'
        // Like a TV: look at the video, then read its start.
        const head = await fetch(tv.uri, { method: 'HEAD' })
        const get = await fetch(tv.uri, { headers: { Range: 'bytes=0-65535' } })
        const bytes = Buffer.from(await get.arrayBuffer())
        tv.fetched = { head: head.status, status: get.status, type: get.headers.get('content-type'), features: get.headers.get('contentfeatures.dlna.org'), range: get.headers.get('content-range'), bytes: bytes.length }
      }
      if (action === 'Stop') tv.state = 'STOPPED'
      if (action === 'GetTransportInfo') out = `<CurrentTransportState>${tv.state}</CurrentTransportState>`
      if (action === 'GetPositionInfo') out = '<RelTime>0:00:12</RelTime><TrackDuration>0:14:48</TrackDuration>'
      res.writeHead(200, { 'Content-Type': 'text/xml' })
      res.end(`<?xml version="1.0"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><u:${action}Response xmlns:u="urn:schemas-upnp-org:service:AVTransport:1">${out}</u:${action}Response></s:Body></s:Envelope>`)
    })
    return
  }
  res.writeHead(404); res.end()
})
await new Promise((r) => tvHttp.listen(0, lan[0], r))
const tvLocation = `http://${lan[0]}:${tvHttp.address().port}/desc.xml`

const ssdp = dgram.createSocket({ type: 'udp4', reuseAddr: true })
ssdp.on('message', (msg, rinfo) => {
  const text = msg.toString()
  if (!text.startsWith('M-SEARCH') || !/AVTransport|ssdp:all/i.test(text)) return
  const reply = ['HTTP/1.1 200 OK', 'CACHE-CONTROL: max-age=1800', `LOCATION: ${tvLocation}`,
    'ST: urn:schemas-upnp-org:service:AVTransport:1', `USN: ${UDN}::urn:schemas-upnp-org:service:AVTransport:1`, 'EXT:', '', ''].join('\r\n')
  ssdp.send(reply, rinfo.port, rinfo.address)
})
await new Promise((resolve, reject) => {
  ssdp.once('error', reject)
  ssdp.bind(1900, () => {
    for (const address of lan) { try { ssdp.addMembership('239.255.255.250', address) } catch {} }
    resolve()
  })
})
console.log(`fake TV on ${tvLocation}`)

// ---- the player ------------------------------------------------------------------------------
const player = spawn(process.execPath, ['server.js'], { env: { ...process.env, PORT: String(PORT) }, stdio: ['ignore', 'pipe', 'pipe'] })
player.stderr.on('data', () => {})
const cleanup = () => { try { player.kill() } catch {} ; try { ssdp.close() } catch {} ; tvHttp.close() }

try {
  for (let i = 0; i < 120; i++) { try { if ((await fetch(`${API}/health`)).ok) break } catch {} ; await new Promise((r) => setTimeout(r, 250)) }

  const added = await fetch(`${API}/add?magnet=${encodeURIComponent(SINTEL)}`).then((r) => r.json())
  check(!!added.infoHash && !!added.best, `the player joined Sintel (${added.best?.name})`)

  const { devices } = await fetch(`${API}/cast/devices`).then((r) => r.json())
  console.log('      TVs found:', devices.map((d) => `${d.name} (${d.model})`).join(', ') || 'none')
  const fake = devices.find((d) => d.id === UDN)
  check(!!fake, 'discovery finds the fake TV')

  const started = await fetch(`${API}/cast/start`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId: UDN, infoHash: added.infoHash, index: added.best.index, title: 'Sintel' }),
  }).then((r) => r.json())
  check(typeof started.cast === 'string' && started.cast.length === 64, 'casting starts, with a secret per cast')
  check(tv.actions.includes('SetAVTransportURI') && tv.actions.includes('Play'), 'the TV was given the video and told to play')
  check(tv.uri?.startsWith(`http://${lan[0]}:`) && tv.uri.includes(`/media/${started.cast}/`), 'the video address is on the LAN, behind the secret')
  check(/protocolInfo="http-get:\*:video\/mp4:DLNA\.ORG_OP=01/.test((tv.metadata || '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')), 'the TV is told the type and that it can seek')
  check(tv.fetched?.head === 200, 'the TV can HEAD the video')
  check(tv.fetched?.status === 206 && tv.fetched?.bytes === 65536 && /^bytes 0-65535\//.test(tv.fetched?.range || ''), `the TV gets the bytes it asked for (${tv.fetched?.bytes} bytes, ${tv.fetched?.range})`)
  check(tv.fetched?.type === 'video/mp4' && (tv.fetched?.features || '').startsWith('DLNA.ORG_OP=01'), 'with the type and the DLNA headers a Samsung wants')

  const status = await fetch(`${API}/cast/${started.cast}/status`).then((r) => r.json())
  check(status.state === 'PLAYING' && status.position === 12 && status.duration === 888, `status reads the TV (${status.state} ${status.position}s / ${status.duration}s)`)

  const guessed = await fetch(tv.uri.replace(started.cast, 'f'.repeat(64)))
  check(guessed.status === 404, 'a wrong secret gets nothing')
  const api = await fetch(`http://${lan[0]}:${new URL(tv.uri).port}/health`)
  check(api.status === 404, 'the LAN side serves nothing but the video')

  await fetch(`${API}/cast/${started.cast}/stop`, { method: 'POST' })
  check(tv.actions.includes('Stop'), 'stop stops the TV')
  const after = await fetch(tv.uri)
  check(after.status === 404, 'after stop, the video address is dead')
} catch (err) {
  console.log('FAIL ', err.message)
  failures++
} finally {
  cleanup()
}

console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED')
process.exit(failures ? 1 : 0)
