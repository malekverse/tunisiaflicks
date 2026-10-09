"use client"
// "Add to calendar" for a night you're going to: Google and Outlook links, and the .ics file
// (Apple Calendar and the rest), which carries a reminder an hour before. Adding it again after a
// change updates the same event (same UID, higher SEQUENCE).
import { useEffect, useState } from 'react'
import { CalendarPlus, Download } from 'lucide-react'
import { FaGoogle, FaMicrosoft } from 'react-icons/fa6'
import { useT } from '@/src/components/I18nProvider'
import { googleTimedUrl, outlookTimedUrl } from '@/src/lib/calendar'
import { cn } from '@/src/lib/utils'

const pill = 'pressable inline-flex h-11 items-center gap-2 rounded-full bg-white/[0.08] px-4 text-[14px] font-medium text-white outline-none ring-1 ring-inset ring-white/[0.06] transition-colors duration-150 hover:bg-white/[0.14] focus-visible:ring-2 focus-visible:ring-red-500'

export default function CalendarActions({ id, start, end, summary, place, className }: {
  id: string
  start: string
  end: string
  summary: string
  place: string
  className?: string
}) {
  const t = useT()
  const [origin, setOrigin] = useState('')
  useEffect(() => setOrigin(window.location.origin), [])
  const event = {
    start: new Date(start),
    end: new Date(end),
    summary,
    description: origin ? t('movieNight.ics.description', { url: `${origin}/movie-night/${id}` }) : undefined,
    location: place || undefined,
  }
  return (
    <section id="calendar" aria-labelledby="night-calendar" className={cn('scroll-mt-[calc(var(--topbar)+24px)]', className)}>
      <h3 id="night-calendar" className="flex items-center gap-2 text-[15px] font-semibold text-white">
        <CalendarPlus aria-hidden className="h-[18px] w-[18px] text-white/70" />{t('movieNight.calendar.title')}
      </h3>
      <div className="mt-3 flex flex-wrap gap-2">
        <a href={googleTimedUrl(event)} target="_blank" rel="noopener noreferrer" className={pill}>
          <FaGoogle aria-hidden className="text-[13px]" />{t('movieNight.calendar.google')}
        </a>
        <a href={outlookTimedUrl(event)} target="_blank" rel="noopener noreferrer" className={pill}>
          <FaMicrosoft aria-hidden className="text-[13px]" />{t('movieNight.calendar.outlook')}
        </a>
        <a href={`/api/movie-night/${id}/ics`} download className={pill}>
          <Download aria-hidden className="h-4 w-4" />{t('movieNight.calendar.ics')}
        </a>
      </div>
      <p className="mt-3 max-w-[48ch] text-[12.5px] leading-relaxed text-white/55">{t('movieNight.calendar.updates')}</p>
    </section>
  )
}
