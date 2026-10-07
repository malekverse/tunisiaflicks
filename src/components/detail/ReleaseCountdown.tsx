"use client"
import React, { useEffect, useState } from 'react'
import { FaRegCalendarPlus, FaGoogle } from 'react-icons/fa6'
import { useT } from '@/src/components/I18nProvider'
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

/** "Releases in 12d 4h 3m" (or "Next episode S2E5 in ...") with Add to Google / Apple calendar. */
export default function ReleaseCountdown({ event }: { event: ReleaseEvent }) {
  const t = useT()
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

  const unit = 'flex min-w-[3.25rem] flex-col items-center rounded-lg bg-black/50 px-2 py-1 ring-1 ring-white/10'
  return (
    <div className="mt-4 flex flex-col items-center gap-3 md:items-start">
      <p className="text-sm font-semibold uppercase tracking-wide text-red-400">
        {event.kind === 'tv'
          ? t(parts ? 'countdown.nextEpisodeIn' : 'countdown.nextEpisodeToday', { episode: event.episode ?? '' })
          : t(parts ? 'countdown.releasesIn' : 'countdown.outToday')}
      </p>
      {parts && (
        <div className="flex gap-2" role="timer" aria-live="off">
          {([['days', parts.days], ['hours', parts.hours], ['minutes', parts.minutes]] as const).map(([name, value]) => (
            <span key={name} className={unit}>
              <span className="text-2xl font-bold tabular-nums">{value}</span>
              <span className="text-[10px] uppercase text-gray-400">{t(`countdown.${name}`)}</span>
            </span>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
        <span className="inline-flex items-center gap-1.5 text-gray-300"><FaRegCalendarPlus />{t('countdown.addToCalendar')}</span>
        {appUrl && (
          <a href={googleCalendarUrl(event, appUrl)} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 hover:bg-white/20">
            <FaGoogle className="text-xs" /> Google
          </a>
        )}
        <a href={`/api/calendar?type=${event.kind}&id=${event.id}`}
          className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 hover:bg-white/20">
          {t('countdown.appleOutlook')}
        </a>
      </div>
    </div>
  )
}
