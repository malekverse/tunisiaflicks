// "Play on TV" for Chromecasts and Google TVs (dlna.js does the DLNA TVs). No dependencies:
// discovery is an mDNS question for _googlecast._tcp, asked from each of this machine's home
// network addresses (the devices answer straight back to it), and control is the Cast protocol: a
// TLS connection to the device, carrying small protobuf-framed JSON messages. The device's Default
// Media Receiver plays the video from our LAN server (server.js), with the subtitles as WebVTT.
//
// SECURITY: answers come from anyone on the LAN, so only a private address is ever connected to,
// a device is only driven by an id from our own discovery (never an address from the page), and
// the device's certificate is self-signed (every Cast sender accepts it: there is no CA to check).

import dgram from 'node:dgram'
import net from 'node:net'
import tls from 'node:tls'
import { isPrivateIPv4, lanAddresses } from './dlna.js'

const MDNS_ADDRESS = '224.0.0.251'
const MDNS_PORT = 5353
const SERVICE = '_googlecast._tcp.local'
const DEFAULT_RECEIVER = 'CC1AD845'

const NS = {
  connection: 'urn:x-cast:com.google.cast.tp.connection',
  heartbeat: 'urn:x-cast:com.google.cast.tp.heartbeat',
  receiver: 'urn:x-cast:com.google.cast.receiver',
  media: 'urn:x-cast:com.google.cast.media',
}
const SENDER = 'sender-tunisiaflicks'
const RECEIVER = 'receiver-0'

// ---- mDNS ------------------------------------------------------------------------------------------

/** The question: PTR _googlecast._tcp.local, asking for a unicast answer. */
export function mdnsQuery() {
  const labels = SERVICE.split('.').map((label) => Buffer.concat([Buffer.from([label.length]), Buffer.from(label)]))
  const header = Buffer.from([0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0])
  return Buffer.concat([header, ...labels, Buffer.from([0, 0, 12, 0x80, 1])])
}

function readName(buf, offset) {
  const labels = []
  let jumped = false
  let end = offset
  for (let guard = 0; guard < 64; guard++) {
    if (offset >= buf.length) throw new Error('bad name')
    const len = buf[offset]
    if (len === 0) { if (!jumped) end = offset + 1; break }
    if ((len & 0xc0) === 0xc0) {
      if (!jumped) end = offset + 2
      offset = ((len & 0x3f) << 8) | buf[offset + 1]
      jumped = true
      continue
    }
    labels.push(buf.toString('utf8', offset + 1, offset + 1 + len))
    offset += 1 + len
  }
  return { name: labels.join('.'), end }
}

/** An mDNS answer → its records: [{ name, type, data }] (PTR, SRV, TXT and A; the rest skipped). */
export function parseMdns(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return []
  const count = (i) => buf.readUInt16BE(i)
  let offset = 12
  for (let q = 0; q < count(4); q++) offset = readName(buf, offset).end + 4
  const records = []
  const total = count(6) + count(8) + count(10)
  for (let r = 0; r < total && offset < buf.length; r++) {
    const { name, end } = readName(buf, offset)
    const type = buf.readUInt16BE(end)
    const length = buf.readUInt16BE(end + 8)
    const start = end + 10
    const rdata = buf.subarray(start, start + length)
    if (type === 12) records.push({ name, type: 'PTR', data: readName(buf, start).name })
    else if (type === 33) records.push({ name, type: 'SRV', data: { port: rdata.readUInt16BE(4), target: readName(buf, start + 6).name } })
    else if (type === 16) {
      const txt = {}
      for (let i = 0; i < rdata.length;) {
        const n = rdata[i]
        const entry = rdata.toString('utf8', i + 1, i + 1 + n)
        const eq = entry.indexOf('=')
        if (eq > 0) txt[entry.slice(0, eq).toLowerCase()] = entry.slice(eq + 1)
        i += 1 + n
      }
      records.push({ name, type: 'TXT', data: txt })
    } else if (type === 1 && length === 4) records.push({ name, type: 'A', data: [...rdata].join('.') })
    offset = start + length
  }
  return records
}

/**
 * The Cast devices in an answer that came from `from` (the address that sent it), reached from our
 * `localAddress`: { id, kind: 'cast', name, manufacturer, model, host, port, localAddress }.
 */
export function devicesFrom(records, from, localAddress) {
  const devices = []
  for (const ptr of records.filter((r) => r.type === 'PTR' && r.name.toLowerCase() === SERVICE)) {
    const instance = ptr.data
    const srv = records.find((r) => r.type === 'SRV' && r.name === instance)?.data
    const txt = records.find((r) => r.type === 'TXT' && r.name === instance)?.data ?? {}
    const a = srv && records.find((r) => r.type === 'A' && r.name === srv.target)?.data
    const host = a && isPrivateIPv4(a) ? a : isPrivateIPv4(from) ? from : null
    const id = /^[0-9a-f-]{8,64}$/i.test(txt.id ?? '') ? txt.id.toLowerCase() : null
    if (!host || !id) continue
    devices.push({
      id: `cast-${id}`,
      kind: 'cast',
      name: (txt.fn || instance.split('.')[0] || 'Chromecast').slice(0, 80),
      manufacturer: 'Google',
      model: (txt.md || 'Chromecast').slice(0, 80),
      host,
      port: srv?.port > 0 ? srv.port : 8009,
      localAddress,
    })
  }
  return devices
}

/** Ask the home network for Cast devices for `ms`, from each of our LAN addresses. */
export async function discover(ms = 2500, { addresses = lanAddresses(), port = MDNS_PORT, group = MDNS_ADDRESS } = {}) {
  const found = new Map()
  await Promise.all(addresses.map((address) => new Promise((resolve) => {
    const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true })
    const finish = () => { try { socket.close() } catch {} ; resolve() }
    socket.on('error', finish)
    socket.on('message', (msg, rinfo) => {
      try {
        for (const device of devicesFrom(parseMdns(msg), rinfo.address, address)) found.set(device.id, device)
      } catch { /* a malformed answer: ignored */ }
    })
    socket.bind(0, address, () => {
      try { socket.setMulticastInterface(address) } catch {}
      socket.send(mdnsQuery(), port, group, () => {})
      setTimeout(finish, ms)
    })
  })))
  return [...found.values()]
}

// ---- the Cast protocol -------------------------------------------------------------------------------

function varint(n) {
  const out = []
  do { let b = n & 0x7f; n >>>= 7; if (n) b |= 0x80; out.push(b) } while (n)
  return Buffer.from(out)
}
const field = (number, wire) => varint((number << 3) | wire)
const stringField = (number, value) => {
  const bytes = Buffer.from(value, 'utf8')
  return Buffer.concat([field(number, 2), varint(bytes.length), bytes])
}

/** A CastMessage (string payload), framed with its 4-byte length. */
export function encodeMessage({ source, destination, namespace, data }) {
  const body = Buffer.concat([
    field(1, 0), varint(0),                      // protocol_version: CASTV2_1_0
    stringField(2, source),
    stringField(3, destination),
    stringField(4, namespace),
    field(5, 0), varint(0),                      // payload_type: STRING
    stringField(6, JSON.stringify(data)),
  ])
  const length = Buffer.alloc(4)
  length.writeUInt32BE(body.length)
  return Buffer.concat([length, body])
}

/** One CastMessage body → { source, destination, namespace, data } (data null if not JSON). */
export function decodeMessage(body) {
  const out = {}
  let i = 0
  const readVarint = () => {
    let n = 0, shift = 0, b
    do { b = body[i++]; n |= (b & 0x7f) << shift; shift += 7 } while (b & 0x80 && i < body.length)
    return n >>> 0
  }
  while (i < body.length) {
    const key = readVarint()
    const number = key >>> 3, wire = key & 7
    if (wire === 0) { readVarint(); continue }
    if (wire === 2) {
      const len = readVarint()
      const value = body.subarray(i, i + len)
      i += len
      if (number === 2) out.source = value.toString('utf8')
      else if (number === 3) out.destination = value.toString('utf8')
      else if (number === 4) out.namespace = value.toString('utf8')
      else if (number === 6) out.payload = value.toString('utf8')
      continue
    }
    if (wire === 5) { i += 4; continue }
    if (wire === 1) { i += 8; continue }
    break
  }
  let data = null
  try { data = out.payload ? JSON.parse(out.payload) : null } catch {}
  return { source: out.source, destination: out.destination, namespace: out.namespace, data }
}

/** A connection to one device: requests matched to their answers by requestId, and the heartbeat. */
class Connection {
  constructor(device, { secure = true } = {}) {
    this.device = device
    this.secure = secure
    this.pending = new Map()
    this.nextId = 1
    this.buffer = Buffer.alloc(0)
    this.closed = false
  }

  open() {
    return new Promise((resolve, reject) => {
      const { host, port } = this.device
      const options = { host, port, timeout: 8000 }
      this.socket = this.secure ? tls.connect({ ...options, rejectUnauthorized: false }) : net.connect(options)
      const ready = this.secure ? 'secureConnect' : 'connect'
      this.socket.once(ready, () => {
        this.socket.setTimeout(0)
        this.send(RECEIVER, NS.connection, { type: 'CONNECT' })
        this.heartbeat = setInterval(() => this.send(RECEIVER, NS.heartbeat, { type: 'PING' }), 5000)
        resolve(this)
      })
      this.socket.once('timeout', () => { this.socket.destroy(new Error('The TV didn’t answer')) })
      this.socket.on('error', (err) => { reject(err); this.close(err) })
      this.socket.on('close', () => this.close(new Error('The TV closed the connection')))
      this.socket.on('data', (chunk) => this.read(chunk))
    })
  }

  read(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk])
    while (this.buffer.length >= 4) {
      const length = this.buffer.readUInt32BE(0)
      if (length > 1 << 20) return this.socket.destroy(new Error('Message too large'))
      if (this.buffer.length < 4 + length) break
      const message = decodeMessage(this.buffer.subarray(4, 4 + length))
      this.buffer = this.buffer.subarray(4 + length)
      this.receive(message)
    }
  }

  receive({ source, namespace, data }) {
    if (!data) return
    if (namespace === NS.heartbeat && data.type === 'PING') return this.send(source, NS.heartbeat, { type: 'PONG' })
    if (namespace === NS.connection && data.type === 'CLOSE') return
    const waiting = data.requestId && this.pending.get(data.requestId)
    if (waiting) {
      this.pending.delete(data.requestId)
      clearTimeout(waiting.timer)
      waiting.resolve(data)
    }
  }

  send(destination, namespace, data) {
    if (this.closed || !this.socket) return
    this.socket.write(encodeMessage({ source: SENDER, destination, namespace, data }))
  }

  request(destination, namespace, data, ms = 15000) {
    const requestId = this.nextId++
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(requestId); reject(new Error('The TV didn’t answer')) }, ms)
      this.pending.set(requestId, { resolve, timer })
      this.send(destination, namespace, { ...data, requestId })
    })
  }

  close(err = new Error('Closed')) {
    if (this.closed) return
    this.closed = true
    clearInterval(this.heartbeat)
    for (const { timer, resolve } of this.pending.values()) { clearTimeout(timer); resolve({ type: 'ERROR', reason: err.message }) }
    this.pending.clear()
    try { this.socket?.destroy() } catch {}
  }
}

// ---- subtitles ----------------------------------------------------------------------------------------

/** WebVTT text from the player, checked: null unless it's WebVTT of a sensible size. */
export function cleanVtt(text) {
  if (typeof text !== 'string' || text.length > 3_000_000 || !/^﻿?WEBVTT/.test(text)) return null
  return text
}

const stamp = (s) => {
  const ms = Math.max(0, Math.round(s * 1000))
  const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, sec = Math.floor(ms / 1000) % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`
}
const secondsOf = (t) => {
  const p = t.split(':').map(Number)
  return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1]
}

/**
 * The subtitles moved `offset` seconds earlier: a converted stream that starts at `offset` plays
 * from 0 on the TV. Cues that ended before then are dropped.
 */
export function shiftVtt(text, offset) {
  if (!(offset > 0)) return text
  const blocks = text.replace(/\r/g, '').split(/\n{2,}/)
  const out = [blocks[0]]
  for (const block of blocks.slice(1)) {
    const match = /^([\d:.]+)\s+-->\s+([\d:.]+)(.*)$/m.exec(block)
    if (!match) { out.push(block); continue }
    const start = secondsOf(match[1]) - offset, end = secondsOf(match[2]) - offset
    if (!(end > 0)) continue
    out.push(block.replace(match[0], `${stamp(Math.max(0, start))} --> ${stamp(end)}${match[3]}`))
  }
  return out.join('\n\n')
}

const sessions = new Map()   // device id -> { conn, transportId, sessionId, mediaSessionId, duration }

/** What the Default Media Receiver is told to play. */
export function loadRequest(sessionId, { url, mime, title, position = 0, subtitles = null }) {
  const media = {
    contentId: url,
    contentType: mime || 'video/mp4',
    streamType: 'BUFFERED',
    metadata: { type: 0, metadataType: 0, title: String(title || '').slice(0, 200) },
  }
  if (subtitles?.url) {
    media.tracks = [{ trackId: 1, type: 'TEXT', subtype: 'SUBTITLES', trackContentId: subtitles.url, trackContentType: 'text/vtt', name: subtitles.label || 'Subtitles', language: subtitles.lang || 'und' }]
    media.textTrackStyle = { backgroundColor: '#00000000', edgeType: 'OUTLINE', edgeColor: '#000000FF', foregroundColor: '#FFFFFFFF', fontScale: 1 }
  }
  return {
    type: 'LOAD', sessionId, media, autoplay: true,
    currentTime: Math.max(0, Number(position) || 0),
    ...(subtitles?.url ? { activeTrackIds: [1] } : {}),
  }
}

/** Start the Default Media Receiver on the device and load the video. */
export async function load(device, media, options = {}) {
  await stop(device).catch(() => {})
  const conn = await new Connection(device, options).open()
  const launched = await conn.request(RECEIVER, NS.receiver, { type: 'LAUNCH', appId: DEFAULT_RECEIVER })
  const app = launched?.status?.applications?.find((a) => a.appId === DEFAULT_RECEIVER)
  if (!app?.transportId) { conn.close(); throw new Error(launched?.reason || 'The TV couldn’t open its player') }
  conn.send(app.transportId, NS.connection, { type: 'CONNECT' })
  const loaded = await conn.request(app.transportId, NS.media, loadRequest(app.sessionId, media), 30000)
  const status = loaded?.status?.[0]
  if (loaded?.type !== 'MEDIA_STATUS' || !status) { conn.close(); throw new Error(loaded?.reason || loaded?.type || 'The TV couldn’t play it') }
  sessions.set(device.id, { conn, transportId: app.transportId, sessionId: app.sessionId, mediaSessionId: status.mediaSessionId, duration: status.media?.duration ?? null })
}

function sessionOf(device) {
  const session = sessions.get(device.id)
  if (!session || session.conn.closed) throw new Error('Not casting')
  return session
}
const media = (device, type, extra = {}) => {
  const session = sessionOf(device)
  return session.conn.request(session.transportId, NS.media, { type, mediaSessionId: session.mediaSessionId, ...extra })
}

export const play = (device) => media(device, 'PLAY')
export const pause = (device) => media(device, 'PAUSE')
export const seek = (device, to) => media(device, 'SEEK', { currentTime: Math.max(0, Number(to) || 0) })

export async function stop(device) {
  const session = sessions.get(device.id)
  if (!session) return
  sessions.delete(device.id)
  try { await session.conn.request(RECEIVER, NS.receiver, { type: 'STOP', sessionId: session.sessionId }, 5000) } finally { session.conn.close() }
}

/** The device's own state (what app it runs, its volume), without changing anything on it. */
export async function receiverStatus(device, options = {}) {
  const conn = await new Connection(device, options).open()
  try { return await conn.request(RECEIVER, NS.receiver, { type: 'GET_STATUS' }, 8000) } finally { conn.close() }
}

const STATES = { PLAYING: 'PLAYING', PAUSED: 'PAUSED_PLAYBACK', BUFFERING: 'TRANSITIONING', LOADING: 'TRANSITIONING', IDLE: 'STOPPED' }

/** Where the TV is, in dlna.js's words: { state, position, duration }. */
export async function status(device) {
  const session = sessions.get(device.id)
  if (!session || session.conn.closed) return { state: 'STOPPED', position: null, duration: null }
  const answer = await media(device, 'GET_STATUS')
  const now = answer?.status?.[0]
  if (!now) return { state: 'STOPPED', position: null, duration: session.duration }
  if (now.media?.duration) session.duration = now.media.duration
  return { state: STATES[now.playerState] || 'TRANSITIONING', position: Number(now.currentTime) || 0, duration: session.duration }
}
