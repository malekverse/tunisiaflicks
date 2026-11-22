"use client"
// Who chooses? Luck draws one person (fair: whoever has chosen least in the room's saved nights,
// and never whoever chose last time), names flicking past like a slot machine. That person then chooses: one of the picks, or anything at
// all from search.
import React, { useEffect, useRef, useState } from 'react'
import { AnimatePresence, m, useReducedMotion } from 'framer-motion'
import { Crown, List, RotateCcw, Search, Shuffle } from 'lucide-react'
import { Button } from '@/src/components/ui/button'
import { Switch } from '@/src/components/ui/switch'
import { useT } from '@/src/components/I18nProvider'
import TitlePicker, { type PickedFilm } from '@/src/components/movie-night/TitlePicker'
import { cryptoInt, sameName, type Pick } from '@/src/lib/decide'
import { fairChoosers, type Night } from '@/src/lib/decide-nights'
import { haptic, spring, tween } from '@/src/lib/motion'
import { cn } from '@/src/lib/utils'
import { Avatar, Poster } from './parts'
import type { DecidePerson } from './storage'

/** The pauses between names: fast, then slowing down onto the one drawn. */
const STEPS = [55, 55, 60, 60, 65, 70, 80, 90, 105, 125, 150, 185, 230, 290, 370]

export default function Chooser({ picks, people, nights, lastChooser, fair, onFair, onChosen }: {
  picks: Pick[]
  people: DecidePerson[]
  /** The room's saved nights: who chose, lately. */
  nights: Night[]
  lastChooser: string | null
  fair: boolean
  onFair: (fair: boolean) => void
  onChosen: (pick: Pick, chooser: DecidePerson) => void
}) {
  const t = useT()
  const reduceMotion = useReducedMotion()
  const [shown, setShown] = useState<DecidePerson | null>(null)
  const [chooser, setChooser] = useState<DecidePerson | null>(null)
  const [drawing, setDrawing] = useState(false)
  const [tick, setTick] = useState(0)
  const [view, setView] = useState<'list' | null>(null)
  const [searching, setSearching] = useState(false)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const lastHere = lastChooser && people.some((person) => sameName(person.name, lastChooser)) ? lastChooser : null
  // Fairness only means something once someone here has had a turn.
  const hadTurns = !!lastHere || nights.some((night) => night.chooser && people.some((person) => sameName(person.name, night.chooser!)))

  const draw = () => {
    if (!people.length || drawing) return
    const pool = fair ? fairChoosers(people, nights, lastHere) : people
    const winner = pool[cryptoInt(pool.length)]
    setChooser(null)
    setView(null)
    setDrawing(true)
    timers.current.forEach(clearTimeout)
    timers.current = []
    const steps = reduceMotion ? [] : STEPS
    let elapsed = 0
    steps.forEach((pause, index) => {
      elapsed += pause
      // Never the same name twice in a row while it spins.
      timers.current.push(setTimeout(() => { setShown(people[(index + 1) % people.length]); setTick((value) => value + 1); haptic(3) }, elapsed))
    })
    timers.current.push(setTimeout(() => {
      setShown(winner)
      setTick((value) => value + 1)
      setChooser(winner)
      setDrawing(false)
      haptic(30)
    }, elapsed + (reduceMotion ? 0 : 420)))
  }

  const pickFilm = (film: PickedFilm) => {
    if (!chooser) return
    onChosen({
      key: film.key,
      media_type: film.media.media_type,
      id: String(film.media.id),
      title: film.media.title,
      poster_path: film.media.poster_path ?? null,
      backdrop_path: null,
      year: film.year,
      by: chooser.id,
    }, chooser)
  }

  return (
    <div className="mx-auto max-w-2xl pt-2 text-center">
      {/* The slot. */}
      <div className="relative mx-auto mt-4 flex h-[200px] max-w-md flex-col items-center justify-center overflow-hidden rounded-[28px] bg-white/[0.04] ring-1 ring-inset ring-white/10">
        <AnimatePresence mode="popLayout" initial={false}>
          {shown ? (
            <m.div
              key={tick}
              initial={{ y: drawing ? 40 : 0, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -40, opacity: 0 }}
              transition={drawing ? { duration: 0.08 } : spring.pop}
              className="flex flex-col items-center"
            >
              <Avatar person={shown} size={chooser ? 76 : 64} />
              <p className="mt-3 max-w-[16ch] truncate font-display text-[clamp(30px,7vw,44px)] font-extrabold leading-none text-white"><bdi dir="auto">{shown.name}</bdi></p>
            </m.div>
          ) : (
            <m.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex -space-x-2 rtl:space-x-reverse">
              {people.slice(0, 6).map((person) => <Avatar key={person.id} person={person} size={48} className="ring-4 ring-black" />)}
            </m.div>
          )}
        </AnimatePresence>
        {chooser && (
          <m.span initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: -12 }} transition={spring.pop} aria-hidden className="absolute end-6 top-5 text-amber-300">
            <Crown className="h-9 w-9 fill-amber-300/30" />
          </m.span>
        )}
      </div>

      <div aria-live="polite" className="mt-6 min-h-[64px]">
        {chooser && (
          <m.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={tween.base}>
            <p className="font-display text-[clamp(26px,6vw,36px)] font-extrabold text-white">{t('decide.chooser.picked', { name: chooser.name })}</p>
            <p className="mt-1 text-[14px] text-white/60">{t('decide.chooser.pickedText')}</p>
          </m.div>
        )}
      </div>

      {!chooser ? (
        <div className="mx-auto max-w-md">
          <Button type="button" size="lg" className="w-full" onClick={draw} disabled={drawing}>
            <Shuffle aria-hidden className="h-5 w-5" />{drawing ? t('decide.chooser.drawing') : t('decide.chooser.draw')}
          </Button>
          {hadTurns && (
            <label className="mt-5 flex cursor-pointer items-center gap-3 rounded-[16px] bg-white/[0.05] p-4 text-start">
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold text-white">{t('decide.chooser.fair')}</span>
                <span className="mt-0.5 block text-[13px] text-white/60">{lastHere ? t('decide.chooser.last', { name: lastHere }) : t('decide.chooser.fairText')}</span>
              </span>
              <Switch checked={fair} onCheckedChange={onFair} disabled={drawing} aria-label={t('decide.chooser.fair')} />
            </label>
          )}
        </div>
      ) : (
        <div>
          <div className="mx-auto flex max-w-md flex-col gap-3 sm:flex-row">
            {picks.length > 0 && (
              <Button type="button" size="lg" variant={view === 'list' ? 'white' : 'secondary'} className="sm:flex-1" onClick={() => setView(view === 'list' ? null : 'list')} aria-expanded={view === 'list'}>
                <List aria-hidden className="h-5 w-5" />{t('decide.chooser.fromList')}
              </Button>
            )}
            <Button type="button" size="lg" className="sm:flex-1" onClick={() => setSearching(true)}>
              <Search aria-hidden className="h-5 w-5" />{t('decide.chooser.search')}
            </Button>
          </div>
          <Button type="button" variant="ghost" className="mt-3" onClick={draw}><RotateCcw aria-hidden className="h-4 w-4" />{t('decide.chooser.redraw')}</Button>

          {view === 'list' && (
            <m.ul initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={tween.base} className="mt-6 grid grid-cols-2 gap-3 text-start sm:grid-cols-3 md:grid-cols-4">
              {picks.map((pick) => (
                <li key={pick.key}>
                  <button
                    type="button"
                    onClick={() => onChosen(pick, chooser)}
                    className="pressable block w-full rounded-[14px] text-start outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                  >
                    <Poster pick={pick} sizes="(min-width: 768px) 180px, 45vw" className={cn('transition-shadow hover:ring-white/40')} />
                    <bdi dir="auto" className="mt-1.5 block truncate text-[13.5px] text-white/85">{pick.title}</bdi>
                  </button>
                </li>
              ))}
            </m.ul>
          )}
        </div>
      )}

      <TitlePicker
        open={searching}
        onOpenChange={setSearching}
        onPick={pickFilm}
        picked={[]}
        heading={chooser ? t('decide.chooser.picked', { name: chooser.name }) : undefined}
      />
    </div>
  )
}
