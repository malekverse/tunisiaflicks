"use client"
import React, { useEffect, useId, useRef } from 'react'
import Link from 'next/link'
import { m, useReducedMotion } from 'framer-motion'
import { Heart, Info, Play, RotateCcw, X } from 'lucide-react'
import TmdbImage from '@/src/components/TmdbImage'
import { Button } from '@/src/components/ui/button'
import { useT } from '@/src/components/I18nProvider'
import { EASE_OUT, haptic, spring, tween } from '@/src/lib/motion'
import type { SwipeCard } from '@/src/lib/swipe'

// One short burst of confetti from behind the poster: red (the room's signal) and white.
const PIECES = Array.from({ length: 16 }, (_, index) => {
  const angle = (index / 16) * Math.PI * 2 + (index % 2 ? 0.18 : 0)
  const distance = 120 + (index % 3) * 34
  return {
    x: Math.cos(angle) * distance,
    y: Math.sin(angle) * distance * 0.9,
    rotate: (index % 2 ? 1 : -1) * (90 + index * 23),
    red: index % 3 !== 0,
    round: index % 4 === 0,
  }
})

function Burst() {
  return (
    <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-0 w-0">
      <m.span
        initial={{ scale: 0.5, opacity: 0.7 }}
        animate={{ scale: 2.6, opacity: 0 }}
        transition={{ duration: 0.9, ease: EASE_OUT, delay: 0.12 }}
        className="absolute -left-20 -top-20 h-40 w-40 rounded-full ring-2 ring-red-500/70"
      />
      {PIECES.map((piece, index) => (
        <m.span
          key={index}
          initial={{ x: 0, y: 0, scale: 0.4, rotate: 0, opacity: 1 }}
          animate={{ x: piece.x, y: piece.y, scale: 1, rotate: piece.rotate, opacity: 0 }}
          transition={{ duration: 0.95, ease: EASE_OUT, delay: 0.1 + (index % 4) * 0.02, opacity: { duration: 0.95, ease: [0.6, 0, 0.9, 0.4], delay: 0.1 } }}
          className={`absolute -left-1 -top-1.5 ${piece.round ? 'h-2.5 w-2.5 rounded-full' : 'h-3 w-1.5 rounded-[2px]'} ${piece.red ? 'bg-red-500' : 'bg-white'}`}
        />
      ))}
    </div>
  )
}

/**
 * "It's a match!": the poster everyone said yes to grows into the light, with one short burst.
 * Watch it now, or keep swiping (or deal a new deck).
 */
export default function MatchMoment({ card, names, onNewDeck, onClose }: {
  card: SwipeCard
  names: string
  onNewDeck: () => void
  onClose: () => void
}) {
  const t = useT()
  const reduceMotion = useReducedMotion()
  const titleId = useId()
  const primary = useRef<HTMLAnchorElement>(null)
  const href = `/${card.media_type}/${card.id}`

  useEffect(() => {
    haptic(24)
    primary.current?.focus({ preventScroll: true })
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [onClose])

  return (
    <m.div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: tween.base }}
      exit={{ opacity: 0, transition: tween.fast }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose() }}
      className="fixed inset-0 z-[70] overflow-y-auto overscroll-contain bg-black"
    >
      {/* The matched title's own light fills the room. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        {(card.backdrop_path || card.poster_path) && (
          <TmdbImage
            kind={card.backdrop_path ? 'backdrop' : 'poster'}
            path={card.backdrop_path || card.poster_path}
            fill
            sizes="40vw"
            shimmer={false}
            alt=""
            className="scale-110 object-cover opacity-60 blur-2xl"
          />
        )}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgb(0_0_0/0.3),rgb(0_0_0/0.9)_72%)]" />
      </div>

      <button
        type="button"
        onClick={onClose}
        aria-label={t('common.close')}
        className="pressable glass fixed end-4 top-[calc(env(safe-area-inset-top,0px)+16px)] z-10 grid h-11 w-11 place-items-center rounded-full text-white/85 hover:text-white"
      >
        <X aria-hidden className="h-5 w-5" />
      </button>

      <div className="flex min-h-full flex-col items-center justify-center px-6 pb-[calc(env(safe-area-inset-bottom,0px)+32px)] pt-[calc(env(safe-area-inset-top,0px)+72px)] text-center">
        <div className="relative">
          {!reduceMotion && <Burst />}
          <m.div
            initial={{ scale: 0.62, opacity: 0, rotate: -7, y: 28 }}
            animate={{ scale: 1, opacity: 1, rotate: 0, y: 0 }}
            transition={{ ...spring.pop, opacity: { duration: 0.2 } }}
            className="relative aspect-[2/3] w-[min(52vw,250px)] overflow-hidden rounded-[18px] bg-white/[0.06] shadow-[0_40px_90px_-24px_rgb(229_15_5/0.6)] ring-1 ring-white/15"
          >
            <TmdbImage kind="poster" path={card.poster_path} fill sizes="250px" alt={card.title} priority className="object-cover" />
          </m.div>
          <m.span
            aria-hidden
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ ...spring.pop, delay: 0.22 }}
            className="absolute inset-x-0 -bottom-6 mx-auto grid h-14 w-14 place-items-center rounded-full bg-red-600 text-white shadow-[0_12px_30px_-8px_rgb(229_15_5/0.9)] ring-4 ring-black"
          >
            <Heart className="h-6 w-6 fill-current" strokeWidth={2} />
          </m.span>
        </div>

        <m.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...tween.slow, delay: 0.18 }}
          className="mt-12 flex w-full max-w-md flex-col items-center"
        >
          <h2 id={titleId} className="font-display text-[clamp(44px,10vw,68px)] font-extrabold leading-[0.95] text-white">{t('swipe.matchTitle')}</h2>
          <p className="mt-3 max-w-[40ch] text-pretty text-[15px] text-white/70">{t('swipe.matchText', { names })}</p>
          <p className="mt-4 text-balance font-display text-2xl font-bold text-white"><bdi>{card.title}</bdi></p>

          <div className="mt-7 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
            <Button asChild size="lg" className="px-8">
              <Link ref={primary} href={`${href}#streamSection`}><Play aria-hidden className="h-5 w-5 fill-current" />{t('hero.watchNow')}</Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href={href}><Info aria-hidden className="h-5 w-5" />{t('pick.moreInfo')}</Link>
            </Button>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
            <Button type="button" variant="ghost" onClick={onClose}>{t('swipe.keepSwiping')}</Button>
            <Button type="button" variant="ghost" onClick={onNewDeck}><RotateCcw aria-hidden className="h-4 w-4" />{t('swipe.playAgain')}</Button>
          </div>
        </m.div>
      </div>
    </m.div>
  )
}
