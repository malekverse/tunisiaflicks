"use client"
// A night in a list (the /movie-night page, the home card, the form's live preview): its calendar
// leaf, when, its name, who's going, and the film or the films on the ballot. The whole card is
// one link; nothing inside it is a button.
import Link from 'next/link'
import { Ban, Clock3 } from 'lucide-react'
import TmdbImage from '@/src/components/TmdbImage'
import { AvatarStack } from '@/src/components/social/Avatar'
import { useI18n } from '@/src/components/I18nProvider'
import { nightDay, nightTime, relativeDay } from '@/src/lib/movie-night-format'
import type { Translate } from '@/src/lib/i18n/translate'
import type { Locale } from '@/src/lib/i18n/locales'
import type { NightSummary } from '@/src/lib/movie-night'
import { cn } from '@/src/lib/utils'
import DateTile from './DateTile'

/** "Tonight", "Tomorrow", or "Friday 9 October" (in the night's zone). */
export function whenLabel(at: string, tz: string, t: Translate, locale: Locale, now?: Date) {
  const relative = relativeDay(at, tz, now)
  if (relative === 'today') return Number(nightTime(at, tz, 'en').slice(0, 2)) >= 17 ? t('movieNight.when.tonight') : t('movieNight.when.today')
  if (relative === 'tomorrow') return t('movieNight.when.tomorrow')
  return nightDay(at, tz, locale)
}

/** Posters dealt as a small overlapping stack (the film, or the films being voted on). */
export function PosterStack({ posters, className }: { posters: string[]; className?: string }) {
  if (posters.length === 0) return null
  return (
    <span aria-hidden className={cn('flex shrink-0 items-center [&>*+*]:-ms-5', className)}>
      {posters.slice(0, 3).map((path, index) => (
        <span
          key={`${path}-${index}`}
          style={{ zIndex: 3 - index, transform: `rotate(${(index - (posters.length - 1) / 2) * 5}deg)` }}
          className="relative block aspect-[2/3] w-11 overflow-hidden rounded-[7px] bg-white/[0.06] shadow-[0_10px_24px_-10px_rgb(0_0_0/0.9)] ring-2 ring-black sm:w-12"
        >
          <TmdbImage kind="poster" path={path} alt="" fill sizes="48px" className="object-cover" />
        </span>
      ))}
    </span>
  )
}

export default function NightCard({ night, href, preview = false, className }: {
  night: Pick<NightSummary, 'title' | 'starts_at' | 'tz' | 'status' | 'role' | 'host' | 'going' | 'goingCount' | 'posters' | 'film' | 'candidateCount'>
  /** Without a link (the form's live preview). */
  href?: string
  preview?: boolean
  className?: string
}) {
  const { t, locale } = useI18n()
  const cancelled = night.status === 'cancelled'
  const waiting = night.role === 'requested'
  const title = night.title || (waiting ? t('movieNight.preview.title') : t('movieNight.defaultTitle'))
  const filmLine = night.film
    ? t('movieNight.card.film', { title: night.film.title })
    : night.candidateCount > 1 ? t('movieNight.card.voting', { count: night.candidateCount })
      : night.candidateCount === 1 ? t('movieNight.card.votingOne') : t('movieNight.card.noFilm')
  const people = [night.host, ...night.going]

  const body = (
    <>
      <span className={cn('relative', cancelled && 'opacity-50 grayscale')}>
        <DateTile at={night.starts_at} tz={night.tz} size="md" />
      </span>
      <span className="min-w-0 flex-1">
        <span suppressHydrationWarning className="flex flex-wrap items-baseline gap-x-3 text-[13px] text-white/60">
          <span suppressHydrationWarning>{whenLabel(night.starts_at, night.tz, t, locale)}</span>
          <span className="tabular-nums" dir="ltr">{nightTime(night.starts_at, night.tz, locale)}</span>
        </span>
        <span className={cn('mt-0.5 block truncate font-display text-[19px] font-bold leading-tight text-white sm:text-[21px]', cancelled && 'text-white/60 line-through decoration-white/40')}>
          <bdi>{title}</bdi>
        </span>
        <span className="mt-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] text-white/60">
          {cancelled ? (
            <span className="inline-flex items-center gap-1.5 text-white/70"><Ban aria-hidden className="h-3.5 w-3.5" />{t('movieNight.card.cancelled')}</span>
          ) : waiting ? (
            <span className="inline-flex items-center gap-1.5"><Clock3 aria-hidden className="h-3.5 w-3.5" />{t('movieNight.card.waiting')}</span>
          ) : (
            <>
              <span className="inline-flex items-center gap-2">
                <AvatarStack people={people} total={Math.max(night.goingCount, people.length)} size={24} />
                <span>{night.goingCount === 1 ? t('movieNight.card.goingOne') : t('movieNight.card.going', { count: night.goingCount })}</span>
              </span>
              <span className="min-w-0 truncate"><bdi>{filmLine}</bdi></span>
            </>
          )}
          {!cancelled && night.role === 'invited' && (
            <span className="rounded-full bg-white px-2 py-0.5 text-[12px] font-semibold text-black">{t('movieNight.card.invited')}</span>
          )}
        </span>
      </span>
      <PosterStack posters={night.posters} className={cn('ms-1 hidden min-[420px]:flex', cancelled && 'opacity-40')} />
    </>
  )

  const look = cn(
    'group relative flex items-center gap-3.5 rounded-[22px] bg-white/[0.04] p-3 pe-4 ring-1 ring-inset ring-white/[0.07] sm:gap-4 sm:p-4 sm:pe-5',
    className,
  )
  if (preview || !href) return <div className={look}>{body}</div>
  return (
    <Link href={href} className={cn(look, 'pressable outline-none transition-colors duration-150 hover:bg-white/[0.07] focus-visible:ring-2 focus-visible:ring-red-500')}>
      {body}
    </Link>
  )
}
