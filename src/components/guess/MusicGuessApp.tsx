"use client"
// Guess the film from its music (/guess/music). One film a day for everyone (a Kids profile and
// Halal mode get their own): a second of its soundtrack, and six tries to name it. Every wrong
// guess or skip lets you hear more and unlocks a clue. The puzzle comes from /api/guess/music/[day]
// (cached by the CDN); the games and stats stay on this device, apart from Guess the film's.
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { m } from 'framer-motion'
import { BarChart3, CalendarDays, Check, CircleHelp, Drama, Lightbulb, Lock, Music, Puzzle, Quote, RotateCcw, SkipForward, Tags, Users, X } from 'lucide-react'
import TmdbImage from '@/src/components/TmdbImage'
import { Button } from '@/src/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/src/components/ui/dialog'
import RoomTint from '@/src/components/shell/RoomTint'
import { useI18n } from '@/src/components/I18nProvider'
import MoreWays from '@/src/components/play/MoreWays'
import { isArabicScript } from '@/src/lib/i18n/locales'
import {
  judge, MAX_TRIES, misses, outcome, stageFor, stats, tunisDay, unwrapAnswer,
  type Answer, type Candidate, type Entry, type Game, type Stage,
} from '@/src/lib/guess'
import { clipFor, musicArchiveDays, musicHeading, musicNumber, MUSIC_STORAGE_KEY } from '@/src/lib/guess-music'
import type { Person } from '@/src/lib/guess-server'
import type { MusicPuzzle } from '@/src/lib/guess-music-server'
import { genreNames } from '@/src/lib/genres'
import { EASE_OUT } from '@/src/lib/motion'
import { cn } from '@/src/lib/utils'
import { StageBar } from './Board'
import GuessInput from './GuessInput'
import { IconButton, usePool } from './GuessApp'
import MusicPlayer from './MusicPlayer'
import { Entries, Finished, StatsBlock } from './Result'
import { findGame, loadGames, saveGame } from './storage'

const INTRO_KEY = 'tf-guess-music:intro'

type Loaded = { puzzle: MusicPuzzle, answer: Answer }

export default function MusicGuessApp() {
  const { t, locale, dateLocale } = useI18n()
  const pool = usePool()
  const [today, setToday] = useState<string | null>(null)
  const [day, setDay] = useState<string | null>(null)
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [failed, setFailed] = useState(false)
  const [games, setGames] = useState<Game[]>([])
  const [view, setView] = useState<Stage>(1)
  const [dialog, setDialog] = useState<'help' | 'stats' | 'archive' | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const now = tunisDay()
    setToday(now)
    setDay(now)
    setGames(loadGames(MUSIC_STORAGE_KEY))
    try {
      if (!localStorage.getItem(INTRO_KEY)) {
        setDialog('help')
        localStorage.setItem(INTRO_KEY, '1')
      }
    } catch { /* private mode: no intro memory */ }
  }, [])

  const lang = locale === 'fr' ? 'fr' : isArabicScript(locale) ? 'ar' : 'en'

  useEffect(() => {
    if (!day || !pool) return
    let cancelled = false
    setLoaded(null)
    setFailed(false)
    fetch(`/api/guess/music/${day}?pool=${pool}&lang=${lang}`)
      .then(async (response) => {
        if (!response.ok) throw new Error(String(response.status))
        const puzzle: MusicPuzzle = await response.json()
        const answer = unwrapAnswer(puzzle.answer)
        if (!answer) throw new Error('answer')
        if (!cancelled) setLoaded({ puzzle, answer })
      })
      .catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true }
  }, [day, pool, lang, attempt])

  const game: Game | null = day && pool ? findGame(games, day, pool) : null
  const entries: Entry[] = useMemo(() => game?.entries ?? [], [game])
  const result = outcome(entries)
  const finished = result !== 'playing'
  const reached = stageFor(misses(entries), finished)

  // Listen to the newest clip whenever one unlocks.
  useEffect(() => { setView(reached) }, [reached, day])

  const record = useCallback((entry: Entry) => {
    if (!day || !pool || !today) return
    const next = [...entries, entry]
    const done = outcome(next) !== 'playing'
    setGames(saveGame({ day, pool, entries: next, finishedOn: done ? tunisDay() : null }, MUSIC_STORAGE_KEY))
  }, [day, pool, today, entries])

  const guess = (film: Candidate) => {
    if (!loaded || finished) return
    record(judge(film, loaded.answer))
  }
  const skip = () => { if (!finished) record({ kind: 'skip' }) }

  const poolGames = useMemo(() => games.filter((entry) => entry.pool === pool), [games, pool])
  const myStats = useMemo(() => stats(poolGames, today ?? undefined), [poolGames, today])
  const isToday = !!day && day === today
  const date = day ? new Date(`${day}T12:00:00Z`).toLocaleDateString(dateLocale, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }) : ''
  const goToday = () => {
    const now = tunisDay()
    setToday(now)
    setDay(now)
    setDialog(null)
  }

  return (
    <div className="page-top pb-16">
      {finished && loaded && <RoomTint poster={loaded.answer.poster_path} />}
      <div className="page-x">
        <div className="mx-auto max-w-[1100px]">
          <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
            <div className="min-w-0">
              <h1 className="text-balance font-display text-[clamp(34px,5vw,64px)] font-extrabold leading-[0.95]">{t('guessMusic.title')}</h1>
              <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px] text-white/60">
                {day && <span className="font-semibold text-white">{t('guess.number', { n: musicNumber(day) })}</span>}
                {date && <span>{date}</span>}
                {day && !isToday && <span className="rounded-full bg-white/[0.08] px-2.5 py-0.5 text-[12.5px] text-white/75">{t('guess.archive.badge')}</span>}
              </p>
            </div>
            <div className="flex gap-2">
              {day && !isToday && (
                <Button type="button" variant="secondary" size="sm" onClick={goToday}><RotateCcw aria-hidden className="h-4 w-4" />{t('guess.archive.today')}</Button>
              )}
              <IconButton label={t('guess.help.open')} onClick={() => setDialog('help')}><CircleHelp className="h-5 w-5" /></IconButton>
              <IconButton label={t('guess.stats.open')} onClick={() => setDialog('stats')}><BarChart3 className="h-5 w-5" /></IconButton>
              <IconButton label={t('guess.archive.open')} onClick={() => setDialog('archive')}><CalendarDays className="h-5 w-5" /></IconButton>
            </div>
          </header>

          <div className="mt-7 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] lg:gap-8">
            <div className="min-w-0">
              {loaded ? (
                <>
                  <MusicPlayer track={loaded.puzzle.track} seconds={clipFor(view)} unlocked={clipFor(reached)} />
                  <StageBar reached={reached} view={view} onView={setView} />
                </>
              ) : failed ? (
                <div className="grid min-h-[280px] place-items-center rounded-stage bg-white/[0.04] p-6 text-center ring-1 ring-inset ring-white/10">
                  <div>
                    <p className="text-[15px] text-white/70">{t('guessMusic.failed')}</p>
                    <Button type="button" variant="secondary" className="mt-4" onClick={() => setAttempt((value) => value + 1)}><RotateCcw aria-hidden className="h-4 w-4" />{t('guess.retry')}</Button>
                  </div>
                </div>
              ) : (
                <div aria-label={t('common.loadingAria')} className="min-h-[280px] animate-pulse rounded-stage bg-white/[0.05]" />
              )}
              <p className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-2 text-center text-[13.5px] text-white/55">
                <Link href="/guess" className="inline-flex items-center gap-1.5 underline-offset-4 hover:text-white hover:underline"><Puzzle aria-hidden className="h-4 w-4" />{t('guessMusic.toStills')}</Link>
                <Link href="/guess/actor" className="inline-flex items-center gap-1.5 underline-offset-4 hover:text-white hover:underline"><Drama aria-hidden className="h-4 w-4" />{t('guessActor.toActor')}</Link>
              </p>
            </div>

            <div className="min-w-0 space-y-4">
              {loaded && (finished
                ? <Finished answer={loaded.answer} entries={entries} day={day!} isToday={isToday} onToday={goToday} sharePath="/guess/music" heading={musicHeading(day!)} />
                : <GuessInput tried={entries.flatMap((entry) => (entry.kind === 'guess' ? [entry.id] : []))} triesLeft={MAX_TRIES - entries.length} onGuess={guess} onSkip={skip} />)}
              <Entries entries={entries} />
              {loaded && <MusicClues puzzle={loaded.puzzle} reached={reached} />}
              {finished && loaded && (
                <section className="rounded-[22px] bg-white/[0.04] p-5 ring-1 ring-inset ring-white/[0.07]">
                  <h2 className="mb-4 font-display text-[20px] font-bold">{t('guess.stats.title')}</h2>
                  <StatsBlock stats={myStats} highlight={result === 'won' ? entries.length : null} />
                  <Button type="button" variant="ghost" className="mt-4 w-full" onClick={() => setDialog('archive')}><CalendarDays aria-hidden className="h-4 w-4" />{t('guess.archive.more')}</Button>
                </section>
              )}
            </div>
          </div>

          <MoreWays current="/guess/music" />
        </div>
      </div>

      <Dialog open={dialog === 'help'} onOpenChange={(open) => setDialog(open ? 'help' : null)}>
        <DialogContent>
          <DialogTitle className="font-display text-[24px] font-bold">{t('guess.help.title')}</DialogTitle>
          <DialogDescription className="sr-only">{t('guessMusic.help.text')}</DialogDescription>
          <ul className="space-y-4">
            {[
              { icon: Music, text: t('guessMusic.help.one') },
              { icon: SkipForward, text: t('guessMusic.help.two', { max: MAX_TRIES }) },
              { icon: Lightbulb, text: t('guess.help.three') },
              { icon: CalendarDays, text: t('guess.help.four') },
            ].map(({ icon: Icon, text }) => (
              <li key={text} className="flex gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/[0.08]"><Icon aria-hidden className="h-[18px] w-[18px] text-white" /></span>
                <p className="pt-1.5 text-[15px] leading-relaxed text-white/80">{text}</p>
              </li>
            ))}
          </ul>
          <Button type="button" onClick={() => setDialog(null)} className="mt-2 w-full">{t('guess.help.start')}</Button>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === 'stats'} onOpenChange={(open) => setDialog(open ? 'stats' : null)}>
        <DialogContent>
          <DialogTitle className="font-display text-[24px] font-bold">{t('guess.stats.title')}</DialogTitle>
          <DialogDescription className="text-[13.5px] text-white/60">{t('guess.stats.note')}</DialogDescription>
          <StatsBlock stats={myStats} highlight={finished && isToday && result === 'won' ? entries.length : null} />
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === 'archive'} onOpenChange={(open) => setDialog(open ? 'archive' : null)}>
        <DialogContent className="max-h-[min(640px,88dvh)] grid-rows-[auto_auto_minmax(0,1fr)]">
          <DialogTitle className="font-display text-[24px] font-bold">{t('guess.archive.title')}</DialogTitle>
          <DialogDescription className="text-[13.5px] text-white/60">{t('guess.archive.text')}</DialogDescription>
          <ol className="-mx-2 overflow-y-auto overscroll-contain px-2">
            {today && musicArchiveDays(today).map((item) => {
              const played = pool ? findGame(games, item, pool) : null
              const state = played ? outcome(played.entries) : null
              const label = new Date(`${item}T12:00:00Z`).toLocaleDateString(dateLocale, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
              return (
                <li key={item}>
                  <button
                    type="button"
                    onClick={() => { setDay(item); setDialog(null); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                    aria-current={item === day ? 'true' : undefined}
                    className={cn('pressable flex w-full items-center gap-3 rounded-[14px] px-3 py-2.5 text-start outline-none transition-colors hover:bg-white/[0.06] focus-visible:ring-2 focus-visible:ring-red-500', item === day && 'bg-white/[0.08]')}
                  >
                    <span className="w-12 shrink-0 font-display text-[17px] font-bold text-white">{t('guess.number', { n: musicNumber(item) })}</span>
                    <span className="min-w-0 flex-1 truncate text-[14px] text-white/70">{item === today ? t('guess.archive.todayLabel') : label}</span>
                    <span className={cn('flex shrink-0 items-center gap-1.5 text-[13px]', state === 'won' ? 'text-emerald-300' : state === 'lost' ? 'text-red-400' : 'text-white/50')}>
                      {state === 'won' && <Check aria-hidden className="h-4 w-4" />}
                      {state === 'lost' && <X aria-hidden className="h-4 w-4" />}
                      {state === 'won' ? t('guess.archive.won', { count: played!.entries.length }) : state === 'lost' ? t('guess.archive.lost') : state === 'playing' ? t('guess.archive.playing') : t('guess.archive.new')}
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Face({ person, size = 32 }: { person: Person, size?: number }) {
  return (
    <span className="relative shrink-0 overflow-hidden rounded-full bg-white/[0.08] ring-2 ring-black" style={{ width: size, height: size }}>
      <TmdbImage kind="profile" path={person.profile_path} name={person.name} alt="" fill sizes={`${size}px`} className="object-cover" />
    </span>
  )
}

/** The clues, in the order they unlock: the ones not reached yet say what's coming. */
function MusicClues({ puzzle, reached }: { puzzle: MusicPuzzle, reached: Stage }) {
  const { t, locale } = useI18n()
  const genres = genreNames(puzzle.genres, locale, 3)
  const rows: { stage: Stage, icon: React.ElementType, label: string, body: React.ReactNode, show: boolean }[] = [
    { stage: 2, icon: CalendarDays, label: t('guess.clue.decade'), show: puzzle.decade !== null, body: <span dir="ltr">{puzzle.decade}–{(puzzle.decade ?? 0) + 9}</span> },
    { stage: 3, icon: Tags, label: t('guessMusic.clue.genres'), show: genres.length > 0, body: <span>{genres.join(', ')}</span> },
    {
      stage: 4,
      icon: Music,
      label: t('guessMusic.clue.yearComposer'),
      show: puzzle.year !== null || !!puzzle.composer,
      body: (
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {puzzle.year !== null && <span className="font-semibold">{puzzle.year}</span>}
          {puzzle.composer && (
            <span className="flex items-center gap-2">
              <Face person={puzzle.composer} size={28} />
              <span className="text-white/60">{t('guessMusic.clue.musicBy')}</span>
              <bdi dir="auto">{puzzle.composer.name}</bdi>
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
            <span key={person.name} className="flex items-center gap-2"><Face person={person} /><bdi dir="auto">{person.name}</bdi></span>
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
        <Music aria-hidden className="mt-0.5 h-[18px] w-[18px] shrink-0 text-red-500" />
        <p className="text-[14px] leading-relaxed text-white/70">{t('guessMusic.clue.first')}</p>
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
