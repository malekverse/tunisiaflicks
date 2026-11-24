"use client"
// Screen time for the Kids profile in use (lib/screen-time): what it may still watch now. Asks the
// server once for the settings and today's minutes, then counts here while `watching` (the player
// open on a page in view), reporting every few minutes and when the page is left.
import { useEffect, useRef, useState } from 'react'
import { localClock, screenState, WAKE, type ScreenState, type ScreenTime } from '@/src/lib/screen-time'

const TICK_MS = 15_000
const REPORT_EVERY_S = 180

export type ScreenNow = ScreenState & { wake: string }
const NONE: ScreenNow = { stop: null, left: null, wake: WAKE }

export function useScreenTime(kids: boolean, watching: boolean): ScreenNow {
  const [screen, setScreen] = useState<ScreenTime | null>(null)
  const [base, setBase] = useState<{ day: string, used: number } | null>(null)
  const [state, setState] = useState<ScreenState>(NONE)
  const pending = useRef(0)
  const watchingRef = useRef(watching)
  watchingRef.current = watching

  // The settings and today's minutes, again when the day changes.
  const [day, setDay] = useState<string | null>(null)
  useEffect(() => {
    if (!kids) return
    setDay(localClock().day)
    const id = window.setInterval(() => setDay(localClock().day), 60_000)
    return () => window.clearInterval(id)
  }, [kids])
  useEffect(() => {
    if (!kids || !day) return
    let cancelled = false
    fetch(`/api/profiles/screen-time?day=${day}`, { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (cancelled || !data) return
        setScreen(data.screen ?? null)
        setBase({ day, used: Number(data.used) || 0 })
        pending.current = 0
      })
      .catch(() => { /* offline: nothing limits this page */ })
    return () => { cancelled = true }
  }, [kids, day])

  // Count while watching; report now and then, and when the page goes away.
  useEffect(() => {
    if (!kids || !screen || !base) return
    const report = (beacon: boolean) => {
      const minutes = Math.floor(pending.current / 60)
      if (minutes < 1) return
      pending.current -= minutes * 60
      const body = JSON.stringify({ day: base.day, minutes })
      if (beacon && navigator.sendBeacon?.('/api/profiles/screen-time', new Blob([body], { type: 'application/json' }))) {
        setBase((current) => (current ? { ...current, used: current.used + minutes } : current))
        return
      }
      fetch('/api/profiles/screen-time', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true })
        .then((response) => (response.ok ? response.json() : null))
        .then((data) => { if (data && Number.isFinite(data.used)) setBase((current) => (current ? { ...current, used: data.used } : current)) })
        .catch(() => { pending.current += minutes * 60 })
    }
    const update = () => {
      const clock = localClock()
      setState(screenState(screen, base.used + pending.current / 60, clock.minutes))
    }
    const tick = () => {
      // Nothing counts once it has stopped (the player is gone).
      const stopped = screenState(screen, base.used + pending.current / 60, localClock().minutes).stop
      if (!stopped && watchingRef.current && document.visibilityState === 'visible') pending.current += TICK_MS / 1000
      if (pending.current >= REPORT_EVERY_S) report(false)
      update()
    }
    update()
    const id = window.setInterval(tick, TICK_MS)
    const onHide = () => { if (document.visibilityState === 'hidden') report(true) }
    const onLeave = () => report(true)
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', onLeave)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', onLeave)
      report(true)
    }
  }, [kids, screen, base])

  return kids && screen ? { ...state, wake: screen.wake } : NONE
}
