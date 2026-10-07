"use client"
import React, { useEffect, useState } from 'react'
import { useT } from '@/src/components/I18nProvider'

type Parts = { days: number, hours: number, minutes: number }

// Midnight (Tunis, UTC+1, no DST) at the start of the first day of fasting.
function remaining(start: string): Parts | null {
  const ms = Date.parse(`${start}T00:00:00+01:00`) - Date.now()
  if (ms <= 0) return null
  const minutes = Math.floor(ms / 60000)
  return { days: Math.floor(minutes / 1440), hours: Math.floor((minutes % 1440) / 60), minutes: minutes % 60 }
}

/** Live days / hours / minutes until Ramadan begins. Client-only (depends on the clock). */
export default function RamadanCountdown({ start }: { start: string }) {
  const t = useT()
  const [parts, setParts] = useState<Parts | null | undefined>(undefined)
  useEffect(() => {
    const tick = () => setParts(remaining(start))
    tick()
    const timer = setInterval(tick, 30000)
    return () => clearInterval(timer)
  }, [start])
  if (!parts) return null
  return (
    <div className="flex gap-2" role="timer" aria-live="off">
      {([['days', parts.days], ['hours', parts.hours], ['minutes', parts.minutes]] as const).map(([name, value]) => (
        <span key={name} className="flex min-w-[4rem] flex-col items-center rounded-xl bg-white/10 px-3 py-2 ring-1 ring-white/15">
          <span className="text-3xl font-bold tabular-nums">{value}</span>
          <span className="text-[11px] uppercase text-amber-100/80">{t(`countdown.${name}`)}</span>
        </span>
      ))}
    </div>
  )
}
