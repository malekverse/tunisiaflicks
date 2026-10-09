"use client"
import { useEffect, useState } from 'react'
import { countdownParts, type CountdownParts } from '@/src/lib/seasons'

const same = (a: CountdownParts, b: CountdownParts) =>
  a.days === b.days && a.hours === b.hours && a.minutes === b.minutes && a.seconds === b.seconds

const isZero = (parts: CountdownParts) => parts.days + parts.hours + parts.minutes + parts.seconds === 0

/**
 * Days, hours, minutes (and seconds) until `atMs`. The first render shows `initial` (what the
 * server worked out), so nothing jumps on hydration; then it ticks exactly when the shown value
 * changes (on the minute, or on the second with `seconds`), sleeps while the page is hidden and
 * catches up the moment it is shown again.
 */
export function useCountdown(
  atMs: number,
  o: { seconds: boolean; initial: { days: number; hours: number; minutes: number; seconds: number } },
): { parts: { days: number; hours: number; minutes: number; seconds: number }; done: boolean } {
  const { seconds } = o
  const [parts, setParts] = useState<CountdownParts>(o.initial)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const step = seconds ? 1000 : 60000

    const tick = () => {
      clearTimeout(timer)
      const left = atMs - Date.now()
      const next = countdownParts(left, seconds)
      setParts((previous) => (same(previous, next) ? previous : next))
      if (left <= 0 || document.visibilityState === 'hidden') return
      // The next time the shown value changes: when `left` crosses a whole step.
      const wait = left % step || step
      timer = setTimeout(tick, Math.min(wait + 15, step))
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') tick()
      else clearTimeout(timer)
    }

    tick()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [atMs, seconds])

  return { parts, done: isZero(parts) }
}
