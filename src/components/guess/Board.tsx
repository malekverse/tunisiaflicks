"use client"
// The board of Guess the film: the still (cropped tight, then wider, then whole, then a second
// one), the stage buttons to look back at an earlier crop, and the clues unlocked so far.
import React from 'react'
import { AnimatePresence, m, useReducedMotion } from 'framer-motion'
import { CalendarDays, Clapperboard, Globe2, Lock, Quote, Tags, Users } from 'lucide-react'
import TmdbImage from '@/src/components/TmdbImage'
import { useI18n } from '@/src/components/I18nProvider'
import { FRAMING, MAX_TRIES, type Stage } from '@/src/lib/guess'
import type { Person, Puzzle } from '@/src/lib/guess-server'
import { genreNames } from '@/src/lib/genres'
import { EASE_OUT } from '@/src/lib/motion'
import { cn } from '@/src/lib/utils'

export function Still({ puzzle, view }: { puzzle: Puzzle, view: Stage }) {
  const { t } = useI18n()
  const reduceMotion = useReducedMotion()
  const frame = FRAMING[view]
  const still = puzzle.stills[frame.still]
  return (
    <div className="relative aspect-video overflow-hidden rounded-stage bg-white/[0.04] ring-1 ring-inset ring-white/10 shadow-[0_40px_120px_-40px_rgb(0_0_0/0.9)]">
      <AnimatePresence initial={false}>
        <m.div
          key={still.path}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: EASE_OUT }}
          className="absolute inset-0"
        >
          <m.div
            className="absolute inset-0"
            style={{ transformOrigin: `${still.x}% ${still.y}%` }}
            initial={false}
            animate={{ scale: frame.zoom }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.8, ease: EASE_OUT }}
          >
            {/* Wide: the tight crop needs every pixel TMDB has. */}
            <TmdbImage kind="backdrop" path={still.path} alt={t('guess.stillAlt')} fill priority sizes="(min-width: 1024px) 1600px, 1280px" className="object-cover" />
          </m.div>
        </m.div>
      </AnimatePresence>
      <div aria-hidden className="pointer-events-none absolute inset-0 rounded-stage ring-1 ring-inset ring-white/10" />
    </div>
  )
}

/** One button per stage: the ones reached can be looked at again. */
export function StageBar({ reached, view, onView }: { reached: Stage, view: Stage, onView: (stage: Stage) => void }) {
  const { t } = useI18n()
  return (
    <div role="group" aria-label={t('guess.stages')} className="mt-4 flex justify-center gap-2">
      {Array.from({ length: MAX_TRIES }, (_, index) => {
        const stage = (index + 1) as Stage
        const open = stage <= reached
        return (
          <button
            key={stage}
            type="button"
            disabled={!open}
            aria-pressed={view === stage}
            aria-label={t('guess.stage', { n: stage })}
            onClick={() => onView(stage)}
            className={cn(
              'pressable grid h-10 w-10 place-items-center rounded-full text-[14px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-red-500',
              view === stage ? 'bg-white text-black' : open ? 'bg-white/[0.08] text-white hover:bg-white/[0.14]' : 'bg-white/[0.03] text-white/30',
            )}
          >
            {open ? stage : <Lock aria-hidden className="h-3.5 w-3.5" />}
          </button>
        )
      })}
    </div>
  )
}

function Face({ person, size = 36 }: { person: Person, size?: number }) {
  return (
    <span className="relative shrink-0 overflow-hidden rounded-full bg-white/[0.08] ring-2 ring-black" style={{ width: size, height: size }}>
      <TmdbImage kind="profile" path={person.profile_path} name={person.name} alt="" fill sizes={`${size}px`} className="object-cover" />
    </span>
  )
}

/** The clues, in the order they unlock: the ones not reached yet say what's coming. */
export function Clues({ puzzle, reached }: { puzzle: Puzzle, reached: Stage }) {
  const { t, locale } = useI18n()
  const regions = (() => {
    try {
      const names = new Intl.DisplayNames([locale === 'tn' ? 'ar' : locale], { type: 'region' })
      return puzzle.countries.map((code) => names.of(code) ?? code)
    } catch {
      return puzzle.countries
    }
  })()
  const genres = genreNames(puzzle.genres, locale, 3)

  const rows: { stage: Stage, icon: React.ElementType, label: string, body: React.ReactNode, show: boolean }[] = [
    {
      stage: 2,
      icon: CalendarDays,
      label: t('guess.clue.decade'),
      show: puzzle.decade !== null,
      body: <span dir="ltr">{puzzle.decade}–{(puzzle.decade ?? 0) + 9}</span>,
    },
    {
      stage: 3,
      icon: Tags,
      label: t('guess.clue.genres'),
      show: genres.length > 0 || puzzle.runtime !== null,
      body: (
        <span className="flex flex-wrap gap-x-3 gap-y-1">
          {genres.length > 0 && <span>{genres.join(', ')}</span>}
          {puzzle.runtime !== null && <span className="text-white/60">{t('guess.clue.runtime', { minutes: puzzle.runtime })}</span>}
        </span>
      ),
    },
    {
      stage: 4,
      icon: Globe2,
      label: t('guess.clue.made'),
      show: true,
      body: (
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {puzzle.year !== null && <span className="font-semibold">{puzzle.year}</span>}
          {regions.length > 0 && <span>{regions.join(', ')}</span>}
          {puzzle.director && (
            <span className="flex items-center gap-2">
              <Face person={puzzle.director} size={28} />
              <span className="text-white/60">{t('guess.clue.directedBy')}</span>
              <bdi dir="auto">{puzzle.director.name}</bdi>
            </span>
          )}
        </span>
      ),
    },
    {
      stage: 5,
      icon: Users,
      label: t('guess.clue.cast'),
      show: puzzle.cast.length > 0,
      body: (
        <span className="flex flex-wrap gap-x-4 gap-y-2">
          {puzzle.cast.map((person) => (
            <span key={person.name} className="flex items-center gap-2">
              <Face person={person} />
              <bdi dir="auto">{person.name}</bdi>
            </span>
          ))}
        </span>
      ),
    },
    {
      stage: 6,
      icon: Quote,
      label: t('guess.clue.story'),
      show: !!puzzle.line?.length,
      body: (
        <span dir="auto" className="leading-relaxed">
          {puzzle.line?.map((segment, index) => (segment.masked
            ? <span key={index} aria-label={t('guess.clue.hidden')} className="mx-px inline-block h-[0.95em] translate-y-[0.12em] rounded-[3px] bg-white/80 align-baseline" style={{ width: `${Math.max(2.2, Array.from(segment.text).length * 0.55)}em` }} />
            : <React.Fragment key={index}>{segment.text}</React.Fragment>))}
        </span>
      ),
    },
  ]

  return (
    <ol className="space-y-2">
      <li className="flex items-start gap-3 rounded-[16px] bg-white/[0.04] px-4 py-3">
        <Clapperboard aria-hidden className="mt-0.5 h-[18px] w-[18px] shrink-0 text-red-500" />
        <p className="text-[14px] leading-relaxed text-white/70">{t('guess.clue.still')}</p>
      </li>
      {rows.filter((row) => row.show).map((row) => {
        const open = reached >= row.stage
        const Icon = open ? row.icon : Lock
        return (
          <li key={row.stage} className={cn('flex items-start gap-3 rounded-[16px] px-4 py-3 transition-colors', open ? 'bg-white/[0.06]' : 'bg-white/[0.025]')}>
            <Icon aria-hidden className={cn('mt-0.5 h-[18px] w-[18px] shrink-0', open ? 'text-white/80' : 'text-white/35')} />
            <div className="min-w-0 flex-1">
              <p className={cn('text-[13px] font-medium', open ? 'text-white/60' : 'text-white/50')}>
                {open ? row.label : t('guess.clue.locked', { what: row.label, n: row.stage - 1 })}
              </p>
              {open && (
                <m.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: EASE_OUT }} className="mt-1 text-[15px] text-white">
                  {row.body}
                </m.div>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
