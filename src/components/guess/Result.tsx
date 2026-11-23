"use client"
// The tries so far (each wrong one with its hints), the stats, and the end of a game: the film,
// how to watch it, the score to share and when the next film comes.
import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { m, useReducedMotion } from 'framer-motion'
import { ArrowDown, ArrowUp, Check, Equal, Info, Play, Share2, SkipForward, X } from 'lucide-react'
import TmdbImage from '@/src/components/TmdbImage'
import { Button } from '@/src/components/ui/button'
import { useI18n } from '@/src/components/I18nProvider'
import { Burst } from '@/src/components/decide/Winners'
import { useCountdown } from '@/src/hooks/use-countdown'
import { toast } from '@/src/hooks/use-toast'
import { countdownParts } from '@/src/lib/seasons'
import { genreNames } from '@/src/lib/genres'
import { MAX_TRIES, nextPuzzleAt, outcome, shareText, type Answer, type Entry, type Stats } from '@/src/lib/guess'
import { haptic, spring, tween } from '@/src/lib/motion'
import { cn } from '@/src/lib/utils'

export function Entries({ entries }: { entries: readonly Entry[] }) {
  const { t, locale } = useI18n()
  if (!entries.length) return null
  return (
    <ol className="space-y-2" aria-label={t('guess.tries')}>
      {entries.map((entry, index) => (
        <m.li
          key={index}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={tween.base}
          className={cn('flex items-center gap-3 rounded-[16px] px-3 py-2.5', entry.kind === 'guess' && entry.right ? 'bg-emerald-400/10 ring-1 ring-inset ring-emerald-400/30' : 'bg-white/[0.05]')}
        >
          <span
            aria-hidden
            className={cn(
              'grid h-8 w-8 shrink-0 place-items-center rounded-full',
              entry.kind === 'skip' ? 'bg-white/[0.08] text-white/60' : entry.right ? 'bg-emerald-400 text-black' : 'bg-red-500/15 text-red-400',
            )}
          >
            {entry.kind === 'skip' ? <SkipForward className="h-4 w-4 rtl:-scale-x-100" /> : entry.right ? <Check className="h-4 w-4" strokeWidth={3} /> : <X className="h-4 w-4" strokeWidth={2.6} />}
          </span>
          {entry.kind === 'skip' ? (
            <p className="text-[14.5px] text-white/60">{t('guess.skipped')}</p>
          ) : (
            <div className="min-w-0 flex-1">
              <p className="flex min-w-0 items-baseline gap-x-2">
                <bdi dir="auto" className="truncate text-[15px] font-medium text-white">{entry.title}</bdi>
                {entry.year && <span className="shrink-0 text-[13px] text-white/55">{entry.year}</span>}
              </p>
              {entry.hint && (entry.hint.year || entry.hint.genres.length > 0) && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {entry.hint.year && (
                    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-medium', entry.hint.year === 'same' ? 'bg-emerald-400/15 text-emerald-300' : 'bg-white/[0.08] text-white/75')}>
                      {entry.hint.year === 'newer' ? <ArrowUp aria-hidden className="h-3 w-3" /> : entry.hint.year === 'older' ? <ArrowDown aria-hidden className="h-3 w-3" /> : <Equal aria-hidden className="h-3 w-3" />}
                      {t(entry.hint.year === 'newer' ? 'guess.hint.newer' : entry.hint.year === 'older' ? 'guess.hint.older' : 'guess.hint.sameYear')}
                    </span>
                  )}
                  {genreNames(entry.hint.genres, locale, 3).map((name) => (
                    <span key={name} className="inline-flex items-center gap-1 rounded-full bg-emerald-400/15 px-2 py-0.5 text-[12px] font-medium text-emerald-300">
                      <Check aria-hidden className="h-3 w-3" />{name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </m.li>
      ))}
    </ol>
  )
}

export function StatsBlock({ stats, highlight }: { stats: Stats, highlight?: number | null }) {
  const { t } = useI18n()
  const max = Math.max(1, ...stats.distribution)
  const figures = [
    { value: stats.played, label: t('guess.stats.played') },
    { value: `${stats.winRate}%`, label: t('guess.stats.winRate') },
    { value: stats.streak, label: t('guess.stats.streak') },
    { value: stats.best, label: t('guess.stats.best') },
  ]
  return (
    <div>
      <dl className="grid grid-cols-4 gap-2">
        {figures.map((figure) => (
          <div key={figure.label} className="rounded-[16px] bg-white/[0.05] px-2 py-3 text-center">
            <dd className="font-display text-[26px] font-extrabold leading-none text-white">{figure.value}</dd>
            <dt className="mt-1.5 text-[12px] leading-tight text-white/60">{figure.label}</dt>
          </div>
        ))}
      </dl>
      <p className="mt-5 text-[13px] font-medium text-white/60">{t('guess.stats.distribution')}</p>
      <ol className="mt-2 space-y-1.5">
        {stats.distribution.map((count, index) => (
          <li key={index} className="flex items-center gap-2.5">
            <span className="w-3 shrink-0 text-center text-[13px] font-semibold text-white/70">{index + 1}</span>
            <span className="relative h-6 flex-1">
              <m.span
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(8, (count / max) * 100)}%` }}
                transition={{ ...spring.ui, delay: 0.04 * index }}
                className={cn('absolute inset-y-0 start-0 flex items-center justify-end rounded-[6px] px-2 text-[12px] font-semibold', highlight === index + 1 ? 'bg-red-600 text-white' : 'bg-white/[0.12] text-white/80')}
              >
                {count}
              </m.span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}

function NextFilm({ onReady }: { onReady: () => void }) {
  const { t } = useI18n()
  const at = useRef(nextPuzzleAt()).current
  const { parts, done } = useCountdown(at, { seconds: true, initial: countdownParts(at - Date.now(), true) })
  const pad = (value: number) => String(value).padStart(2, '0')
  if (done) {
    return <Button type="button" onClick={onReady} className="w-full">{t('guess.next.ready')}</Button>
  }
  return (
    <div className="rounded-[16px] bg-white/[0.05] px-4 py-3 text-center">
      <p className="text-[13px] text-white/60">{t('guess.next.in')}</p>
      <p dir="ltr" className="mt-0.5 font-display text-[28px] font-extrabold tabular-nums leading-none text-white">
        {pad(parts.hours + parts.days * 24)}:{pad(parts.minutes)}:{pad(parts.seconds)}
      </p>
    </div>
  )
}

export function Finished({ answer, entries, day, isToday, onToday, sharePath = '/guess', heading }: {
  answer: Answer
  entries: readonly Entry[]
  day: string
  isToday: boolean
  onToday: () => void
  /** Where the shared result links to, and its first line (the music game has its own). */
  sharePath?: string
  heading?: string
}) {
  const { t } = useI18n()
  const reduceMotion = useReducedMotion()
  const won = outcome(entries) === 'won'
  const [canShare, setCanShare] = useState(false)
  useEffect(() => {
    setCanShare(typeof navigator.share === 'function')
    if (won) haptic(30)
  }, [won])

  const share = async () => {
    const text = shareText(day, entries, `${window.location.origin}${sharePath}`, heading)
    try {
      if (canShare) {
        await navigator.share({ text })
        return
      }
      await navigator.clipboard.writeText(text)
      toast({ title: t('guess.share.copied'), description: t('guess.share.copiedText'), duration: 3000 })
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') return
      toast({ title: t('common.error'), description: t('guess.share.failed'), variant: 'destructive' })
    }
  }

  const original = answer.original_title && answer.original_title !== answer.title ? answer.original_title : null

  return (
    <section aria-live="polite" className="rounded-[22px] bg-white/[0.04] p-5 ring-1 ring-inset ring-white/[0.07] sm:p-6">
      <p className="font-display text-[clamp(26px,5vw,34px)] font-extrabold leading-tight text-white">
        {won ? t(entries.length === 1 ? 'guess.won.first' : 'guess.won.title', { count: entries.length }) : t('guess.lost.title')}
      </p>
      <p className="mt-1 text-[14px] text-white/60">{won ? t('guess.won.text', { count: entries.length, max: MAX_TRIES }) : t('guess.lost.text')}</p>

      <div className="relative mt-5 flex items-center gap-4">
        {won && !reduceMotion && <div className="absolute start-14 top-1/2"><Burst /></div>}
        <m.div
          initial={{ scale: 0.7, opacity: 0, rotate: -6 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ ...spring.pop, opacity: { duration: 0.2 } }}
          className="relative aspect-[2/3] w-[104px] shrink-0 overflow-hidden rounded-poster bg-white/[0.06] shadow-[0_24px_60px_-20px_rgb(0_0_0/0.9)] ring-1 ring-white/15 sm:w-[120px]"
        >
          <TmdbImage kind="poster" path={answer.poster_path} name={answer.title} alt={answer.title} fill sizes="120px" className="object-cover" />
        </m.div>
        <div className="min-w-0">
          <p className="text-balance font-display text-[24px] font-bold leading-tight text-white sm:text-[28px]"><bdi dir="auto">{answer.title}</bdi></p>
          <p className="mt-1 flex flex-wrap gap-x-3 text-[14px] text-white/60">
            {answer.year && <span>{answer.year}</span>}
            {original && <bdi dir="auto">{original}</bdi>}
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-2.5 sm:grid-cols-3">
        <Button asChild>
          <Link href={`/movie/${answer.id}#streamSection`}><Play aria-hidden className="h-4 w-4 fill-current" />{t('hero.watchNow')}</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href={`/movie/${answer.id}`}><Info aria-hidden className="h-4 w-4" />{t('pick.moreInfo')}</Link>
        </Button>
        <Button type="button" variant="secondary" onClick={share}><Share2 aria-hidden className="h-4 w-4" />{t('guess.share.button')}</Button>
      </div>
      {isToday && <div className="mt-4"><NextFilm onReady={onToday} /></div>}
    </section>
  )
}
