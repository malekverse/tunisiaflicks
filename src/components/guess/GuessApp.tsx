"use client"
// Guess the film (/guess). One film a day for everyone (a Kids profile and Halal mode get their own
// film): a still, cropped tight, and six tries to name it. Every wrong guess or skip shows more.
// The puzzle comes from /api/guess/[day] (cached by the CDN); the games and stats stay on this
// device. Earlier days can be played from the archive (they don't count for the streak).
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { BarChart3, CalendarDays, Check, CircleHelp, Clapperboard, Drama, Lightbulb, Music, RotateCcw, SkipForward, X } from 'lucide-react'
import { Button } from '@/src/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/src/components/ui/dialog'
import RoomTint from '@/src/components/shell/RoomTint'
import { useI18n } from '@/src/components/I18nProvider'
import { useProfiles } from '@/src/hooks/use-profiles'
import { isArabicScript } from '@/src/lib/i18n/locales'
import {
  archiveDays, judge, MAX_TRIES, misses, outcome, puzzleNumber, stageFor, stats, tunisDay, unwrapAnswer,
  type Answer, type Candidate, type Entry, type Game, type GuessPool, type Stage,
} from '@/src/lib/guess'
import type { Puzzle } from '@/src/lib/guess-server'
import { cn } from '@/src/lib/utils'
import { Clues, StageBar, Still } from './Board'
import GuessInput from './GuessInput'
import { Entries, Finished, StatsBlock } from './Result'
import { findGame, loadGames, saveGame } from './storage'
import MoreWays from '@/src/components/play/MoreWays'

const INTRO_KEY = 'tf-guess:intro'

/** Which film pool this viewer plays: a Kids profile's, Halal mode's or everyone's (null: still finding out). */
export function usePool(): GuessPool | null {
  const { status } = useSession()
  const { data } = useProfiles()
  const [gaveUp, setGaveUp] = useState(false)
  useEffect(() => {
    if (status !== 'authenticated' || data) return
    // The profiles never came: play it safe.
    const timer = setTimeout(() => setGaveUp(true), 5000)
    return () => clearTimeout(timer)
  }, [status, data])
  if (status === 'unauthenticated') return 'all'
  if (status === 'loading') return null
  if (!data) return gaveUp ? 'kids' : null
  const active = data.profiles.find((profile) => profile.id === data.activeId)
  const kids = active ? active.kids : data.profiles.some((profile) => profile.kids)
  const halal = active ? active.halal === true : data.profiles.some((profile) => profile.halal === true)
  return kids ? 'kids' : halal ? 'halal' : 'all'
}

type Loaded = { puzzle: Puzzle, answer: Answer }

export default function GuessApp() {
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
    setGames(loadGames())
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
    fetch(`/api/guess/${day}?pool=${pool}&lang=${lang}`)
      .then(async (response) => {
        if (!response.ok) throw new Error(String(response.status))
        const puzzle: Puzzle = await response.json()
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

  // Look at the newest clue whenever one unlocks.
  useEffect(() => { setView(reached) }, [reached, day])

  const record = useCallback((entry: Entry) => {
    if (!day || !pool || !today) return
    const next = [...entries, entry]
    const done = outcome(next) !== 'playing'
    setGames(saveGame({ day, pool, entries: next, finishedOn: done ? tunisDay() : null }))
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
              <h1 className="text-balance font-display text-[clamp(34px,5vw,64px)] font-extrabold leading-[0.95]">{t('guess.title')}</h1>
              <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px] text-white/60">
                {day && <span className="font-semibold text-white">{t('guess.number', { n: puzzleNumber(day) })}</span>}
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
                  <Still puzzle={loaded.puzzle} view={view} />
                  <StageBar reached={reached} view={view} onView={setView} />
                </>
              ) : failed ? (
                <div className="grid aspect-video place-items-center rounded-stage bg-white/[0.04] p-6 text-center ring-1 ring-inset ring-white/10">
                  <div>
                    <p className="text-[15px] text-white/70">{t('guess.failed')}</p>
                    <Button type="button" variant="secondary" className="mt-4" onClick={() => setAttempt((value) => value + 1)}><RotateCcw aria-hidden className="h-4 w-4" />{t('guess.retry')}</Button>
                  </div>
                </div>
              ) : (
                <div aria-label={t('common.loadingAria')} className="aspect-video animate-pulse rounded-stage bg-white/[0.05]" />
              )}
              <p className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-2 text-center text-[13.5px] text-white/55">
                <Link href="/guess/music" className="inline-flex items-center gap-1.5 underline-offset-4 hover:text-white hover:underline"><Music aria-hidden className="h-4 w-4" />{t('guessMusic.toMusic')}</Link>
                <Link href="/guess/actor" className="inline-flex items-center gap-1.5 underline-offset-4 hover:text-white hover:underline"><Drama aria-hidden className="h-4 w-4" />{t('guessActor.toActor')}</Link>
              </p>
            </div>

            <div className="min-w-0 space-y-4">
              {loaded && (finished
                ? <Finished answer={loaded.answer} entries={entries} day={day!} isToday={isToday} onToday={goToday} />
                : <GuessInput tried={entries.flatMap((entry) => (entry.kind === 'guess' ? [entry.id] : []))} triesLeft={MAX_TRIES - entries.length} onGuess={guess} onSkip={skip} />)}
              <Entries entries={entries} />
              {loaded && <Clues puzzle={loaded.puzzle} reached={reached} />}
              {finished && loaded && (
                <section className="rounded-[22px] bg-white/[0.04] p-5 ring-1 ring-inset ring-white/[0.07]">
                  <h2 className="mb-4 font-display text-[20px] font-bold">{t('guess.stats.title')}</h2>
                  <StatsBlock stats={myStats} highlight={result === 'won' ? entries.length : null} />
                  <Button type="button" variant="ghost" className="mt-4 w-full" onClick={() => setDialog('archive')}><CalendarDays aria-hidden className="h-4 w-4" />{t('guess.archive.more')}</Button>
                </section>
              )}
            </div>
          </div>

          <MoreWays current="/guess" />
        </div>
      </div>

      <Dialog open={dialog === 'help'} onOpenChange={(open) => setDialog(open ? 'help' : null)}>
        <DialogContent>
          <DialogTitle className="font-display text-[24px] font-bold">{t('guess.help.title')}</DialogTitle>
          <DialogDescription className="sr-only">{t('guess.help.text')}</DialogDescription>
          <ul className="space-y-4">
            {[
              { icon: Clapperboard, text: t('guess.help.one') },
              { icon: SkipForward, text: t('guess.help.two', { max: MAX_TRIES }) },
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
            {today && archiveDays(today).map((item) => {
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
                    <span className="w-12 shrink-0 font-display text-[17px] font-bold text-white">{t('guess.number', { n: puzzleNumber(item) })}</span>
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

export function IconButton({ label, onClick, children }: { label: string, onClick: () => void, children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="pressable grid h-11 w-11 place-items-center rounded-full bg-white/[0.07] text-white/85 outline-none transition-colors hover:bg-white/[0.12] hover:text-white focus-visible:ring-2 focus-visible:ring-red-500"
    >
      {children}
    </button>
  )
}
