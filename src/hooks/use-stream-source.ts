"use client"
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { StreamProvider } from '@/src/lib/stream-providers'
import type { SourceHealth } from '@/src/lib/stream-health'

const REMEMBER_KEY = 'tf-stream-source'
/** Seconds of (visible) playback after which a source counts as "worked". */
export const WORKED_AFTER_SECONDS = 90

const storage = {
  get: (key: string) => { try { return localStorage.getItem(key) } catch { return null } },
  set: (key: string, value: string) => { try { localStorage.setItem(key, value) } catch { /* private mode */ } },
}

let healthPromise: Promise<Record<string, SourceHealth>> | null = null
const loadHealth = () => (healthPromise ??= fetch('/api/stream-health').then((res) => (res.ok ? res.json() : {})).catch(() => ({})))

const report = (name: string, ok: boolean) =>
  fetch('/api/stream-health', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, ok }), keepalive: true }).catch(() => {})

/**
 * Which stream source to play: the one that last worked for this viewer, else the first one that
 * isn't reported down by other viewers. Sources reported down move to the end of the bar.
 */
export function useStreamSource(services: StreamProvider[], { playing }: { playing: boolean }) {
  const [health, setHealth] = useState<Record<string, SourceHealth>>({})
  const [chosen, setChosen] = useState<string | null>(null)
  // undefined until read from storage: the player waits for it, so it never loads twice.
  const [remembered, setRemembered] = useState<string | null | undefined>(undefined)

  useEffect(() => {
    setRemembered(storage.get(REMEMBER_KEY))
    let cancelled = false
    loadHealth().then((data) => { if (!cancelled) setHealth(data) })
    return () => { cancelled = true }
  }, [])

  // Curated order, with sources reported down moved last (stable otherwise).
  const ordered = useMemo(
    () => [...services].sort((a, b) => Number(health[a.name]?.status === 'down') - Number(health[b.name]?.status === 'down')),
    [services, health],
  )

  const fallback = (ordered.find((item) => item.name === remembered) ?? ordered[0])?.name ?? null
  const selected = (chosen && ordered.some((item) => item.name === chosen)) ? chosen : fallback
  const current = ordered.find((item) => item.name === selected) ?? ordered[0]

  const select = useCallback((name: string) => setChosen(name), [])
  const currentName = current?.name

  // Count visible playback time on the current source; at 90 s it "worked": remember it for this
  // viewer and tell the server (once per source per page).
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
      if (!reported.current.has(currentName)) {
        reported.current.add(currentName)
        report(currentName, true)
      }
    }, 5000)
    return () => clearInterval(timer)
  }, [playing, currentName])

  /** "Not working?": report it and move to the next source. Returns the new source's name. */
  const reportBroken = useCallback(() => {
    if (!current) return null
    if (!reported.current.has(`broken:${current.name}`)) {
      reported.current.add(`broken:${current.name}`)
      report(current.name, false)
    }
    if (storage.get(REMEMBER_KEY) === current.name) storage.set(REMEMBER_KEY, '')
    const index = ordered.findIndex((item) => item.name === current.name)
    const next = ordered[(index + 1) % ordered.length]
    setChosen(next.name)
    return next.name
  }, [current, ordered])

  return { ordered, current, select, reportBroken, health, remembered: remembered ?? null, ready: remembered !== undefined }
}
