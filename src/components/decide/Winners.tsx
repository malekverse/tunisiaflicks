"use client"
// The reveal: tonight's film (or lineup) grows into the light with one short burst, and the way to
// watch it right away.
import React, { useEffect, useRef } from 'react'
import Link from 'next/link'
import { m, useReducedMotion } from 'framer-motion'
import { ArrowLeft, BookmarkCheck, BookmarkPlus, Info, Play, RotateCcw } from 'lucide-react'
import { Button } from '@/src/components/ui/button'
import { useT } from '@/src/components/I18nProvider'
import { EASE_OUT, haptic, spring, tween } from '@/src/lib/motion'
import type { Pick } from '@/src/lib/decide'
import { cn } from '@/src/lib/utils'
import { Avatar, Poster } from './parts'
import type { DecidePerson } from './storage'

const PIECES = Array.from({ length: 18 }, (_, index) => {
  const angle = (index / 18) * Math.PI * 2 + (index % 2 ? 0.2 : 0)
  const distance = 130 + (index % 3) * 36
  return { x: Math.cos(angle) * distance, y: Math.sin(angle) * distance * 0.9, rotate: (index % 2 ? 1 : -1) * (90 + index * 21), red: index % 3 !== 0, round: index % 4 === 0 }
})

export function Burst() {
  return (
    <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-0 w-0">
      <m.span
        initial={{ scale: 0.5, opacity: 0.7 }}
        animate={{ scale: 2.8, opacity: 0 }}
        transition={{ duration: 0.9, ease: EASE_OUT, delay: 0.12 }}
        className="absolute -left-20 -top-20 h-40 w-40 rounded-full ring-2 ring-red-500/70"
      />
      {PIECES.map((piece, index) => (
        <m.span
          key={index}
          initial={{ x: 0, y: 0, scale: 0.4, rotate: 0, opacity: 1 }}
          animate={{ x: piece.x, y: piece.y, scale: 1, rotate: piece.rotate, opacity: 0 }}
          transition={{ duration: 0.95, ease: EASE_OUT, delay: 0.1 + (index % 4) * 0.02, opacity: { duration: 0.95, ease: [0.6, 0, 0.9, 0.4], delay: 0.1 } }}
          className={cn('absolute -left-1 -top-1.5', piece.round ? 'h-2.5 w-2.5 rounded-full' : 'h-3 w-1.5 rounded-[2px]', piece.red ? 'bg-red-500' : 'bg-white')}
        />
      ))}
    </div>
  )
}

export default function Winners({ picks, people, chooser, saved, onSave, onAgain, onBack }: {
  picks: Pick[]
  people: DecidePerson[]
  /** Who got to choose ("Who chooses?"). */
  chooser?: DecidePerson | null
  /** Tonight is in the room's nights (saved here, or on the way to watching it). */
  saved: boolean
  onSave: () => void
  onAgain: () => void
  onBack: () => void
}) {
  const t = useT()
  const reduceMotion = useReducedMotion()
  const primary = useRef<HTMLAnchorElement>(null)
  const single = picks.length === 1
  const first = picks[0]
  const owner = (pick: Pick) => people.find((person) => person.id === pick.by) ?? null

  useEffect(() => {
    haptic(24)
    primary.current?.focus({ preventScroll: true })
  }, [])

  if (!first) return null
  const href = (pick: Pick) => `/${pick.media_type}/${pick.id}`

  return (
    <div className="flex min-h-[calc(100dvh-140px)] flex-col items-center justify-center pt-4 text-center">
      <m.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={tween.slow} className="text-[15px] font-medium text-white/70">
        {single ? t('decide.winner.one') : t('decide.winner.many')}
      </m.p>

      {single ? (
        <div className="relative mt-7">
          {!reduceMotion && <Burst />}
          <m.div
            initial={{ scale: 0.62, opacity: 0, rotate: -7, y: 28 }}
            animate={{ scale: 1, opacity: 1, rotate: 0, y: 0 }}
            transition={{ ...spring.pop, opacity: { duration: 0.2 } }}
            className="relative w-[min(56vw,250px)] shadow-[0_40px_90px_-24px_rgb(229_15_5/0.6)]"
          >
            <Poster pick={first} sizes="250px" priority className="rounded-[18px] ring-white/15" />
          </m.div>
        </div>
      ) : (
        <div className="relative mt-7 flex items-end justify-center gap-3 sm:gap-5">
          {!reduceMotion && <Burst />}
          {picks.map((pick, index) => (
            <m.div
              key={pick.key}
              initial={{ scale: 0.6, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ ...spring.pop, delay: 0.08 * index, opacity: { duration: 0.2, delay: 0.08 * index } }}
              className="w-[min(28vw,180px)]"
            >
              <Poster pick={pick} sizes="180px" priority className="rounded-[14px] shadow-[0_30px_70px_-24px_rgb(229_15_5/0.55)] ring-white/15">
                <span className="absolute start-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-black/70 text-[13px] font-bold text-white backdrop-blur">{index + 1}</span>
              </Poster>
            </m.div>
          ))}
        </div>
      )}

      <m.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...tween.slow, delay: 0.2 }}
        className="mt-9 flex w-full max-w-xl flex-col items-center"
      >
        {single ? (
          <>
            <h3 className="text-balance font-display text-[clamp(30px,7vw,48px)] font-extrabold leading-[1.02] text-white"><bdi dir="auto">{first.title}</bdi></h3>
            <Credits pick={first} owner={owner(first)} chooser={chooser ?? null} />
          </>
        ) : (
          <ol className="w-full space-y-1.5 text-start">
            {picks.map((pick, index) => (
              <li key={pick.key} className="flex items-center gap-3 rounded-[14px] bg-white/[0.05] px-3 py-2">
                <span className="w-5 shrink-0 text-center font-display text-lg font-bold text-white/50">{index + 1}</span>
                <span className="min-w-0 flex-1">
                  <bdi dir="auto" className="block truncate text-[15px] font-semibold text-white">{pick.title}</bdi>
                  {owner(pick) && <span className="block truncate text-[12.5px] text-white/55">{t('decide.winner.by', { name: owner(pick)!.name })}</span>}
                </span>
                <Link href={`${href(pick)}#streamSection`} onClick={onSave} aria-label={`${t('hero.watchNow')}: ${pick.title}`} className="pressable grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-black outline-none focus-visible:ring-2 focus-visible:ring-red-500">
                  <Play aria-hidden className="h-4 w-4 fill-current" />
                </Link>
              </li>
            ))}
          </ol>
        )}

        <div className="mt-7 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
          <Button asChild size="lg" className="px-8">
            <Link ref={primary} href={`${href(first)}#streamSection`} onClick={onSave}><Play aria-hidden className="h-5 w-5 fill-current" />{t('hero.watchNow')}</Link>
          </Button>
          {single && (
            <Button asChild size="lg" variant="secondary">
              <Link href={href(first)}><Info aria-hidden className="h-5 w-5" />{t('pick.moreInfo')}</Link>
            </Button>
          )}
          <Button type="button" size="lg" variant="secondary" onClick={onSave} disabled={saved} aria-live="polite">
            {saved ? <BookmarkCheck aria-hidden className="h-5 w-5 text-emerald-300" /> : <BookmarkPlus aria-hidden className="h-5 w-5" />}
            {saved ? t('decide.nights.saved') : t('decide.nights.save')}
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
          <Button type="button" variant="ghost" onClick={onAgain}><RotateCcw aria-hidden className="h-4 w-4" />{t('decide.winner.again')}</Button>
          <Button type="button" variant="ghost" onClick={onBack}><ArrowLeft aria-hidden className="h-4 w-4 rtl:rotate-180" />{t('decide.winner.back')}</Button>
        </div>
      </m.div>
    </div>
  )
}

function Credits({ pick, owner, chooser }: { pick: Pick, owner: DecidePerson | null, chooser: DecidePerson | null }) {
  const t = useT()
  const person = chooser ?? owner
  if (!person) return pick.year ? <p className="mt-2 text-[14px] text-white/55">{pick.year}</p> : null
  return (
    <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/[0.07] py-1 pe-3.5 ps-1 text-[14px] text-white/80">
      <Avatar person={person} size={26} />
      {chooser ? t('decide.winner.chosenBy', { name: chooser.name }) : t('decide.winner.by', { name: person.name })}
      {pick.year && <span className="ms-1 text-white/50">{pick.year}</span>}
    </p>
  )
}

