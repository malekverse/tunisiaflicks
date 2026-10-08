"use client"
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  animate, m, useMotionValue, useMotionValueEvent, useReducedMotion, useSpring, useTransform,
  type MotionValue, type PanInfo,
} from 'framer-motion'
import { Heart, Star, X } from 'lucide-react'
import TmdbImage from '@/src/components/TmdbImage'
import { useT } from '@/src/components/I18nProvider'
import { haptic, spring } from '@/src/lib/motion'
import { cn } from '@/src/lib/utils'
import type { SwipeCard } from '@/src/lib/swipe'

// A release commits when the card is (or is heading) past 30% of its width. "Heading" is Apple's
// momentum projection: where the card would come to rest if the flick carried on decelerating.
const COMMIT_SHARE = 0.3
const DECELERATION = 0.995
const project = (velocity: number) => ((velocity / 1000) * DECELERATION) / (1 - DECELERATION)
// The slowest a committed card leaves at (px/s): buttons and slow drags still throw, not drift.
const MIN_THROW_VELOCITY = 1100
const MAX_TILT = 12
// The spring back after a release that didn't commit (typed for animating a single value).
const SPRING_BACK = spring.momentum as { type: 'spring', bounce: number, duration: number }

// The pile: the top card, then two behind it, smaller, dimmer and peeking out above. As the top
// card is dragged away, each card behind eases toward the spot in front of it.
const SCALES = [1, 0.95, 0.9]
const LIFTS = [0, -22, -44]
const DIMS = [0, 0.38, 0.62]
// Critically damped (no overshoot), quick: the pile follows the finger without lagging behind it.
const PILE_SPRING = { stiffness: 520, damping: 46 }

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
function pileValue(values: number[], depth: number, progress: number) {
  if (depth <= 0) return values[0]
  const from = values[Math.min(depth, values.length - 1)]
  const to = values[Math.min(depth - 1, values.length - 1)]
  return from + (to - from) * Math.min(1, Math.abs(progress))
}

type Thrower = (yes: boolean) => void
type Status = 'active' | 'waiting' | 'leaving'

function DeckCard({ card, depth, status, progress, control, onCommit, onGone }: {
  card: SwipeCard
  depth: number
  status: Status
  /** Signed drag progress of the top card: -1 (nope) … 1 (yes). */
  progress: MotionValue<number>
  control: React.MutableRefObject<Thrower | null>
  onCommit: (card: SwipeCard, yes: boolean) => void
  onGone: (card: SwipeCard, yes: boolean) => void
}) {
  const t = useT()
  const reduceMotion = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const thrown = useRef(false)
  const width = useRef(340)
  // Grabbed by the top half, the card tilts toward the drag; by the bottom half, away from it,
  // as a real card pivots around the finger.
  const grab = useRef(1)

  const x = useMotionValue(0)
  const fade = useMotionValue(1)
  const rotate = useTransform(x, (value) => clamp((value / 22) * grab.current, -MAX_TILT, MAX_TILT))
  const likeOpacity = useTransform(x, [14, 96], [0, 1])
  const likeScale = useTransform(x, [14, 96], [0.82, 1])
  const nopeOpacity = useTransform(x, [-96, -14], [1, 0])
  const nopeScale = useTransform(x, [-96, -14], [1, 0.82])
  const nopeShade = useTransform(x, [-96, -14], [0.3, 0])

  const depthValue = useMotionValue(depth)
  useIsomorphicLayoutEffect(() => { depthValue.set(depth) }, [depth, depthValue])
  const scale = useSpring(useTransform(() => pileValue(SCALES, depthValue.get(), progress.get())), PILE_SPRING)
  const y = useSpring(useTransform(() => pileValue(LIFTS, depthValue.get(), progress.get())), PILE_SPRING)
  const dim = useSpring(useTransform(() => pileValue(DIMS, depthValue.get(), progress.get())), PILE_SPRING)

  // The top card reports how far it has been dragged, so the pile and the buttons can react.
  useMotionValueEvent(x, 'change', (value) => {
    if (status === 'active' && !thrown.current) progress.set(clamp(value / (width.current * COMMIT_SHARE), -1, 1))
  })

  const fly = useCallback((yes: boolean, velocity = 0) => {
    if (thrown.current) return
    thrown.current = true
    const direction = yes ? 1 : -1
    haptic()
    onCommit(card, yes)
    const done = () => onGone(card, yes)
    if (reduceMotion) {
      animate(x, x.get() + direction * 24, { duration: 0.18 })
      animate(fade, 0, { duration: 0.18, onComplete: done })
      return
    }
    const cardWidth = ref.current?.offsetWidth ?? width.current
    const distance = window.innerWidth / 2 + cardWidth * 1.3
    // Keep the finger's speed when it was already heading out; never leave slower than a toss.
    const speed = Math.max(velocity * direction, MIN_THROW_VELOCITY)
    animate(x, direction * distance, { type: 'spring', velocity: direction * speed, bounce: 0, duration: 0.5, onComplete: done })
  }, [card, fade, onCommit, onGone, reduceMotion, x])

  // The buttons and the arrow keys throw whichever card is on top.
  useEffect(() => {
    if (status !== 'active') return
    const thrower: Thrower = (yes) => fly(yes)
    control.current = thrower
    return () => { if (control.current === thrower) control.current = null }
  }, [status, control, fly])

  const onPointerDown = (event: React.PointerEvent) => {
    if (status !== 'active' || !ref.current) return
    const rect = ref.current.getBoundingClientRect()
    width.current = rect.width
    grab.current = event.clientY - rect.top < rect.height / 2 ? 1 : -1
  }

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const projected = x.get() + project(info.velocity.x)
    if (Math.abs(projected) > width.current * COMMIT_SHARE) fly(projected > 0, info.velocity.x)
    else animate(x, 0, { ...SPRING_BACK, velocity: info.velocity.x })
  }

  const active = status === 'active'
  return (
    <m.div
      ref={ref}
      drag={active ? 'x' : false}
      dragMomentum={false}
      onPointerDown={onPointerDown}
      onDragEnd={onDragEnd}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.24 }}
      style={{ x, y, rotate, scale, zIndex: status === 'leaving' ? 30 : 10 - depth, touchAction: active ? 'pan-y' : undefined }}
      aria-hidden={!active}
      className={cn('absolute inset-0 select-none will-change-transform', active ? 'cursor-grab active:cursor-grabbing' : 'pointer-events-none')}
    >
      <m.div style={{ opacity: fade }} className="relative h-full w-full">
        <div className="relative h-full w-full overflow-hidden rounded-[22px] bg-neutral-900 shadow-[0_30px_70px_-24px_rgb(0_0_0/0.95)] ring-1 ring-white/10">
          <TmdbImage kind="poster" path={card.poster_path} fill sizes="(min-width: 640px) 380px, 86vw" alt="" draggable={false} priority={depth < 2} className="pointer-events-none object-cover" />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/75 to-transparent p-5 pt-28 sm:p-6 sm:pt-32">
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-white/70">
              <span>{card.media_type === 'tv' ? t('common.tvShow') : t('common.movie')}</span>
              {card.year && <span>{card.year}</span>}
              {card.vote_average > 0 && (
                <span className="inline-flex items-center gap-1 font-semibold text-white">
                  <Star aria-hidden className="h-3.5 w-3.5 fill-star text-star" />{card.vote_average.toFixed(1)}
                </span>
              )}
            </p>
            <h2 className="mt-1.5 text-balance font-display text-[26px] font-bold leading-[1.02] sm:text-[30px]"><bdi>{card.title}</bdi></h2>
            {card.overview && <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-white/65 sm:line-clamp-3">{card.overview}</p>}
          </div>
          {/* Yes: the room's signal light gathers on the card's edge. Nope: the card dims. */}
          <m.div aria-hidden style={{ opacity: likeOpacity }} className="pointer-events-none absolute inset-0 rounded-[22px] shadow-[inset_0_0_0_3px_rgb(255_36_20/0.95),inset_0_0_80px_rgb(255_36_20/0.32)]" />
          <m.div aria-hidden style={{ opacity: nopeShade }} className="pointer-events-none absolute inset-0 bg-black" />
          <m.div aria-hidden style={{ opacity: dim }} className="pointer-events-none absolute inset-0 bg-black" />
        </div>
        {/* Physical sides in every language: dragged right is yes. */}
        <m.span
          aria-hidden
          style={{ opacity: likeOpacity, scale: likeScale, rotate: -10 }}
          className="pointer-events-none absolute left-5 top-6 inline-flex h-12 items-center gap-2 rounded-full bg-red-600 pe-5 ps-4 font-display text-2xl font-extrabold text-white shadow-[0_10px_30px_-8px_rgb(229_15_5/0.9)]"
        >
          <Heart className="h-5 w-5 fill-current" strokeWidth={2} />{t('swipe.yes')}
        </m.span>
        <m.span
          aria-hidden
          style={{ opacity: nopeOpacity, scale: nopeScale, rotate: 10 }}
          className="pointer-events-none absolute right-5 top-6 inline-flex h-12 items-center gap-2 rounded-full bg-white pe-5 ps-4 font-display text-2xl font-extrabold text-black shadow-[0_10px_30px_-8px_rgb(0_0_0/0.8)]"
        >
          <X className="h-5 w-5" strokeWidth={2.8} />{t('swipe.no')}
        </m.span>
      </m.div>
    </m.div>
  )
}

/**
 * The card pile you physically throw: drag the top card (or use the buttons, or ← →) right for yes,
 * left for nope. The next card is live the moment one is thrown, so quick decisions never wait on
 * an animation; the vote itself is sent once the card has left the screen.
 */
export default function SwipeDeck({ cards, total, onVote }: {
  cards: SwipeCard[]
  total: number
  onVote: (card: SwipeCard, yes: boolean) => void
}) {
  const t = useT()
  const [leaving, setLeaving] = useState<{ card: SwipeCard, yes: boolean }[]>([])
  const progress = useMotionValue(0)
  const control = useRef<Thrower | null>(null)

  const leavingKeys = new Set(leaving.map((item) => item.card.key))
  const queue = cards.filter((card) => !leavingKeys.has(card.key))
  const top = queue[0]

  // A new card on top starts from rest.
  useIsomorphicLayoutEffect(() => { progress.set(0) }, [top?.key, progress])

  const onCommit = useCallback((card: SwipeCard, yes: boolean) => {
    setLeaving((list) => (list.some((item) => item.card.key === card.key) ? list : [...list, { card, yes }]))
  }, [])
  const onGone = useCallback((card: SwipeCard, yes: boolean) => {
    setLeaving((list) => list.filter((item) => item.card.key !== card.key))
    onVote(card, yes)
  }, [onVote])

  useEffect(() => {
    if (!top) return
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return
      if ((event.target as HTMLElement)?.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')) return
      if (event.key === 'ArrowRight') { event.preventDefault(); control.current?.(true) }
      if (event.key === 'ArrowLeft') { event.preventDefault(); control.current?.(false) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [top])

  // The buttons lean in as the card is dragged their way.
  const likeLean = useTransform(progress, [0, 1], [1, 1.14])
  const nopeLean = useTransform(progress, [-1, 0], [1.14, 1])

  const items = [
    ...queue.slice(0, 3).map((card, depth) => ({ card, depth, status: (depth === 0 ? 'active' : 'waiting') as Status })).reverse(),
    ...leaving.map(({ card }) => ({ card, depth: 0, status: 'leaving' as Status })),
  ]
  const position = Math.min(total, total - queue.length + 1)

  return (
    <div className="[--deck-chrome:430px] sm:[--deck-chrome:400px] lg:[--deck-chrome:330px]">
      <div
        className="relative isolate mx-auto mt-7 aspect-[2/3]"
        style={{ width: 'min(100%, 380px, max(240px, calc((100dvh - var(--deck-chrome)) * 2 / 3)))' }}
      >
        {items.map(({ card, depth, status }) => (
          <DeckCard
            key={card.key}
            card={card}
            depth={depth}
            status={status}
            progress={progress}
            control={control}
            onCommit={onCommit}
            onGone={onGone}
          />
        ))}
      </div>

      {/* Same physical sides as the gesture in every language: nope on the left, yes on the right. */}
      <div dir="ltr" className="mt-6 flex items-center justify-center gap-7">
        <m.div style={{ scale: nopeLean }}>
          <button
            type="button"
            onClick={() => control.current?.(false)}
            disabled={!top}
            aria-label={top ? `${t('swipe.no')}: ${top.title}` : t('swipe.no')}
            className="pressable grid h-16 w-16 place-items-center rounded-full bg-white/[0.08] text-white ring-1 ring-white/15 transition-colors duration-150 hover:bg-white/[0.14] disabled:opacity-40"
          >
            <X aria-hidden className="h-7 w-7" strokeWidth={2.4} />
          </button>
        </m.div>
        <span className="min-w-[56px] text-center text-[13px] tabular-nums text-white/50" aria-label={t('swipe.progress', { current: position, total })}>
          {position} / {total}
        </span>
        <m.div style={{ scale: likeLean }}>
          <button
            type="button"
            onClick={() => control.current?.(true)}
            disabled={!top}
            aria-label={top ? `${t('swipe.yes')}: ${top.title}` : t('swipe.yes')}
            className="pressable grid h-16 w-16 place-items-center rounded-full bg-red-600 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.22),0_12px_32px_-10px_rgb(229_15_5/0.85)] transition-colors duration-150 hover:bg-red-500 disabled:opacity-40"
          >
            <Heart aria-hidden className="h-7 w-7 fill-current" strokeWidth={2} />
          </button>
        </m.div>
      </div>
      <p className="mt-4 text-center text-[13px] text-white/45 [@media(pointer:coarse)]:hidden">{t('swipe.hint')}</p>
    </div>
  )
}
