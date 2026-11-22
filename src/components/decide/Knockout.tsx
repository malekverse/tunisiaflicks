"use client"
// Knockout: people take turns (in a random order) striking one film off, until only the films for
// tonight are left. Undo puts the last one back.
import React, { useMemo, useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { Undo2, X } from 'lucide-react'
import { Button } from '@/src/components/ui/button'
import { useT } from '@/src/components/I18nProvider'
import { knockoutTurn, shuffle, type Pick } from '@/src/lib/decide'
import { haptic, spring, tween } from '@/src/lib/motion'
import { Avatar, Poster } from './parts'
import type { DecidePerson } from './storage'

export default function Knockout({ picks, people, count, onDone }: {
  picks: Pick[]
  people: DecidePerson[]
  count: number
  onDone: (keys: string[]) => void
}) {
  const t = useT()
  // Who goes first is luck; then around the room.
  const [order] = useState(() => shuffle(people.map((person) => person.id)))
  const [out, setOut] = useState<string[]>([])
  const left = useMemo(() => picks.filter((pick) => !out.includes(pick.key)), [picks, out])
  const target = Math.max(1, Math.min(count, picks.length - 1))
  const turnId = knockoutTurn(order, out.length)
  const turn = people.find((person) => person.id === turnId) ?? null

  const knock = (key: string) => {
    if (left.length <= target) return
    const next = [...out, key]
    setOut(next)
    haptic(18)
    if (picks.length - next.length <= target) {
      setTimeout(() => onDone(picks.filter((pick) => !next.includes(pick.key)).map((pick) => pick.key)), 650)
    }
  }

  const done = left.length <= target
  return (
    <div className="pt-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <AnimatePresence mode="wait" initial={false}>
          <m.div key={done ? 'done' : turnId ?? out.length} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={tween.fast} className="flex min-w-0 flex-1 items-center gap-3">
            {turn && !done && <Avatar person={turn} size={40} />}
            <h3 className="min-w-0 font-display text-[clamp(22px,5vw,30px)] font-bold leading-tight text-white">
              {done ? t('decide.knockout.left', { count: left.length }) : turn ? t('decide.knockout.turn', { name: turn.name }) : t('decide.knockout.turnGroup')}
            </h3>
          </m.div>
        </AnimatePresence>
        <Button type="button" variant="secondary" size="sm" disabled={!out.length || done} onClick={() => setOut((list) => list.slice(0, -1))}>
          <Undo2 aria-hidden className="h-4 w-4" />{t('decide.knockout.undo')}
        </Button>
      </div>
      <p className="mt-1.5 text-[14px] text-white/60">
        {t('decide.knockout.left', { count: left.length })}
        {target > 1 && ` · ${t('decide.knockout.until', { count: target })}`}
      </p>

      <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        <AnimatePresence initial={false}>
          {left.map((pick) => (
            <m.li
              key={pick.key}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6, rotate: -8, transition: { duration: 0.28, ease: [0.4, 0, 1, 1] } }}
              transition={spring.ui}
            >
              <button
                type="button"
                onClick={() => knock(pick.key)}
                disabled={done}
                aria-label={t('decide.knockout.remove', { title: pick.title })}
                className="group pressable block w-full rounded-[14px] text-start outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:cursor-default"
              >
                <Poster pick={pick} sizes="(min-width: 768px) 200px, 45vw" className={done ? 'ring-[3px] ring-white' : ''}>
                  {!done && (
                    <span aria-hidden className="absolute end-2 top-2 grid h-9 w-9 place-items-center rounded-full bg-black/60 text-white/85 ring-1 ring-white/30 backdrop-blur transition-colors group-hover:bg-red-600 group-hover:text-white">
                      <X className="h-5 w-5" strokeWidth={2.6} />
                    </span>
                  )}
                </Poster>
                <bdi dir="auto" className="mt-1.5 block truncate text-[13.5px] text-white/85">{pick.title}</bdi>
              </button>
            </m.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  )
}
