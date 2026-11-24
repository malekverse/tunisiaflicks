"use client"
// The player's sleep timer (lib/sleep-timer has the rules). Kept in this tab's session storage, so
// it carries on when the next episode opens a new page, and ticks once a second only while set.
import { useCallback, useEffect, useState } from 'react'
import { episodeTimer, extend, isDue, minutesTimer, readTimer, type SleepTimer } from '@/src/lib/sleep-timer'

const KEY = 'tf-sleep-timer'

function load(): SleepTimer | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    return raw ? readTimer(JSON.parse(raw), Date.now()) : null
  } catch {
    return null
  }
}

function store(timer: SleepTimer | null) {
  try {
    if (timer) sessionStorage.setItem(KEY, JSON.stringify(timer))
    else sessionStorage.removeItem(KEY)
  } catch { /* private mode: the timer lives on this page only */ }
}

export type SleepState = {
  timer: SleepTimer | null
  /** Milliseconds left (0 when there's no timer). */
  remaining: number
  /** The timer ran out: the player is stopped until `wake`. */
  asleep: boolean
  setMinutes: (minutes: number) => void
  /** Null when the running time isn't known. */
  setEpisode: (() => void) | null
  cancel: () => void
  more: () => void
  /** Stop now (the desktop app's player asked for the next episode while "end of episode" was set). */
  sleepNow: () => void
  wake: () => void
}

/** `media` names what's playing ("tv:1399:1:2"); `runtime` is its running time in minutes. */
export function useSleepTimer(media: string | null, runtime: number | null | undefined): SleepState {
  const [timer, setTimer] = useState<SleepTimer | null>(null)
  const [asleep, setAsleep] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => { setTimer(load()) }, [])

  const update = useCallback((next: SleepTimer | null) => {
    setTimer(next)
    store(next)
    setNow(Date.now())
  }, [])

  // Ticks while a timer is set; checks it each time.
  useEffect(() => {
    if (!timer) return
    const check = () => {
      const at = Date.now()
      setNow(at)
      if (isDue(timer, at, media)) {
        update(null)
        setAsleep(true)
      }
    }
    check()
    const id = window.setInterval(check, 1000)
    return () => window.clearInterval(id)
  }, [timer, media, update])

  const canEpisode = !!media && !!runtime && runtime > 0
  return {
    timer,
    remaining: timer ? Math.max(0, timer.endsAt - now) : 0,
    asleep,
    setMinutes: (minutes) => update(minutesTimer(minutes, Date.now())),
    setEpisode: canEpisode ? () => update(episodeTimer(runtime, media!, Date.now())) : null,
    cancel: () => update(null),
    more: () => { if (timer) update(extend(timer, Date.now())) },
    sleepNow: () => { update(null); setAsleep(true) },
    wake: () => setAsleep(false),
  }
}
