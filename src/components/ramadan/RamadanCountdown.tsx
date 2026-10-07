"use client"
import React, { useEffect, useState } from 'react'
import NumberFlow from '@number-flow/react'
import { useI18n } from '@/src/components/I18nProvider'

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
  const { t, dir } = useI18n()
  const [parts, setParts] = useState<Parts | null | undefined>(undefined)
  useEffect(() => {
    const tick = () => setParts(remaining(start))
    tick()
    const timer = setInterval(tick, 30000)
    return () => clearInterval(timer)
  }, [start])
  if (!parts) return null
  return (
    <div className="flex gap-2.5" role="timer" aria-live="off" dir="ltr">
      {([['days', parts.days], ['hours', parts.hours], ['minutes', parts.minutes]] as const).map(([name, value]) => (
        <span key={name} className="flex min-w-[5rem] flex-col items-center rounded-2xl bg-amber-200/[0.08] px-4 py-3 ring-1 ring-amber-200/20 backdrop-blur-md">
          <NumberFlow value={value} className="font-display text-[40px] font-extrabold leading-none tabular-nums text-amber-50" />
          <span className="mt-1.5 text-[12px] text-amber-100/70" dir={dir}>{t(`countdown.${name}`)}</span>
        </span>
      ))}
    </div>
  )
}
