"use client"
// Blind date with a film (/blind-date). Say what you're in the mood for (or nothing at all), and
// three films arrive wrapped, like a bookshop's blind-date books: only their hints show (a line of
// the story with the title blacked out, the length, the decade, where they're from, the genres,
// the rating). Pick one by its hints, and it's unwrapped. Seen one already? Swap it. The wishes are
// remembered on this device; the films come from getBlindDates (never one in your history).
import React, { useEffect, useId, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, m, useReducedMotion } from 'framer-motion'
import {
  ArrowLeft, Brain, CalendarDays, Clock, Coffee, Compass, Droplets, Eye, Ghost, Gift, Globe2, Heart, Info, Laugh, Play, RefreshCw,
  Shuffle, Sparkles, Star, Tags, Zap, type LucideIcon,
} from 'lucide-react'
import TmdbImage from '@/src/components/TmdbImage'
import { Button } from '@/src/components/ui/button'
import { useI18n } from '@/src/components/I18nProvider'
import { Burst } from '@/src/components/decide/Winners'
import { useProfiles } from '@/src/hooks/use-profiles'
import { getBlindDates, type BlindDate } from '@/src/app/blind-date/actions'
import {
  DEFAULT_WISHES, ERAS, GROWN_UP_MOODS, LENGTHS, MOODS, ORIGINS, cleanWishes, runtimeParts,
  type Era, type Length, type Mood, type Origin, type Wishes,
} from '@/src/lib/blind-date'
import { genreNames } from '@/src/lib/genres'
import type { TKey } from '@/src/lib/i18n'
import { EASE_OUT, haptic, spring, tween } from '@/src/lib/motion'
import { cn } from '@/src/lib/utils'
import MoreWays from '@/src/components/play/MoreWays'

const WISHES_KEY = 'tf-blind-date:wishes'
const panel = 'rounded-[22px] bg-white/[0.04] p-5 ring-1 ring-inset ring-white/[0.07] sm:p-6'

// Written out, so the page carries exactly these strings.
const MOOD_LABEL: Record<Mood, TKey> = {
  any: 'blindDate.mood.any', laugh: 'blindDate.mood.laugh', thrill: 'blindDate.mood.thrill', feel: 'blindDate.mood.feel', think: 'blindDate.mood.think',
  escape: 'blindDate.mood.escape', cosy: 'blindDate.mood.cosy', love: 'blindDate.mood.love', scared: 'blindDate.mood.scared',
}
const LENGTH_LABEL: Record<Length, TKey> = { any: 'blindDate.length.any', short: 'blindDate.length.short', long: 'blindDate.length.long' }
const ERA_LABEL: Record<Era, TKey> = { any: 'blindDate.era.any', classic: 'blindDate.era.classic', modern: 'blindDate.era.modern', recent: 'blindDate.era.recent' }
const ORIGIN_LABEL: Record<Origin, TKey> = {
  any: 'blindDate.origin.any', arab: 'blindDate.origin.arab', europe: 'blindDate.origin.europe', asia: 'blindDate.origin.asia', latin: 'blindDate.origin.latin',
}

const MOOD_ICON: Record<Mood, LucideIcon> = {
  any: Shuffle, laugh: Laugh, thrill: Zap, feel: Droplets, think: Brain, escape: Compass, cosy: Coffee, love: Heart, scared: Ghost,
}

/** The wrapping paper: soft diagonal stripes, a red ribbon both ways, and a bow. Decorative. */
function Paper({ className, bow = true }: { className?: string, bow?: boolean }) {
  return (
    <span aria-hidden className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}>
      <span className="absolute inset-0 bg-[#17171a] bg-[repeating-linear-gradient(135deg,rgb(255_255_255/0.045)_0_14px,transparent_14px_28px)]" />
      <span className="absolute inset-y-0 start-[68%] w-4 bg-gradient-to-r from-red-700 via-red-600 to-red-700 shadow-[0_0_24px_rgb(229_15_5/0.35)]" />
      <span className="absolute inset-x-0 top-[14%] h-4 bg-gradient-to-b from-red-700 via-red-600 to-red-700 shadow-[0_0_24px_rgb(229_15_5/0.35)]" />
      {bow && (
        <span className="absolute start-[68%] top-[14%] h-0 w-0">
          <span className="absolute -start-9 -top-7 h-9 w-11 -rotate-[24deg] rounded-[50%] border-[5px] border-red-600" />
          <span className="absolute -top-7 start-2 h-9 w-11 rotate-[24deg] rounded-[50%] border-[5px] border-red-600" />
          <span className="absolute -start-2 -top-2 h-6 w-6 rounded-full bg-red-600 ring-2 ring-red-800" />
        </span>
      )}
    </span>
  )
}

function useNames() {
  const { locale } = useI18n()
  const lang = locale === 'tn' ? 'ar' : locale
  const make = (type: 'region' | 'language') => {
    try { return new Intl.DisplayNames([lang], { type }) } catch { return null }
  }
  const regions = make('region')
  const languages = make('language')
  return {
    region: (code: string) => regions?.of(code) ?? code,
    language: (code: string) => (code ? languages?.of(code) ?? code : ''),
  }
}

function Hint({ date }: { date: BlindDate }) {
  const { t } = useI18n()
  if (!date.hint?.length) return null
  return (
    <p dir="auto" className="text-pretty font-display text-[19px] font-bold leading-snug text-white sm:text-[20px]">
      <span aria-hidden className="me-1 text-red-500">“</span>
      {date.hint.map((segment, index) => (segment.masked
        ? <span key={index} aria-label={t('guess.clue.hidden')} className="mx-px inline-block h-[0.9em] translate-y-[0.1em] rounded-[3px] bg-white/80 align-baseline" style={{ width: `${Math.max(2.2, Array.from(segment.text).length * 0.55)}em` }} />
        : <React.Fragment key={index}>{segment.text}</React.Fragment>))}
      <span aria-hidden className="ms-0.5 text-red-500">”</span>
    </p>
  )
}

function Facts({ date }: { date: BlindDate }) {
  const { t, locale } = useI18n()
  const names = useNames()
  const genres = genreNames(date.genres, locale, 3)
  const runtime = date.runtime ? runtimeParts(date.runtime) : null
  const decade = date.year ? Math.floor(date.year / 10) * 10 : null
  const where = [...date.countries.map(names.region)]
  const language = names.language(date.language)
  const rows: { icon: LucideIcon, text: React.ReactNode }[] = [
    ...(runtime ? [{ icon: Clock, text: runtime.hours ? t('blindDate.runtime', { hours: runtime.hours, minutes: runtime.minutes }) : t('blindDate.minutes', { minutes: runtime.minutes }) }] : []),
    ...(decade ? [{ icon: CalendarDays, text: <span dir="ltr">{decade}–{decade + 9}</span> }] : []),
    ...(genres.length ? [{ icon: Tags, text: genres.join(', ') }] : []),
    ...(where.length || language ? [{ icon: Globe2, text: <span className="flex flex-wrap gap-x-3">{where.length > 0 && <span>{where.join(', ')}</span>}{language && <span className="text-white/60">{language}</span>}</span> }] : []),
    ...(date.rating ? [{ icon: Star, text: <span className="flex items-center gap-1.5"><span className="font-semibold">{date.rating.toFixed(1)}</span><span className="text-white/60">{t('blindDate.rating')}</span></span> }] : []),
  ]
  return (
    <ul className="space-y-2">
      {rows.map(({ icon: Icon, text }, index) => (
        <li key={index} className="flex items-start gap-2.5 text-[14px] text-white/85">
          <Icon aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-white/55" />
          <span className="min-w-0">{text}</span>
        </li>
      ))}
    </ul>
  )
}

function WrappedCard({ date, index, onChoose, onSwap, swapping }: {
  date: BlindDate
  index: number
  onChoose: () => void
  onSwap: () => void
  swapping: boolean
}) {
  const { t } = useI18n()
  return (
    <m.li
      layout
      initial={{ opacity: 0, y: 24, rotate: index === 1 ? 0 : index === 0 ? -2 : 2 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      exit={{ opacity: 0, scale: 0.94, transition: tween.fast }}
      transition={{ ...spring.ui, delay: 0.08 * index }}
      className="relative isolate flex min-h-[500px] flex-col overflow-hidden rounded-[26px] p-3 pt-28 ring-1 ring-white/10 shadow-[0_30px_80px_-30px_rgb(0_0_0/0.95)]"
    >
      <Paper className="-z-10" />
      <div className="mt-auto rounded-[20px] bg-black/75 p-4 ring-1 ring-white/10 backdrop-blur-md sm:p-5">
        <p className="text-[12.5px] font-semibold text-red-400">{t('blindDate.cardLabel', { n: index + 1 })}</p>
        <div className="mt-2"><Hint date={date} /></div>
        <div className="mt-4"><Facts date={date} /></div>
        <div className="mt-5 flex flex-col gap-2">
          <Button type="button" onClick={onChoose} className="w-full"><Gift aria-hidden className="h-4 w-4" />{t('blindDate.choose')}</Button>
          <Button type="button" variant="ghost" size="sm" onClick={onSwap} disabled={swapping} className="w-full text-white/70">
            <RefreshCw aria-hidden className={cn('h-4 w-4', swapping && 'animate-spin')} />{t('blindDate.swap')}
          </Button>
        </div>
      </div>
    </m.li>
  )
}

function Reveal({ date, others, onAgain, onBack }: { date: BlindDate, others: BlindDate[], onAgain: () => void, onBack: () => void }) {
  const { t } = useI18n()
  const reduce = useReducedMotion()
  const [peek, setPeek] = useState(false)
  useEffect(() => { haptic(30) }, [])
  const original = date.original_title && date.original_title !== date.title ? date.original_title : null
  return (
    <div className="flex flex-col items-center pt-2 text-center">
      <m.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={tween.slow} className="text-[15px] font-medium text-white/70">{t('blindDate.itsA')}</m.p>
      <div className="relative mt-6">
        {!reduce && <m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.55 }}><Burst /></m.div>}
        <div className="relative aspect-[2/3] w-[min(62vw,260px)] overflow-hidden rounded-[20px] shadow-[0_40px_90px_-24px_rgb(229_15_5/0.6)] ring-1 ring-white/15">
          <TmdbImage kind="poster" path={date.poster_path} name={date.title} alt={date.title} fill priority sizes="260px" className="object-cover" />
          {!reduce && (
            <>
              <m.span aria-hidden className="absolute inset-y-0 start-0 w-1/2 overflow-hidden" initial={{ x: 0 }} animate={{ x: '-105%', rotate: -6 }} transition={{ duration: 0.75, ease: EASE_OUT, delay: 0.25 }}>
                <span className="absolute inset-y-0 start-0 w-[200%]"><Paper bow={false} /></span>
              </m.span>
              <m.span aria-hidden className="absolute inset-y-0 end-0 w-1/2 overflow-hidden" initial={{ x: 0 }} animate={{ x: '105%', rotate: 6 }} transition={{ duration: 0.75, ease: EASE_OUT, delay: 0.25 }}>
                <span className="absolute inset-y-0 end-0 w-[200%]"><Paper bow={false} /></span>
              </m.span>
            </>
          )}
        </div>
      </div>
      <m.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...tween.slow, delay: reduce ? 0 : 0.7 }} className="mt-8 w-full max-w-xl">
        <h2 className="text-balance font-display text-[clamp(30px,7vw,46px)] font-extrabold leading-[1.02] text-white"><bdi dir="auto">{date.title}</bdi></h2>
        <p className="mt-2 flex flex-wrap justify-center gap-x-3 text-[14px] text-white/60">
          {date.year && <span>{date.year}</span>}
          {original && <bdi dir="auto">{original}</bdi>}
        </p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button asChild size="lg" className="px-8"><Link href={`/movie/${date.id}#streamSection`}><Play aria-hidden className="h-5 w-5 fill-current" />{t('hero.watchNow')}</Link></Button>
          <Button asChild size="lg" variant="secondary"><Link href={`/movie/${date.id}`}><Info aria-hidden className="h-5 w-5" />{t('pick.moreInfo')}</Link></Button>
        </div>
        <div className="mt-4 flex flex-wrap justify-center gap-x-2 gap-y-1">
          <Button type="button" variant="ghost" onClick={onAgain}><Sparkles aria-hidden className="h-4 w-4" />{t('blindDate.again')}</Button>
          <Button type="button" variant="ghost" onClick={onBack}><ArrowLeft aria-hidden className="h-4 w-4 rtl:rotate-180" />{t('blindDate.back')}</Button>
          {others.length > 0 && !peek && <Button type="button" variant="ghost" onClick={() => setPeek(true)}><Eye aria-hidden className="h-4 w-4" />{t('blindDate.peek')}</Button>}
        </div>
        <AnimatePresence>
          {peek && (
            <m.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={tween.base} className="mt-6">
              <p className="text-[13.5px] text-white/60">{t('blindDate.passedOn')}</p>
              <ul className="mt-3 flex justify-center gap-4">
                {others.map((other) => (
                  <li key={other.id} className="w-[110px]">
                    <Link href={`/movie/${other.id}`} className="block rounded-[12px] outline-none focus-visible:ring-2 focus-visible:ring-red-500">
                      <span className="relative block aspect-[2/3] overflow-hidden rounded-[12px] bg-white/[0.06] ring-1 ring-white/10">
                        <TmdbImage kind="poster" path={other.poster_path} name={other.title} alt="" fill sizes="110px" className="object-cover" />
                      </span>
                      <bdi dir="auto" className="mt-1.5 block truncate text-[12.5px] text-white/80">{other.title}</bdi>
                    </Link>
                  </li>
                ))}
              </ul>
            </m.div>
          )}
        </AnimatePresence>
      </m.div>
    </div>
  )
}

function ChoiceRow<T extends string>({ label, value, options, onChange, icons, names }: {
  label: string
  value: T
  options: readonly T[]
  onChange: (value: T) => void
  icons?: Partial<Record<T, LucideIcon>>
  names: (value: T) => string
}) {
  const id = useId()
  return (
    <div>
      <p id={id} className="mb-2 text-[13px] font-medium text-white/60">{label}</p>
      <div role="radiogroup" aria-labelledby={id} className="flex flex-wrap gap-2">
        {options.map((option) => {
          const Icon: LucideIcon | undefined = icons?.[option]
          const active = option === value
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(option)}
              className={cn(
                'pressable inline-flex h-10 items-center gap-2 rounded-full px-4 text-[14px] font-medium outline-none ring-1 ring-inset transition-colors focus-visible:ring-2 focus-visible:ring-red-500',
                active ? 'bg-white text-black ring-white' : 'bg-white/[0.05] text-white/75 ring-white/10 hover:text-white',
              )}
            >
              {Icon && <Icon aria-hidden className="h-4 w-4" />}{names(option)}
            </button>
          )
        })}
      </div>
    </div>
  )
}

type Table = { dates: BlindDate[], chosen: number | null }

export default function BlindDateApp() {
  const { t } = useI18n()
  const { active } = useProfiles()
  const kids = !!active?.kids
  const [wishes, setWishes] = useState<Wishes>(DEFAULT_WISHES)
  const [table, setTable] = useState<Table | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'empty' | 'error'>('idle')
  const [swapping, setSwapping] = useState<number | null>(null)
  const [shown, setShown] = useState<number[]>([])
  const tableRef = React.useRef<HTMLDivElement>(null)

  useEffect(() => {
    try { setWishes(cleanWishes(JSON.parse(localStorage.getItem(WISHES_KEY) ?? 'null'))) } catch { /* first visit */ }
  }, [])
  const wish = <K extends keyof Wishes>(key: K, value: Wishes[K]) => {
    setWishes((current) => {
      const next = { ...current, [key]: value }
      try { localStorage.setItem(WISHES_KEY, JSON.stringify(next)) } catch { /* private mode */ }
      return next
    })
  }

  const bring = async () => {
    setStatus('loading')
    setTable(null)
    requestAnimationFrame(() => tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    try {
      const dates = await getBlindDates(wishes, shown, 3)
      if (dates === null) return setStatus('error')
      if (!dates.length) return setStatus('empty')
      setShown((current) => [...current, ...dates.map((date) => date.id)].slice(-200))
      setTable({ dates, chosen: null })
      setStatus('idle')
      haptic(10)
    } catch {
      setStatus('error')
    }
  }

  const swap = async (index: number) => {
    if (!table) return
    setSwapping(index)
    try {
      const [fresh] = (await getBlindDates(wishes, [...shown, ...table.dates.map((date) => date.id)], 1)) ?? []
      if (fresh) {
        setShown((current) => [...current, fresh.id].slice(-200))
        setTable((current) => (current ? { ...current, dates: current.dates.map((date, at) => (at === index ? fresh : date)) } : current))
      }
    } finally {
      setSwapping(null)
    }
  }

  const choose = (index: number) => {
    setTable((current) => (current ? { ...current, chosen: index } : current))
    requestAnimationFrame(() => tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  const moods = MOODS.filter((mood) => !(kids && GROWN_UP_MOODS.has(mood)))
  const chosen = table && table.chosen !== null ? table.dates[table.chosen] : null

  return (
    <div className="page-top pb-16">
      <div className="page-x">
        <div className="mx-auto max-w-[1160px]">
          <header className="flex items-center gap-6 sm:gap-10">
            <div className="min-w-0 flex-1">
              <h1 className="text-balance font-display text-[clamp(34px,5vw,64px)] font-extrabold leading-[0.95]">{t('blindDate.title')}</h1>
              <p className="mt-4 max-w-[60ch] text-pretty text-[15px] leading-relaxed text-white/60">{t('blindDate.subtitle')}</p>
            </div>
            <m.div
              aria-hidden
              initial={{ rotate: -8, opacity: 0, y: 10 }}
              animate={{ rotate: -4, opacity: 1, y: 0 }}
              transition={{ ...tween.slow, duration: 0.8 }}
              className="relative hidden h-[150px] w-[112px] shrink-0 overflow-hidden rounded-[16px] ring-1 ring-white/10 shadow-[0_24px_60px_-20px_rgb(229_15_5/0.5)] sm:block"
            >
              <Paper />
            </m.div>
          </header>

          <section aria-labelledby="blind-wishes" className={cn(panel, 'mt-8')}>
            <h2 id="blind-wishes" className="font-display text-[21px] font-bold leading-tight sm:text-[24px]">{t('blindDate.wishes')}</h2>
            <p className="mt-1 text-[13.5px] text-white/55">{t('blindDate.wishesText')}</p>
            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <div className="lg:col-span-2">
                <ChoiceRow label={t('blindDate.mood')} value={wishes.mood} options={moods} onChange={(value) => wish('mood', value)} icons={MOOD_ICON} names={(value) => t(MOOD_LABEL[value])} />
              </div>
              <ChoiceRow label={t('blindDate.length')} value={wishes.length} options={LENGTHS} onChange={(value: Length) => wish('length', value)} names={(value) => t(LENGTH_LABEL[value])} />
              <ChoiceRow label={t('blindDate.era')} value={wishes.era} options={ERAS} onChange={(value: Era) => wish('era', value)} names={(value) => t(ERA_LABEL[value])} />
              <div className="lg:col-span-2">
                <ChoiceRow label={t('blindDate.origin')} value={wishes.origin} options={ORIGINS} onChange={(value: Origin) => wish('origin', value)} names={(value) => t(ORIGIN_LABEL[value])} />
              </div>
            </div>
            <Button type="button" size="lg" onClick={bring} disabled={status === 'loading'} className="mt-6 w-full sm:w-auto sm:px-10">
              <Gift aria-hidden className="h-5 w-5" />{table ? t('blindDate.bringAgain') : t('blindDate.bring')}
            </Button>
          </section>

          <div ref={tableRef} aria-live="polite" className="scroll-mt-[calc(var(--topbar)+16px)]">
            {status === 'loading' && (
              <ul aria-label={t('common.loadingAria')} className="mt-8 grid gap-4 md:grid-cols-3">
                {[0, 1, 2].map((index) => (
                  <li key={index} className="relative min-h-[500px] animate-pulse overflow-hidden rounded-[26px] ring-1 ring-white/10"><Paper /></li>
                ))}
              </ul>
            )}
            {status === 'empty' && (
              <p className={cn(panel, 'mt-8 text-center text-[15px] text-white/70')}>{t('blindDate.empty')}</p>
            )}
            {status === 'error' && (
              <div className={cn(panel, 'mt-8 text-center')}>
                <p className="text-[15px] text-white/70">{t('blindDate.failed')}</p>
                <Button type="button" variant="secondary" className="mt-4" onClick={bring}><RefreshCw aria-hidden className="h-4 w-4" />{t('blindDate.retry')}</Button>
              </div>
            )}

            {table && status === 'idle' && (chosen ? (
              <div className="mt-10">
                <Reveal
                  key={chosen.id}
                  date={chosen}
                  others={table.dates.filter((date) => date.id !== chosen.id)}
                  onAgain={bring}
                  onBack={() => { setTable(null); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                />
              </div>
            ) : (
              <div className="mt-10">
                <h2 className="font-display text-[24px] font-bold leading-tight sm:text-[28px]">{t('blindDate.table')}</h2>
                <p className="mt-1 text-[14px] text-white/60">{t('blindDate.tableText')}</p>
                <ul className="mt-6 grid gap-4 md:grid-cols-3">
                  <AnimatePresence mode="popLayout" initial={false}>
                    {table.dates.map((date, index) => (
                      <WrappedCard key={date.id} date={date} index={index} onChoose={() => choose(index)} onSwap={() => swap(index)} swapping={swapping === index} />
                    ))}
                  </AnimatePresence>
                </ul>
              </div>
            ))}
          </div>

          <MoreWays current="/blind-date" />
        </div>
      </div>
    </div>
  )
}
