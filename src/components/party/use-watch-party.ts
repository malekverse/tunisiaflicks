"use client"
// A watch party around the desktop app's player (lib/party-rules). The host's page and each
// guest's page connect directly (WebRTC data channels, host in the middle); the site's API only
// passes a guest's connection offer to the host and the answer back. Then, whenever someone plays,
// pauses or jumps, their player tells this page, which tells the others, whose pages tell their
// players. Every few seconds the host's position goes out too, to correct any drift. Reactions
// (emoji) and "next episode" travel the same way.
import { useCallback, useEffect, useRef, useState } from 'react'
import { normalizePartyCode, partyPath, readPartyMessage, type PartyMedia, type PartyMessage, type Reaction } from '@/src/lib/party-rules'

const ICE_SERVERS: RTCIceServer[] = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }]
const GATHER_MS = 5000
const ANSWER_WAIT_MS = 90_000
const HOST_KEY = (code: string) => `tf-party-host:${code}`

export type PartyStatus = 'idle' | 'starting' | 'open' | 'joining' | 'waiting' | 'connected' | 'lost' | 'ended' | 'failed'
type NewEvent = { kind: 'react', emoji: Reaction, name: string } | { kind: 'note', text: PartyNote }
export type PartyEvent = NewEvent & { id: number }
export type PartyNote = { what: 'played' | 'paused' | 'jumped' | 'joined' | 'left' | 'next', name: string, at?: number }

type Conn = { id: string, name: string, pc: RTCPeerConnection, channel: RTCDataChannel | null, rtt: number }
export type PlayerState = { playing: boolean, t: number, beat?: boolean, echo?: boolean }

/** Until ICE has gathered every candidate (or GATHER_MS), so one offer/answer carries them all. */
function gathered(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve()
  return new Promise((resolve) => {
    const done = () => { pc.removeEventListener('icegatheringstatechange', check); clearTimeout(timer); resolve() }
    const check = () => { if (pc.iceGatheringState === 'complete') done() }
    const timer = setTimeout(done, GATHER_MS)
    pc.addEventListener('icegatheringstatechange', check)
  })
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export function useWatchParty({ media, title, myName, tellPlayer, goNext, enabled }: {
  media: PartyMedia | null
  title: string
  myName: string
  /** Messages to this page's player (the party's position for it to follow). */
  tellPlayer: (data: Record<string, unknown>) => void
  goNext: () => void
  /** The player can take part (a desktop app player that knows parties). */
  enabled: boolean
}) {
  const [status, setStatus] = useState<PartyStatus>('idle')
  const [role, setRole] = useState<'host' | 'guest' | null>(null)
  const [code, setCode] = useState<string | null>(null)
  const [people, setPeople] = useState<string[]>([])
  const [events, setEvents] = useState<PartyEvent[]>([])
  const [error, setError] = useState<string | null>(null)

  const conns = useRef(new Map<string, Conn>())
  const hostToken = useRef<string | null>(null)
  const roleRef = useRef<'host' | 'guest' | null>(null)
  const codeRef = useRef<string | null>(null)
  const last = useRef<{ playing: boolean, pos: number, at: number } | null>(null)
  const alive = useRef(true)
  const eventId = useRef(0)
  const retries = useRef(0)
  /** A guest's player that just (re)loaded asks the party where it is before saying anything. */
  const needsSync = useRef(false)
  const handlers = useRef({ tellPlayer, goNext, myName })
  handlers.current = { tellPlayer, goNext, myName }

  const lastNote = useRef({ key: '', at: 0 })
  const push = useCallback((event: NewEvent) => {
    // A jump and the play that comes with it say the same thing: once is enough.
    if (event.kind === 'note') {
      const key = `${event.text.what}:${event.text.name}:${Math.round(event.text.at ?? 0)}`
      if (key === lastNote.current.key && Date.now() - lastNote.current.at < 2000) return
      lastNote.current = { key, at: Date.now() }
    }
    const id = ++eventId.current
    setEvents((list) => [...list.slice(-12), { ...event, id }])
    setTimeout(() => setEvents((list) => list.filter((entry) => entry.id !== id)), event.kind === 'react' ? 3200 : 3600)
  }, [])

  const sendTo = (conn: Conn, message: PartyMessage) => {
    if (conn.channel?.readyState === 'open') conn.channel.send(JSON.stringify(message))
  }
  const broadcast = useCallback((message: PartyMessage, except?: string) => {
    for (const conn of conns.current.values()) if (conn.id !== except) sendTo(conn, message)
  }, [])
  const sendPeople = useCallback(() => {
    const names = [handlers.current.myName, ...[...conns.current.values()].filter((conn) => conn.channel?.readyState === 'open').map((conn) => conn.name)]
    setPeople(names)
    broadcast({ t: 'people', names })
  }, [broadcast])

  /** The party's position, for this page's player to follow. */
  const follow = useCallback((state: { playing: boolean, pos: number, beat?: boolean }, rtt: number) => {
    last.current = { playing: state.playing, pos: state.pos, at: Date.now() }
    const target = state.pos + (state.playing ? Math.max(0, rtt) / 2000 : 0)
    // The player knows where it really is: it moves only when it's further off than the tolerance
    // (more for a heartbeat than for a jump someone just made).
    handlers.current.tellPlayer({ party: { playing: state.playing, t: target, tolerance: state.beat ? 2.5 : 0.75 } })
  }, [])

  const onMessage = useCallback((conn: Conn, raw: unknown) => {
    const message = readPartyMessage(raw)
    if (!message) return
    const host = roleRef.current === 'host'
    switch (message.t) {
      case 'hello':
        if (host) {
          if (message.name) conn.name = message.name
          sendPeople()
          push({ kind: 'note', text: { what: 'joined', name: conn.name } })
          if (last.current) sendTo(conn, { t: 'state', ...currentState(last.current), by: handlers.current.myName })
        }
        break
      case 'people':
        if (!host) setPeople(message.names)
        break
      case 'sync':
        if (host && last.current) sendTo(conn, { t: 'state', ...currentState(last.current), by: handlers.current.myName })
        break
      case 'state': {
        // The host speaks for its guests: their names are the ones it knows.
        const by = host ? conn.name : message.by
        if (host) broadcast({ ...message, by }, conn.id)
        const before = last.current
        follow(message, conn.rtt)
        if (!message.beat) {
          const what = before && before.playing !== message.playing ? (message.playing ? 'played' : 'paused') : 'jumped'
          push({ kind: 'note', text: { what, name: by, at: message.pos } })
        }
        break
      }
      case 'react':
        if (host) broadcast({ ...message, name: conn.name }, conn.id)
        push({ kind: 'react', emoji: message.e, name: host ? conn.name : message.name })
        break
      case 'next':
        if (host) broadcast({ ...message, by: conn.name }, conn.id)
        push({ kind: 'note', text: { what: 'next', name: host ? conn.name : message.by } })
        handlers.current.goNext()
        break
      case 'ping':
        sendTo(conn, { t: 'pong', at: message.at })
        break
      case 'pong':
        conn.rtt = Math.min(5000, Math.max(0, Date.now() - message.at))
        break
      case 'end':
        if (!host) {
          setStatus('ended')
          closeAll()
        }
        break
    }
  }, [broadcast, follow, push, sendPeople]) // eslint-disable-line react-hooks/exhaustive-deps

  const wire = useCallback((conn: Conn, channel: RTCDataChannel) => {
    conn.channel = channel
    channel.onmessage = (event) => onMessage(conn, event.data)
    channel.onopen = () => {
      if (roleRef.current === 'guest') {
        retries.current = 0
        setStatus('connected')
        sendTo(conn, { t: 'hello', name: handlers.current.myName })
        sendTo(conn, { t: 'sync' })
      }
    }
    channel.onclose = () => {
      if (!alive.current) return
      if (roleRef.current === 'host') {
        conns.current.delete(conn.id)
        conn.pc.close()
        sendPeople()
        push({ kind: 'note', text: { what: 'left', name: conn.name } })
      } else if (codeRef.current) {
        setStatus((current) => (current === 'ended' ? current : 'lost'))
      }
    }
  }, [onMessage, push, sendPeople])

  function closeAll() {
    for (const conn of conns.current.values()) {
      try { conn.channel?.close() } catch { /* already closed */ }
      conn.pc.close()
    }
    conns.current.clear()
  }

  // ---- host ------------------------------------------------------------------------------------

  const accept = useCallback(async (guest: { id: string, name: string, offer: string }) => {
    const party = codeRef.current
    if (!party || conns.current.has(guest.id)) return
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    const conn: Conn = { id: guest.id, name: guest.name, pc, channel: null, rtt: 120 }
    conns.current.set(guest.id, conn)
    pc.ondatachannel = (event) => wire(conn, event.channel)
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
        conns.current.delete(guest.id)
        pc.close()
        sendPeople()
      }
    }
    try {
      await pc.setRemoteDescription({ type: 'offer', sdp: guest.offer })
      await pc.setLocalDescription(await pc.createAnswer())
      await gathered(pc)
      await fetch(`/api/party/${party}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'answer', hostToken: hostToken.current, memberId: guest.id, answer: pc.localDescription?.sdp }),
      })
    } catch {
      conns.current.delete(guest.id)
      pc.close()
    }
  }, [sendPeople, wire])

  // The host's page looks for knocking guests: often at first, then less and less (and slowly
  // while the page is hidden), so a long film costs few requests.
  useEffect(() => {
    if (role !== 'host' || !code || status !== 'open') return
    let cancelled = false
    let lastJoin = Date.now()
    const loop = async () => {
      while (!cancelled) {
        try {
          const response = await fetch(`/api/party/${code}?host=${encodeURIComponent(hostToken.current ?? '')}`, { cache: 'no-store' })
          if (response.status === 404) { setStatus('ended'); return }
          const { guests } = await response.json() as { guests: { id: string, name: string, offer: string }[] }
          for (const guest of guests) {
            if (!conns.current.has(guest.id)) { lastJoin = Date.now(); accept(guest) }
          }
        } catch { /* offline for a moment */ }
        const quiet = Date.now() - lastJoin
        const wait = document.visibilityState !== 'visible' ? 20_000 : quiet < 3 * 60_000 ? 3000 : quiet < 15 * 60_000 ? 8000 : 15_000
        await sleep(wait)
      }
    }
    loop()
    return () => { cancelled = true }
  }, [role, code, status, accept])

  // The host's heartbeat is the player's (every 5 s while it plays); and a ping now and then, so
  // everyone knows how far the others are.
  useEffect(() => {
    if (!role) return
    const timer = setInterval(() => broadcast({ t: 'ping', at: Date.now() }), 10_000)
    return () => clearInterval(timer)
  }, [role, broadcast])

  const start = useCallback(async () => {
    if (!media || !enabled) return
    setStatus('starting')
    setError(null)
    try {
      const response = await fetch('/api/party', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ media, title }) })
      if (!response.ok) throw new Error(String(response.status))
      const body = await response.json() as { code: string, hostToken: string }
      hostToken.current = body.hostToken
      try { sessionStorage.setItem(HOST_KEY(body.code), body.hostToken) } catch { /* private mode */ }
      roleRef.current = 'host'
      codeRef.current = body.code
      setRole('host')
      setCode(body.code)
      setPeople([handlers.current.myName])
      setStatus('open')
      const url = new URL(window.location.href)
      url.searchParams.set('party', body.code)
      window.history.replaceState(window.history.state, '', url)
    } catch {
      setStatus('failed')
      setError('start')
    }
  }, [media, title, enabled])

  // ---- guest -----------------------------------------------------------------------------------

  const join = useCallback(async (raw: string) => {
    const party = normalizePartyCode(raw)
    if (!party || !enabled) { setError('code'); return }
    // Back on a party this page started (a reload): host it again.
    let saved: string | null = null
    try { saved = sessionStorage.getItem(HOST_KEY(party)) } catch { /* private mode */ }
    if (saved) {
      hostToken.current = saved
      roleRef.current = 'host'
      codeRef.current = party
      setRole('host')
      setCode(party)
      setPeople([handlers.current.myName])
      setStatus('open')
      return
    }
    // A code typed on another title's page: first to the party's title (its page offers to join).
    if (media) {
      const info = await fetch(`/api/party/${party}`, { cache: 'no-store' }).then((response) => (response.ok ? response.json() : null)).catch(() => null) as { media: PartyMedia } | null
      if (!info) { setError('not_found'); return }
      if (!sameMedia(info.media, media)) { window.location.assign(partyPath(info.media, party)); return }
    }
    closeAll()
    roleRef.current = 'guest'
    codeRef.current = party
    setRole('guest')
    setCode(party)
    setError(null)
    setStatus('joining')
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    const conn: Conn = { id: 'host', name: '', pc, channel: null, rtt: 120 }
    conns.current.set('host', conn)
    wire(conn, pc.createDataChannel('party'))
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' && codeRef.current === party) setStatus('lost')
    }
    try {
      await pc.setLocalDescription(await pc.createOffer())
      await gathered(pc)
      const response = await fetch(`/api/party/${party}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'join', offer: pc.localDescription?.sdp }) })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        setStatus('failed')
        setError(body.error === 'full' ? 'full' : body.error === 'not_found' ? 'not_found' : body.error === 'own' ? 'own' : 'join')
        closeAll()
        return
      }
      setStatus('waiting')
      const until = Date.now() + ANSWER_WAIT_MS
      while (Date.now() < until && codeRef.current === party && alive.current) {
        await sleep(2000)
        const poll = await fetch(`/api/party/${party}?member=${encodeURIComponent(body.memberId)}&token=${encodeURIComponent(body.memberToken)}`, { cache: 'no-store' }).catch(() => null)
        if (poll?.status === 404) { setStatus('failed'); setError('not_found'); closeAll(); return }
        const answer = poll?.ok ? (await poll.json()).answer as string | null : null
        if (answer) {
          await pc.setRemoteDescription({ type: 'answer', sdp: answer })
          return
        }
      }
      if (codeRef.current === party) { setStatus('failed'); setError('host_away'); closeAll() }
    } catch {
      setStatus('failed')
      setError('join')
      closeAll()
    }
  }, [enabled, wire, media])

  // The host moved to another episode: the party's link takes latecomers there.
  const mediaKey = media ? JSON.stringify(media) : ''
  useEffect(() => {
    const party = codeRef.current
    if (role !== 'host' || !party || !mediaKey) return
    fetch(`/api/party/${party}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'media', hostToken: hostToken.current, media: JSON.parse(mediaKey) }) }).catch(() => {})
  }, [role, mediaKey])

  // A guest whose connection dropped knocks again (a few times).
  useEffect(() => {
    if (status !== 'lost' || role !== 'guest' || !code || retries.current >= 3) return
    retries.current++
    const timer = setTimeout(() => join(code), 3000)
    return () => clearTimeout(timer)
  }, [status, role, code, join])

  // ---- both ------------------------------------------------------------------------------------

  const leave = useCallback(async () => {
    const party = codeRef.current
    if (roleRef.current === 'host' && party) {
      broadcast({ t: 'end' })
      fetch(`/api/party/${party}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'end', hostToken: hostToken.current }) }).catch(() => {})
      try { sessionStorage.removeItem(HOST_KEY(party)) } catch { /* private mode */ }
    }
    closeAll()
    roleRef.current = null
    codeRef.current = null
    hostToken.current = null
    last.current = null
    setRole(null)
    setCode(null)
    setPeople([])
    setStatus('idle')
    const url = new URL(window.location.href)
    if (url.searchParams.has('party')) {
      url.searchParams.delete('party')
      window.history.replaceState(window.history.state, '', url)
    }
  }, [broadcast])

  /** What this page's player just did (play, pause, a jump, or its heartbeat). */
  const onPlayerState = useCallback((state: PlayerState) => {
    if (!roleRef.current || state.echo) return
    // A guest's player starting (its own autoplay, where it left off) asks where the party is
    // instead of taking everyone there.
    if (needsSync.current && roleRef.current === 'guest') {
      needsSync.current = false
      broadcast({ t: 'sync' })
      return
    }
    const moved = !last.current || last.current.playing !== state.playing || state.beat !== true
    last.current = { playing: state.playing, pos: state.t, at: Date.now() }
    // Only the host's heartbeat keeps everyone in step.
    if (state.beat && roleRef.current !== 'host') return
    if (moved || state.beat) broadcast({ t: 'state', playing: state.playing, pos: state.t, by: handlers.current.myName, ...(state.beat ? { beat: true } : {}) })
  }, [broadcast])

  /** This page's player (re)loaded (a new episode, a new source): whether a party is on for it. */
  const onPlayerHello = useCallback((): boolean => {
    if (roleRef.current === 'guest') needsSync.current = true
    return !!roleRef.current
  }, [])

  /** This viewer moved to the next episode: everyone goes. */
  const onPlayerNext = useCallback(() => {
    if (roleRef.current) broadcast({ t: 'next', by: handlers.current.myName })
  }, [broadcast])

  const react = useCallback((emoji: Reaction) => {
    if (!roleRef.current) return
    broadcast({ t: 'react', e: emoji, name: handlers.current.myName })
    push({ kind: 'react', emoji, name: handlers.current.myName })
  }, [broadcast, push])

  // The player reports while a party is on (and stops when it ends).
  useEffect(() => { tellPlayer({ partyOn: !!role && (status === 'open' || status === 'connected') }) }, [role, status, tellPlayer])

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      closeAll()
    }
  }, [])

  return { status, role, code, people, events, error, start, join, leave, react, onPlayerState, onPlayerHello, onPlayerNext }
}

const sameMedia = (a: PartyMedia, b: PartyMedia) =>
  a.type === b.type && a.id === b.id && (a.type === 'movie' || (b.type === 'tv' && a.season === b.season && a.episode === b.episode))

/** Where the party is now: the last known position, moved on by the time since, while playing. */
function currentState(last: { playing: boolean, pos: number, at: number }): { playing: boolean, pos: number } {
  return { playing: last.playing, pos: last.playing ? last.pos + (Date.now() - last.at) / 1000 : last.pos }
}

