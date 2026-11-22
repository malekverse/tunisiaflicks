"use client"
// Duels: two films face off, the room shouts, someone taps the winner; a single-elimination bracket
// in a random order until one film is left. Always one film.
import React, { useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { useT } from '@/src/components/I18nProvider'
import { champion, chooseDuel, currentDuel, duelProgress, startBracket, type Bracket, type Pick } from '@/src/lib/decide'
import { haptic, spring } from '@/src/lib/motion'
import { cn } from '@/src/lib/utils'
import { Avatar, Poster } from './parts'
import type { DecidePerson } from './storage'

export default function Duel({ picks, people, onDone }: {
  picks: Pick[]
  people: DecidePerson[]
  onDone: (keys: string[]) => void
}) {
  const t = useT()
  const [bracket, setBracket] = useState<Bracket>(() => startBracket(picks.map((pick) => pick.key)))
  const [chosen, setChosen] = useState<string | null>(null)
  const duel = currentDuel(bracket)
  const byKey = new Map(picks.map((pick) => [pick.key, pick]))
  const owner = (pick: Pick) => people.find((person) => person.id === pick.by) ?? null

  const choose = (key: string) => {
    if (chosen) return
    setChosen(key)
    haptic(16)
    setTimeout(() => {
      const next = chooseDuel(bracket, key)
      setChosen(null)
      const winner = champion(next)
      if (winner) onDone([winner])
      else setBracket(next)
    }, 520)
  }

  if (!duel) return null
  const { duel: number, of } = duelProgress(bracket)
  const final = bracket.contenders.length === 2

  return (
    <div className="pt-2 text-center">
      <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-red-400">
        {final ? t('decide.duel.final') : `${t('decide.duel.round', { round: bracket.round })} · ${t('decide.duel.progress', { duel: number, of })}`}
      </p>
      <h3 className="mt-1 font-display text-[clamp(26px,6vw,40px)] font-extrabold text-white">{t('decide.duel.which')}</h3>

      <AnimatePresence mode="wait">
        <m.div
          key={`${bracket.round}-${bracket.index}`}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10, transition: { duration: 0.16 } }}
          transition={spring.ui}
          className="relative mx-auto mt-6 grid max-w-[640px] grid-cols-2 gap-4 sm:gap-8"
        >
          {duel.map((key) => {
            const pick = byKey.get(key)!
            const person = owner(pick)
            const lost = chosen !== null && chosen !== key
            const won = chosen === key
            return (
              <m.button
                key={key}
                type="button"
                onClick={() => choose(key)}
                aria-label={t('decide.duel.choose', { title: pick.title })}
                animate={{ scale: won ? 1.05 : lost ? 0.9 : 1, opacity: lost ? 0.35 : 1 }}
                transition={spring.pop}
                className="pressable group block rounded-[18px] text-start outline-none focus-visible:ring-2 focus-visible:ring-red-500"
              >
                <Poster pick={pick} sizes="(min-width: 640px) 300px, 45vw" priority className={cn('rounded-[18px] transition-shadow duration-200 group-hover:ring-white/40', won && 'ring-[3px] ring-white shadow-[0_30px_70px_-20px_rgb(229_15_5/0.7)]')} />
                <bdi dir="auto" className="mt-2.5 line-clamp-2 block text-center text-[15px] font-semibold leading-snug text-white">{pick.title}</bdi>
                {person && (
                  <span className="mt-1.5 flex items-center justify-center gap-1.5 text-[12.5px] text-white/55">
                    <Avatar person={person} size={18} />
                    <bdi dir="auto" className="truncate">{person.name}</bdi>
                  </span>
                )}
              </m.button>
            )
          })}
          <span aria-hidden className="pointer-events-none absolute left-1/2 top-[38%] grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-red-600 font-display text-[15px] font-extrabold uppercase text-white shadow-[0_10px_30px_-6px_rgb(229_15_5/0.9)] ring-4 ring-black">
            {t('decide.duel.vs')}
          </span>
        </m.div>
      </AnimatePresence>
    </div>
  )
}
