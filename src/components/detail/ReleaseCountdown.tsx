"use client"
import React, { useEffect, useState } from 'react'
import NumberFlow from '@number-flow/react'
import { CalendarPlus } from 'lucide-react'
import { FaGoogle } from 'react-icons/fa6'
import { useI18n } from '@/src/components/I18nProvider'
import { googleCalendarUrl, type ReleaseEvent } from '@/src/lib/calendar'

type Parts = { days: number, hours: number, minutes: number }

// Counts down to local midnight of the release date (TMDB has dates, not times).
function remaining(date: string): Parts | null {
  const [year, month, day] = date.split('-').map(Number)
  const ms = new Date(year, month - 1, day).getTime() - Date.now()
  if (ms <= 0) return null
  const minutes = Math.floor(ms / 60000)
  return { days: Math.floor(minutes / 1440), hours: Math.floor((minutes % 1440) / 60), minutes: minutes % 60 }
}

/** "Releases in 12 days 4 hours 3 min" (or "Next episode S2E5 in ...") with Add to Google / Apple calendar. */
export default function ReleaseCountdown({ event }: { event: ReleaseEvent }) {
  const { t, dir } = useI18n()
  const [parts, setParts] = useState<Parts | null | undefined>(undefined)
  const [appUrl, setAppUrl] = useState('')

  useEffect(() => {
    setAppUrl(window.location.origin)
    const tick = () => setParts(remaining(event.date))
    tick()
    const timer = setInterval(tick, 30000)
    return () => clearInterval(timer)
  }, [event.date])

  // Rendered client-side only: the countdown depends on the viewer's clock.
  if (parts === undefined) return null

  return (
    <div className="mt-5 flex flex-col gap-3">
      <p className="text-sm font-medium text-red-400">
        {event.kind === 'tv'
          ? t(parts ? 'countdown.nextEpisodeIn' : 'countdown.nextEpisodeToday', { episode: event.episode ?? '' })
          : t(parts ? 'countdown.releasesIn' : 'countdown.outToday')}
      </p>
      {parts && (
        <div className="flex gap-2" role="timer" aria-live="off" dir="ltr">
          {([['days', parts.days], ['hours', parts.hours], ['minutes', parts.minutes]] as const).map(([name, value]) => (
            <span key={name} className="flex min-w-[4.25rem] flex-col items-center rounded-2xl bg-white/[0.07] px-3 py-2 ring-1 ring-white/10 backdrop-blur-md">
              <NumberFlow value={value} className="font-display text-[28px] font-bold leading-none tabular-nums" />
              <span className="mt-1 text-[11px] text-white/55" dir={dir}>{t(`countdown.${name}`)}</span>
            </span>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 text-[13px]">
        <span className="inline-flex items-center gap-1.5 text-white/60"><CalendarPlus aria-hidden className="h-4 w-4" />{t('countdown.addToCalendar')}</span>
        {appUrl && (
          <a href={googleCalendarUrl(event, appUrl)} target="_blank" rel="noopener noreferrer"
            className="pressable inline-flex h-8 items-center gap-1.5 rounded-full bg-white/[0.08] px-3 transition-colors hover:bg-white/[0.14]">
            <FaGoogle className="text-[11px]" /> Google
          </a>
        )}
        <a href={`/api/calendar?type=${event.kind}&id=${event.id}`}
          className="pressable inline-flex h-8 items-center gap-1.5 rounded-full bg-white/[0.08] px-3 transition-colors hover:bg-white/[0.14]">
          {t('countdown.appleOutlook')}
        </a>
      </div>
    </div>
  )
}
