"use client"
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { m } from 'framer-motion'
import { useI18n } from '@/src/components/I18nProvider'
import type { AnimeCard } from '@/src/lib/anime/model'
import { spring } from '@/src/lib/motion'
import { cn } from '@/src/lib/utils'
import { untilText } from './anime-format'
import { useNow } from './AnimeCard'

type Slot = { card: AnimeCard, episode: number, airingAt: number }

const dayKey = (seconds: number) => {
  const date = new Date(seconds * 1000)
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

/**
 * The week's episodes, a tab per day in the viewer's own time zone (the server can't know it, so
 * this is drawn in the browser), each with its local time and what's out already or how long to go.
 */
export default function ScheduleBoard({ slots }: { slots: Slot[] }) {
  const { t, locale } = useI18n()
  const now = useNow(20_000)

  const days = useMemo(() => {
    if (now === null) return []
    const today = new Date(now * 1000)
    today.setHours(0, 0, 0, 0)
    return Array.from({ length: 7 }, (_, index) => {
      const start = new Date(today)
      start.setDate(today.getDate() + index)
      const key = dayKey(start.getTime() / 1000)
      return {
        key,
        label: index === 0 ? t('anime.schedule.today') : new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(start),
        date: new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(start),
        slots: slots.filter((slot) => dayKey(slot.airingAt) === key).sort((a, b) => a.airingAt - b.airingAt),
      }
    })
  }, [now, slots, t, locale])
  const [selected, setSelected] = useState(0)

  if (now === null) return <div aria-busy className="min-h-[50vh]" />
  const day = days[selected]

  return (
    <div className="space-y-6">
      <div className="page-x">
        <div role="tablist" aria-label={t('anime.schedule.title')} className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
          {days.map((item, index) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={selected === index}
              onClick={() => setSelected(index)}
              className={cn('relative flex h-14 shrink-0 flex-col items-center justify-center rounded-[14px] px-4 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-red-500', selected === index ? 'text-black' : 'bg-white/[0.05] text-white/75 hover:text-white')}
            >
              {selected === index && <m.span layoutId="schedule-day" transition={spring.snappy} aria-hidden className="absolute inset-0 rounded-[14px] bg-white" />}
              <span className="relative text-[13.5px] font-semibold capitalize">{item.label}</span>
              <span className={cn('relative text-[11.5px]', selected === index ? 'text-black/60' : 'text-white/45')}>{item.date} · {item.slots.length}</span>
            </button>
          ))}
        </div>
      </div>

      <ul role="tabpanel" className="page-x grid gap-2.5 md:grid-cols-2 2xl:grid-cols-3">
        {day.slots.length === 0 && <li className="py-12 text-center text-[15px] text-white/50 md:col-span-2 2xl:col-span-3">{t('anime.schedule.empty')}</li>}
        {day.slots.map((slot) => {
          const out = slot.airingAt <= now
          return (
            <li key={`${slot.card.id}-${slot.episode}`}>
              <Link
                href={out ? `/anime/${slot.card.id}?ep=${slot.episode}#streamSection` : `/anime/${slot.card.id}`}
                className="group/slot flex items-center gap-3.5 rounded-[16px] bg-white/[0.04] p-2.5 pe-4 ring-1 ring-inset ring-white/[0.07] transition-colors hover:bg-white/[0.08]"
              >
                <span className="w-14 shrink-0 text-center text-[15px] font-semibold tabular-nums text-white">
                  {new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(new Date(slot.airingAt * 1000))}
                </span>
                {slot.card.cover && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={slot.card.cover} alt="" loading="lazy" className="h-[72px] w-12 shrink-0 rounded-[8px] object-cover ring-1 ring-white/10" />
                )}
                <span className="min-w-0 flex-1">
                  <span dir="auto" className="line-clamp-2 text-[14.5px] font-semibold leading-snug text-white group-hover/slot:underline">{slot.card.title}</span>
                  <span className="mt-1 block text-[12.5px] text-white/50">{t('anime.episode', { episode: slot.episode })}</span>
                </span>
                <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-[11.5px] font-semibold', out ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/[0.07] text-white/70')}>
                  {out ? t('anime.schedule.aired') : untilText(slot.airingAt - now, locale)}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
