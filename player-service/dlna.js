// "Play on TV": find the TVs on the home network that can play a video sent to them (DLNA / UPnP
// media renderers: most Samsung and LG TVs, many Sony / Philips / Hisense TVs and boxes) and drive
// them. No dependencies: SSDP discovery over UDP multicast, the device description is read with
// a few regexes, and control is plain SOAP over HTTP.
//
// SECURITY: discovery answers come from anyone on the LAN, so a description is only fetched from
// the private address that answered, and a TV is only ever driven by an id from our own discovery
// (never a URL from the page).

import dgram from 'node:dgram'
import os from 'node:os'

const SSDP_ADDRESS = '239.255.255.250'
const SSDP_PORT = 1900
const AV_TRANSPORT = 'urn:schemas-upnp-org:service:AVTransport:1'

/** 10/8, 172.16/12, 192.168/16, 169.254/16 — a home network, never the internet. */
export function isPrivateIPv4(ip) {
  const p = String(ip).split('.').map(Number)
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false
  return p[0] === 10 || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) || (p[0] === 192 && p[1] === 168) || (p[0] === 169 && p[1] === 254)
}

/** This machine's LAN addresses (IPv4, not loopback). */
export function lanAddresses() {
  return Object.values(os.networkInterfaces()).flat()
    .filter((a) => a && a.family === 'IPv4' && !a.internal && isPrivateIPv4(a.address))
    .map((a) => a.address)
}

const xmlText = (xml, tag) => {
  const m = new RegExp(`<(?:\\w+:)?${tag}[^>]*>([\\s\\S]*?)</(?:\\w+:)?${tag}>`, 'i').exec(xml)
  return m ? decodeXml(m[1].trim()) : null
}
const decodeXml = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
export const escapeXml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')

/** A device description → { id, name, manufacturer, model, controlUrl } (null if it can't play). */
export function parseDescription(xml, location) {
  const services = xml.match(/<service>[\s\S]*?<\/service>/gi) ?? []
  const transport = services.find((block) => (xmlText(block, 'serviceType') ?? '').startsWith('urn:schemas-upnp-org:service:AVTransport:'))
  const control = transport && xmlText(transport, 'controlURL')
  if (!control) return null
  const base = xmlText(xml, 'URLBase') || location
  let controlUrl
  try { controlUrl = new URL(control, base).href } catch { return null }
  return {
    id: xmlText(xml, 'UDN') || location,
    name: xmlText(xml, 'friendlyName') || 'TV',
    manufacturer: xmlText(xml, 'manufacturer') || '',
    model: xmlText(xml, 'modelName') || '',
    controlUrl,
  }
}

/**
 * Look for media renderers for `timeoutMs`. Asks from every LAN address (a PC on Wi-Fi and a VM
 * network has several), and remembers which of our addresses heard each TV: that's the address
 * the TV can reach us on.
 */
export async function discover(timeoutMs = 3000) {
  const answers = new Map()   // location -> local address that heard it
  const search = Buffer.from([
    'M-SEARCH * HTTP/1.1',
    `HOST: ${SSDP_ADDRESS}:${SSDP_PORT}`,
    'MAN: "ssdp:discover"',
    'MX: 2',
    `ST: ${AV_TRANSPORT}`,
    '', '',
  ].join('\r\n'))

  const sockets = lanAddresses().map((local) => new Promise((resolve) => {
    const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true })
    socket.on('error', () => { try { socket.close() } catch {} ; resolve() })
    socket.on('message', (msg, rinfo) => {
      const location = /^location:\s*(.+)$/im.exec(msg.toString())?.[1]?.trim()
      if (!location || !isPrivateIPv4(rinfo.address)) return
      try {
        const url = new URL(location)
        // Only a description served by the device that answered (no pointing us elsewhere).
        if (url.protocol === 'http:' && url.hostname === rinfo.address && !answers.has(location)) answers.set(location, local)
      } catch { /* not a URL */ }
    })
    socket.bind(0, local, () => {
      const send = () => socket.send(search, SSDP_PORT, SSDP_ADDRESS, () => {})
      send()
      setTimeout(send, 400)   // UDP: ask twice
      setTimeout(() => { try { socket.close() } catch {} ; resolve() }, timeoutMs)
    })
  }))
  await Promise.all(sockets)

  const devices = await Promise.all([...answers].map(async ([location, localAddress]) => {
    try {
      const res = await fetch(location, { signal: AbortSignal.timeout(3000) })
      if (!res.ok) return null
      const device = parseDescription(await res.text(), location)
      if (!device || new URL(device.controlUrl).hostname !== new URL(location).hostname) return null
      return { ...device, localAddress }
    } catch {
      return null
    }
  }))
  // One entry per device (a TV can answer on several of our addresses).
  const byId = new Map()
  for (const device of devices) if (device && !byId.has(device.id)) byId.set(device.id, device)
  return [...byId.values()]
}

async function soap(device, action, args = {}) {
  const params = Object.entries({ InstanceID: 0, ...args }).map(([k, v]) => `<${k}>${escapeXml(v)}</${k}>`).join('')
  const body = '<?xml version="1.0" encoding="utf-8"?>'
    + '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">'
    + `<s:Body><u:${action} xmlns:u="${AV_TRANSPORT}">${params}</u:${action}></s:Body></s:Envelope>`
  const res = await fetch(device.controlUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml; charset="utf-8"', SOAPACTION: `"${AV_TRANSPORT}#${action}"` },
    body,
    signal: AbortSignal.timeout(8000),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${action}: ${xmlText(text, 'errorDescription') || xmlText(text, 'faultstring') || `HTTP ${res.status}`}`)
  return text
}

/** DLNA flags: streaming, byte-range seeking. TVs (Samsung especially) want them on the stream. */
export const DLNA_FEATURES = 'DLNA.ORG_OP=01;DLNA.ORG_CI=0;DLNA.ORG_FLAGS=01700000000000000000000000000000'

/** What the TV is told about the video (a DIDL-Lite item). */
export function didl({ url, title, mime, size }) {
  return '<DIDL-Lite xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/" xmlns:dc="http://purl.org/dc/elements/1.1/"'
    + ' xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/" xmlns:dlna="urn:schemas-dlna-org:metadata-1-0/">'
    + '<item id="0" parentID="-1" restricted="1">'
    + `<dc:title>${escapeXml(title)}</dc:title><upnp:class>object.item.videoItem</upnp:class>`
    + `<res protocolInfo="http-get:*:${mime}:${DLNA_FEATURES}"${size ? ` size="${size}"` : ''}>${escapeXml(url)}</res>`
    + '</item></DIDL-Lite>'
}

const clock = (seconds) => {
  const s = Math.max(0, Math.floor(seconds))
  return `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}
const seconds = (hms) => {
  const m = /^(\d+):(\d{2}):(\d{2})/.exec(hms || '')
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : null
}

/** Load a video on the TV and start it. */
export async function load(device, media) {
  try { await soap(device, 'Stop') } catch { /* nothing was playing */ }
  await soap(device, 'SetAVTransportURI', { CurrentURI: media.url, CurrentURIMetaData: didl(media) })
  await soap(device, 'Play', { Speed: 1 })
}

export const play = (device) => soap(device, 'Play', { Speed: 1 })
export const pause = (device) => soap(device, 'Pause')
export const stop = (device) => soap(device, 'Stop')
export const seek = (device, to) => soap(device, 'Seek', { Unit: 'REL_TIME', Target: clock(to) })

/** Where the TV is: { state: PLAYING | PAUSED_PLAYBACK | STOPPED | TRANSITIONING | …, position, duration }. */
export async function status(device) {
  const [info, position] = await Promise.all([
    soap(device, 'GetTransportInfo').catch(() => ''),
    soap(device, 'GetPositionInfo').catch(() => ''),
  ])
  return {
    state: xmlText(info, 'CurrentTransportState') || 'UNKNOWN',
    position: seconds(xmlText(position, 'RelTime')),
    duration: seconds(xmlText(position, 'TrackDuration')),
  }
}
