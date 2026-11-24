"use client"
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { AnimatePresence, m, useInView } from 'framer-motion'
import { useI18n } from '@/src/components/I18nProvider'
import { isArabicScript } from '@/src/lib/i18n/locales'
import type { LandingData } from '@/src/lib/landing-model'
import { haptic } from '@/src/lib/motion'
import { cn } from '@/src/lib/utils'
import { PicImg, useCalm } from './parts'
import { LOOKS, useStageLook } from './Stage'

type Row = LandingData['world'][number]

/** The board's columns: poster, film, year on a phone; country, poster, film, year from a tablet up. */
const ROW = 'grid grid-cols-[2.5rem_minmax(0,1fr)_2.75rem] gap-x-2.5 sm:grid-cols-[minmax(0,9rem)_2.75rem_minmax(0,1fr)_3.25rem] sm:gap-x-3'

/** Rows on the board at once, and how long they stay before the board flips to the next countries. */
const SLOTS = 6
const EVERY_MS = 3800

/**
 * From every country: a departures board of cinema. Each row is a country and the film it's
 * watching most right now (TMDB's popularity there, through the viewer's filters); every few
 * seconds the rows flip over to the next countries, row after row, like a station's board. Every
 * row opens its film; the countries beside the board jump straight to theirs.
 */
export default function World({ rows }: { rows: Row[] }) {
  const { t, locale } = useI18n()
  const arabic = isArabicScript(locale)
  const reduced = useCalm()
  const section = useRef<HTMLElement>(null)
  const board = useRef<HTMLDivElement>(null)
  const inView = useInView(board, { amount: 0.3 })
  const [offset, setOffset] = useState(0)
  const [held, setHeld] = useState(false)
  useStageLook(section, LOOKS.world)

  const slots = Math.min(SLOTS, rows.length)
  const cycles = rows.length > slots
  useEffect(() => {
    if (reduced || !inView || held || !cycles) return
    const timer = window.setTimeout(() => setOffset((value) => (value + slots) % rows.length), EVERY_MS)
    return () => window.clearTimeout(timer)
  }, [offset, reduced, inView, held, cycles, slots, rows.length])

  if (rows.length < 4) return null

  const shown = Array.from({ length: slots }, (_, slot) => rows[(offset + slot) % rows.length])
  const onBoard = new Set(shown.map((row) => row.code))

  return (
    <section ref={section} id="world" aria-labelledby="landing-world-title" className="page-x relative py-[clamp(96px,16svh,180px)]">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center lg:gap-16">
        <div>
          <h2
            id="landing-world-title"
            className={cn('max-w-[11ch] text-balance font-display font-extrabold text-white', arabic ? 'text-[clamp(46px,6.4vw,104px)] leading-[1.12]' : 'text-[clamp(52px,7.6vw,128px)] leading-[0.86]')}
          >
            {t('landing.world.heading')}
          </h2>
          <p className="mt-6 max-w-[44ch] text-pretty text-[16px] leading-relaxed text-white/75 sm:text-[19px]">{t('landing.world.text')}</p>
          {/* Every country on the board: the ones showing now are lit; one tap puts a country on top. */}
          <div role="group" aria-label={t('landing.world.countries')} className="mt-8 flex flex-wrap gap-x-1 gap-y-1.5">
            {rows.map((row, index) => (
              <button
                key={row.code}
                type="button"
                aria-pressed={onBoard.has(row.code)}
                onClick={() => { haptic(6); setOffset(index) }}
                className={cn(
                  'rounded-full px-2.5 py-1 text-[13.5px] font-medium transition-colors duration-500',
                  onBoard.has(row.code) ? 'bg-teal-400/15 text-teal-200' : 'text-white/40 hover:text-white/75',
                )}
              >
                {row.name}
              </button>
            ))}
          </div>
          <Link href="/discover" className="mt-8 inline-flex h-11 items-center gap-1.5 rounded-full bg-white pe-4 ps-5 text-[14px] font-semibold text-black transition-[transform,background-color] hover:bg-white/85 active:scale-[0.97]">
            {t('landing.world.discover')}
            <ChevronRight aria-hidden className="h-4 w-4 rtl:rotate-180" />
          </Link>
        </div>

        <div
          ref={board}
          onPointerEnter={() => setHeld(true)}
          onPointerLeave={() => setHeld(false)}
          onFocusCapture={() => setHeld(true)}
          onBlurCapture={() => setHeld(false)}
          className="rounded-[24px] bg-[#0a0a0c] p-3 shadow-[0_50px_100px_-40px_rgb(20_184_166/0.35)] ring-1 ring-white/[0.09] sm:p-4"
        >
          <div className="flex items-center justify-between gap-3 px-2 pb-3 pt-1">
            <p className="flex items-center gap-2 font-display text-[18px] font-bold text-white sm:text-[20px]">
              <span aria-hidden className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-60 motion-safe:animate-ping" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-teal-400" />
              </span>
              {t('landing.world.board')}
            </p>
            {cycles && (
              <button
                type="button"
                onClick={() => { haptic(6); setOffset((value) => (value + slots) % rows.length) }}
                className="pressable inline-flex h-8 items-center gap-1 rounded-full bg-white/[0.07] pe-2.5 ps-3 text-[12.5px] font-medium text-white/75 transition-colors hover:bg-white/[0.12] hover:text-white"
              >
                {t('landing.world.next')}
                <ChevronRight aria-hidden className="h-3.5 w-3.5 rtl:rotate-180" />
              </button>
            )}
          </div>
          {/* On a phone the country sits above its film; from a tablet up, each has its column. */}
          <div aria-hidden className={cn(ROW, 'px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-white/35')}>
            <span className="hidden sm:block">{t('landing.world.country')}</span>
            <span />
            <span className="truncate"><span className="sm:hidden">{t('landing.world.country')} · </span>{t('landing.world.film')}</span>
            <span className="text-end">{t('landing.world.year')}</span>
          </div>
          <ol className="space-y-1.5" aria-live="off">
            {shown.map((row, slot) => (
              <li key={slot}>
                <Link
                  href={`/movie/${row.film.id}`}
                  className={cn(ROW, 'group items-center rounded-[14px] p-2 outline-none transition-colors hover:bg-white/[0.05] focus-visible:ring-2 focus-visible:ring-teal-300')}
                >
                  <Flap flip={row.code} delay={slot * 0.07} reduced={reduced} className="hidden h-10 sm:block">
                    <span className="truncate font-display text-[17px] font-bold text-teal-200">{row.name}</span>
                  </Flap>
                  <Flap flip={row.code} delay={slot * 0.07 + 0.04} reduced={reduced} className="aspect-[2/3] w-full" plain>
                    <PicImg pic={{ title: row.film.title, tmdb: row.film.poster }} width={92} className="h-full w-full rounded-[5px]" />
                  </Flap>
                  <span className="flex min-w-0 flex-col gap-1 sm:block">
                    <Flap flip={row.code} delay={slot * 0.07} reduced={reduced} className="h-6 sm:hidden">
                      <span className="truncate font-display text-[13.5px] font-bold text-teal-200">{row.name}</span>
                    </Flap>
                    <Flap flip={row.code} delay={slot * 0.07 + 0.08} reduced={reduced} className="h-8 sm:h-10">
                      <span className="truncate text-[14.5px] font-semibold text-white group-hover:underline group-hover:underline-offset-4 sm:text-[16px]" dir="auto">{row.film.title}</span>
                    </Flap>
                  </span>
                  <Flap flip={row.code} delay={slot * 0.07 + 0.12} reduced={reduced} className="h-8 sm:h-10">
                    <span className="w-full text-end text-[13px] tabular-nums text-white/55 sm:text-[14px]">{row.film.year}</span>
                  </Flap>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}

/**
 * One cell of the board. When `flip` changes, the old face folds away over the top edge and the
 * new one falls into place, the way a split-flap board turns. `plain` drops the tile (the poster).
 */
function Flap({ flip, delay, reduced, className, plain = false, children }: {
  flip: string
  delay: number
  reduced: boolean
  className?: string
  plain?: boolean
  children: React.ReactNode
}) {
  return (
    <span className={cn('relative block min-w-0 [perspective:500px]', className)}>
      <AnimatePresence initial={false} mode="popLayout">
        <m.span
          key={flip}
          className={cn(
            'absolute inset-0 flex min-w-0 items-center [backface-visibility:hidden]',
            !plain && 'overflow-hidden rounded-[7px] bg-white/[0.045] px-2.5 shadow-[inset_0_-1px_0_rgb(0_0_0/0.5)] after:pointer-events-none after:absolute after:inset-x-0 after:top-1/2 after:h-px after:bg-black/40',
          )}
          style={{ transformOrigin: '50% 0%' }}
          initial={reduced ? { opacity: 0 } : { rotateX: -92, opacity: 0.4 }}
          animate={{ rotateX: 0, opacity: 1 }}
          exit={reduced ? { opacity: 0 } : { rotateX: 92, opacity: 0 }}
          transition={reduced ? { duration: 0.15 } : { duration: 0.42, delay, ease: [0.3, 0.7, 0.2, 1] }}
        >
          {/* Above the tile's split line, so the line never crosses the letters. */}
          <span className="relative z-[1] flex h-full w-full min-w-0 items-center">{children}</span>
        </m.span>
      </AnimatePresence>
    </span>
  )
}
