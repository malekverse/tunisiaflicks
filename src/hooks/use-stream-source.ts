"use client"
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { StreamProvider } from '@/src/lib/stream-providers'
import type { SourceHealth } from '@/src/lib/stream-health'
import { rankSources, titleStatus, type Counts } from '@/src/lib/source-rank'
import { LOCAL_PLAYER_SOURCE } from '@/src/hooks/use-desktop-app'

const REMEMBER_KEY = 'tf-stream-source'
/** The source that last worked for this viewer, title by title ({"movie:550": "VidLink"}). */
const TITLES_KEY = 'tf-stream-source:titles'
const TITLES_KEPT = 300
/** Seconds of (visible) playback after which a source counts as "worked". */
export const WORKED_AFTER_SECONDS = 90

const storage = {
  get: (key: string) => { try { return localStorage.getItem(key) } catch { return null } },
  set: (key: string, value: string) => { try { localStorage.setItem(key, value) } catch { /* private mode */ } },
}

function titlesWorked(): Record<string, string> {
  try {
    const value = JSON.parse(storage.get(TITLES_KEY) ?? '{}')
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  } catch {
    return {}
  }
}
function rememberForTitle(title: string, name: string | null) {
  const map = titlesWorked()
  delete map[title]
  // Newest last; the oldest go when there are too many.
  const entries = Object.entries(name ? { ...map, [title]: name } : map).slice(-TITLES_KEPT)
  storage.set(TITLES_KEY, JSON.stringify(Object.fromEntries(entries)))
}

let healthPromise: Promise<Record<string, SourceHealth>> | null = null
const loadHealth = () => (healthPromise ??= fetch('/api/stream-health').then((res) => (res.ok ? res.json() : {})).catch(() => ({})))
const titleHealth = new Map<string, Promise<Record<string, Counts>>>()
const loadTitleHealth = (title: string) => {
  if (!titleHealth.has(title)) {
    titleHealth.set(title, fetch(`/api/stream-health?title=${encodeURIComponent(title)}`).then((res) => (res.ok ? res.json() : {})).catch(() => ({})))
  }
  return titleHealth.get(title)!
}

const report = (name: string, ok: boolean, title: string | null) =>
  fetch('/api/stream-health', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, ok, ...(title ? { title } : {}) }), keepalive: true }).catch(() => {})

/**
 * Which stream source to play, title by title (lib/source-rank): the one that worked for this
 * viewer on this title, else the one other viewers say plays it, else the viewer's usual source,
 * else the first one that isn't reported down. The desktop app's local player keeps its place at
 * the top; sources without pop-up ads come before the others; down ones go last.
 *
 * `title`: "movie:550" or "tv:1399" (a show as a whole). Without one, only the overall health counts.
 */
export function useStreamSource(services: StreamProvider[], { playing, title = null }: { playing: boolean, title?: string | null }) {
  const [health, setHealth] = useState<Record<string, SourceHealth>>({})
  const [here, setHere] = useState<{ title: string, counts: Record<string, Counts> } | null>(null)
  const [chosen, setChosen] = useState<string | null>(null)
  // undefined until read from storage (and the title's record, when there's a title): the player
  // waits for it, so it never loads one source and then jumps to another.
  const [remembered, setRemembered] = useState<{ mine: string | null, mineHere: string | null } | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    loadHealth().then((data) => { if (!cancelled) setHealth(data) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    setChosen(null)
    const mine = storage.get(REMEMBER_KEY) || null
    const mineHere = title ? titlesWorked()[title] ?? null : null
    if (!title) {
      setHere(null)
      setRemembered({ mine, mineHere })
      return
    }
    setRemembered(undefined)
    // A slow answer never holds the player more than a moment.
    const timer = setTimeout(() => { if (!cancelled) setRemembered({ mine, mineHere }) }, 1200)
    loadTitleHealth(title).then((counts) => {
      if (cancelled) return
      clearTimeout(timer)
      setHere({ title, counts })
      setRemembered({ mine, mineHere })
    })
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [title])

  const counts = useMemo(() => (here && here.title === title ? here.counts : {}), [here, title])

  const ranked = useMemo(() => {
    const overall = Object.fromEntries(Object.entries(health).map(([name, value]) => [name, value.status]))
    return rankSources({
      names: services.map((item) => item.name),
      overall,
      title: counts,
      mineHere: remembered?.mineHere ?? null,
      mine: remembered?.mine ?? null,
      preferred: new Set(services.filter((item) => item.sandbox || item.name === LOCAL_PLAYER_SOURCE).map((item) => item.name)),
      pinned: services.some((item) => item.name === LOCAL_PLAYER_SOURCE) ? LOCAL_PLAYER_SOURCE : null,
    })
  }, [services, health, counts, remembered])

  const ordered = useMemo(() => ranked.order.map((name) => services.find((item) => item.name === name)!).filter(Boolean), [ranked, services])
  const selected = (chosen && ordered.some((item) => item.name === chosen)) ? chosen : ranked.start
  const current = ordered.find((item) => item.name === selected) ?? ordered[0]

  const select = useCallback((name: string) => setChosen(name), [])
  const currentName = current?.name

  // Count visible playback time on the current source; at 90 s it "worked": remember it for this
  // viewer (and this title) and tell the server (once per source per page).
  const reported = useRef(new Set<string>())
  useEffect(() => {
    if (!playing || !currentName) return
    let seconds = 0
    const timer = setInterval(() => {
      if (document.visibilityState !== 'visible') return
      seconds += 5
      if (seconds < WORKED_AFTER_SECONDS) return
      clearInterval(timer)
      storage.set(REMEMBER_KEY, currentName)
      if (title) rememberForTitle(title, currentName)
      const key = `${currentName}:${title ?? ''}`
      if (!reported.current.has(key)) {
        reported.current.add(key)
        report(currentName, true, title)
      }
    }, 5000)
    return () => clearInterval(timer)
  }, [playing, currentName, title])

  /** "Not working?": report it and move to the next source. Returns the new source's name. */
  const reportBroken = useCallback(() => {
    if (!current) return null
    const key = `broken:${current.name}:${title ?? ''}`
    if (!reported.current.has(key)) {
      reported.current.add(key)
      report(current.name, false, title)
    }
    if (storage.get(REMEMBER_KEY) === current.name) storage.set(REMEMBER_KEY, '')
    if (title && titlesWorked()[title] === current.name) rememberForTitle(title, null)
    const index = ordered.findIndex((item) => item.name === current.name)
    const next = ordered[(index + 1) % ordered.length]
    setChosen(next.name)
    return next.name
  }, [current, ordered, title])

  /** What's known about a source on this title: 'good' (plays it for others), 'down', or nothing. */
  const titleHealthOf = useCallback((name: string) => {
    const value = counts[name]
    return value ? { status: titleStatus(value), plays: value.ok } : null
  }, [counts])

  return {
    ordered,
    current,
    select,
    reportBroken,
    health,
    titleHealthOf,
    /** Why the player started where it did ('title': other viewers' word on this title). */
    startReason: ranked.reason,
    remembered: remembered?.mineHere ?? remembered?.mine ?? null,
    ready: remembered !== undefined,
  }
}
