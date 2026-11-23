// Your phone as a remote: the player shows a QR code, the phone opens it, and the phone's page
// (views/remote.html) plays, pauses, seeks, sets the volume, the subtitles, skips the intro and
// goes to the next episode, over the home Wi-Fi. Nothing goes through the internet.
//
// For this one thing the player answers on the home network, like "Play on TV" does: a separate
// small server on this computer's LAN address that serves only /r/<token>, its events and its
// commands. The token is a random 128-bit secret, in the QR code; without it, nothing. The phone
// can only send the few commands below, never reach the engine or the files. The link is kept
// (DATA_DIR/remote.json, with its port) so a phone that saved it keeps working the next day, until
// the viewer turns the remote off, which forgets it.

import crypto from 'node:crypto'
import dgram from 'node:dgram'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { isPrivateIPv4 } from './dlna.js'

/** What a phone may ask, and how its value is checked. */
export const COMMANDS = {
  toggle: () => null,
  play: () => null,
  pause: () => null,
  seek: (v) => (Number.isFinite(v) && v >= 0 && v < 1e6 ? v : undefined),
  nudge: (v) => (Number.isFinite(v) && Math.abs(v) <= 120 ? v : undefined),
  volume: (v) => (Number.isFinite(v) && v >= 0 && v <= 1 ? v : undefined),
  mute: () => null,
  subs: (v) => (typeof v === 'string' && /^(off|[a-z]{2,3}(-[A-Za-z]{2,4})?)$/.test(v) ? v : undefined),
  skip: () => null,
  next: () => null,
}

/** A phone's command, checked: { action, value } or null. */
export function readCommand(body) {
  const action = typeof body?.action === 'string' ? body.action : ''
  if (!Object.hasOwn(COMMANDS, action)) return null
  const value = COMMANDS[action](body.value)
  return value === undefined ? null : { action, value }
}

const VIRTUAL = /vEthernet|VirtualBox|VMware|Hyper-V|WSL|Loopback|Tailscale|ZeroTier|Docker|vboxnet|utun|tun\d|tap\d/i

/**
 * This computer's address on the home network: the one its default route goes out of (asking the
 * system, nothing is sent), else the first private address of a real network card.
 */
export function homeAddress() {
  return new Promise((resolve) => {
    const fallback = () => {
      const found = Object.entries(os.networkInterfaces())
        .filter(([name]) => !VIRTUAL.test(name))
        .flatMap(([, list]) => list || [])
        .find((a) => a.family === 'IPv4' && !a.internal && isPrivateIPv4(a.address) && !a.address.startsWith('169.254.'))
      resolve(found?.address ?? null)
    }
    const socket = dgram.createSocket('udp4')
    socket.on('error', () => { try { socket.close() } catch {} fallback() })
    socket.connect(53, '1.1.1.1', () => {
      let address = null
      try { address = socket.address().address } catch {}
      try { socket.close() } catch {}
      if (address && isPrivateIPv4(address) && !address.startsWith('169.254.')) resolve(address)
      else fallback()
    })
  })
}

/**
 * The remote: start() / stop() / status(); the player page connects with player(res) (its commands
 * arrive there) and sends what's playing with setState(state).
 */
export function createRemote({ dataDir, page }) {
  const file = path.join(dataDir, 'remote.json')
  let saved = (() => { try { const s = JSON.parse(fs.readFileSync(file, 'utf8')); return /^[A-Za-z0-9_-]{22}$/.test(s.token) ? s : null } catch { return null } })()
  let lan = null              // { server, address, port }
  let state = null            // what's playing, from the player page
  const players = new Set()   // SSE responses of the player pages (the newest gets the commands)
  const phones = new Set()    // SSE responses of the phones

  const sse = (res, event, data) => { try { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`) } catch {} }
  const toPhones = (event, data) => { for (const res of phones) sse(res, event, data) }
  const toPlayers = (event, data) => { for (const res of players) sse(res, event, data) }
  const tellCount = () => toPlayers('phones', { count: phones.size })
  const url = () => (lan && saved ? `http://${lan.address}:${lan.port}/r/${saved.token}` : null)

  function handle(req, res) {
    const match = /^\/r\/([A-Za-z0-9_-]{22})(\/events|\/cmd)?$/.exec((req.url || '').split('?')[0])
    const ok = match && saved && crypto.timingSafeEqual(Buffer.from(match[1]), Buffer.from(saved.token))
    if (!ok) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found') }
    const route = match[2] || ''
    if (route === '' && req.method === 'GET') {
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      })
      return res.end(fs.readFileSync(page))
    }
    if (route === '/events' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' })
      res.write('retry: 2000\n\n')
      phones.add(res)
      sse(res, 'state', { ...(state || {}), player: players.size > 0 })
      tellCount()
      const ping = setInterval(() => { try { res.write(': ping\n\n') } catch {} }, 20000)
      req.on('close', () => { clearInterval(ping); phones.delete(res); tellCount() })
      return
    }
    if (route === '/cmd' && req.method === 'POST') {
      let body = ''
      req.on('data', (d) => { body += d; if (body.length > 2048) req.destroy() })
      req.on('end', () => {
        let command = null
        try { command = readCommand(JSON.parse(body || '{}')) } catch {}
        if (!command) { res.writeHead(400); return res.end() }
        const newest = [...players].pop()
        if (!newest) { res.writeHead(409); return res.end() }
        sse(newest, 'command', command)
        res.writeHead(204)
        res.end()
      })
      return
    }
    res.writeHead(405)
    res.end()
  }

  async function listen() {
    const address = await homeAddress()
    if (!address) throw Object.assign(new Error('Not connected to a network'), { status: 503 })
    const server = http.createServer(handle)
    const tryPort = (port) => new Promise((resolve, reject) => {
      server.once('error', reject)
      server.listen(port, address, () => { server.removeListener('error', reject); resolve(server.address().port) })
    })
    let port
    try { port = await tryPort(saved?.port || 0) } catch { port = await tryPort(0) }
    lan = { server, address, port }
  }

  async function start() {
    if (!saved) saved = { token: crypto.randomBytes(16).toString('base64url') }
    if (!lan) await listen()
    if (saved.port !== lan.port) {
      saved.port = lan.port
      fs.mkdirSync(dataDir, { recursive: true })
      fs.writeFileSync(file, JSON.stringify(saved))
    }
    return status()
  }

  function stop() {
    toPhones('closed', { reason: 'off' })
    for (const res of phones) { try { res.end() } catch {} }
    phones.clear()
    lan?.server.close()
    lan = null
    saved = null
    try { fs.rmSync(file, { force: true }) } catch {}
    tellCount()
  }

  const status = () => ({ on: !!lan, url: url(), phones: phones.size })

  return {
    start,
    stop,
    status,
    /** Turned on before: back on when the player starts, so a saved link keeps working. */
    resume: () => (saved ? start().catch(() => null) : Promise.resolve(null)),
    /** A player page's event stream: the phones' commands come down it. */
    player(req, res) {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' })
      res.write('retry: 2000\n\n')
      players.add(res)
      sse(res, 'phones', { count: phones.size })
      toPhones('state', { ...(state || {}), player: true })
      const ping = setInterval(() => { try { res.write(': ping\n\n') } catch {} }, 20000)
      req.on('close', () => {
        clearInterval(ping)
        players.delete(res)
        if (!players.size) toPhones('state', { ...(state || {}), player: false })
      })
    },
    setState(next) {
      state = next
      toPhones('state', { ...state, player: players.size > 0 })
    },
  }
}

/** What a player page may say about what's playing (anything else is dropped). */
export function cleanState(body) {
  const text = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '')
  const num = (v) => (Number.isFinite(v) ? Math.max(0, v) : 0)
  const subs = Array.isArray(body?.subs) ? body.subs.slice(0, 30).filter((s) => s && typeof s.lang === 'string' && /^[a-z]{2,3}(-[A-Za-z]{2,4})?$/.test(s.lang)).map((s) => ({ lang: s.lang, label: text(s.label, 40) })) : []
  return {
    title: text(body?.title, 120),
    episode: text(body?.episode, 80),
    playing: body?.playing === true,
    loading: body?.loading === true,
    t: num(body?.t),
    d: num(body?.d),
    volume: Math.min(1, num(body?.volume)),
    muted: body?.muted === true,
    subs,
    sub: typeof body?.sub === 'string' && subs.some((s) => s.lang === body.sub) ? body.sub : null,
    skip: body?.skip === 'intro' || body?.skip === 'recap' ? body.skip : null,
    next: body?.next === true,
    nextLabel: text(body?.nextLabel, 80),
  }
}
