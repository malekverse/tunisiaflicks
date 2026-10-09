"use client"
// The vote's result, once per person: the films that were up are dealt into a fan, the winner lifts
// forward (spring.pop) while the others dim. Less motion: the winner, still, with its title.
import { useEffect, useId, useRef } from 'react'
import { m, useReducedMotion } from 'framer-motion'
import TmdbImage from '@/src/components/TmdbImage'
import { Button } from '@/src/components/ui/button'
import { useT } from '@/src/components/I18nProvider'
import { richT } from '@/src/lib/i18n/rich'
import { EASE_OUT, haptic, spring, tween } from '@/src/lib/motion'
import type { CandidateView } from '@/src/lib/movie-night'

const KEY = (id: string) => `tf-night-reveal:${id}`

/** Whether this browser has already seen this night's result (the film's key is remembered). */
export function revealSeen(id: string, key: string): boolean {
  try {
    return localStorage.getItem(KEY(id)) === key
  } catch {
    return true // no storage (private mode, previews): don't replay it on every visit
  }
}

export function markRevealSeen(id: string, key: string) {
  try {
    localStorage.setItem(KEY(id), key)
  } catch {
    // Nothing to remember it with: it simply won't show again this visit.
  }
}

// The fan: the winner in the middle, the runners-up to either side (logical: start and end).
const SPOTS = [
  { x: '0%', rotate: 0, z: 3 },
  { x: '-46%', rotate: -10, z: 1 },
  { x: '46%', rotate: 10, z: 2 },
]

export default function RevealMoment({ candidates, winner, onClose }: { candidates: CandidateView[]; winner: string; onClose: () => void }) {
  const t = useT()
  const reduce = useReducedMotion()
  const titleId = useId()
  const button = useRef<HTMLButtonElement>(null)
  const won = candidates.find((candidate) => candidate.key === winner)
  const others = candidates.filter((candidate) => candidate.key !== winner).sort((a, b) => b.votes - a.votes).slice(0, 2)
  const cards = won ? [won, ...others] : []

  useEffect(() => {
    button.current?.focus({ preventScroll: true })
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    // The lift is the moment worth a buzz.
    const buzz = setTimeout(() => haptic(22), reduce ? 0 : 900)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      clearTimeout(buzz)
    }
  }, [onClose, reduce])

  if (!won) return null
  const votes = won.votes === 1 ? t('movieNight.reveal.voteOne') : t('movieNight.reveal.votes', { count: won.votes })

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
      {/* The winner's own light fills the room. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        {(won.backdrop_path || won.media.poster_path) && (
          <TmdbImage kind={won.backdrop_path ? 'backdrop' : 'poster'} path={won.backdrop_path || won.media.poster_path} fill sizes="40vw" shimmer={false} alt="" className="scale-110 object-cover opacity-50 blur-2xl" />
        )}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgb(0_0_0/0.35),rgb(0_0_0/0.92)_70%)]" />
      </div>

      <div className="flex min-h-full flex-col items-center justify-center px-6 pb-[calc(env(safe-area-inset-bottom,0px)+32px)] pt-[calc(env(safe-area-inset-top,0px)+56px)] text-center">
        <m.p
          initial={{ opacity: 0, y: reduce ? 0 : 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...tween.base, delay: reduce ? 0 : 0.05 }}
          className="text-[14px] font-medium text-white/70"
        >
          {t('movieNight.reveal.kicker')}
        </m.p>

        <div aria-hidden className="relative mt-8 aspect-[10/8] w-[min(84vw,440px)]">
          {cards.map((card, index) => {
            const spot = SPOTS[index]
            const isWinner = index === 0
            if (reduce && !isWinner) return null
            const frame = isWinner
              ? 'relative h-full w-full overflow-hidden rounded-[14px] bg-white/[0.06] shadow-[0_40px_90px_-24px_rgb(229_15_5/0.55)] ring-1 ring-white/20'
              : 'relative h-full w-full overflow-hidden rounded-[14px] bg-white/[0.06] shadow-[0_24px_60px_-18px_rgb(0_0_0/0.9)] ring-1 ring-white/10'
            // Two layers: the outer one deals the card into the fan, the inner one lifts the winner
            // (or dims the others) once the fan has landed. Springs take two keyframes, so each
            // phase gets its own element.
            return (
              <m.div
                key={card.key}
                initial={reduce ? { opacity: 0 } : { x: '0%', y: '6%', rotate: 0, scale: 0.9, opacity: 0 }}
                animate={reduce ? { opacity: 1 } : { x: spot.x, y: isWinner ? '0%' : '4%', rotate: spot.rotate, scale: 1, opacity: 1 }}
                transition={reduce ? tween.base : { ...spring.momentum, delay: isWinner ? 0 : 0.1 + index * 0.06, opacity: { duration: 0.25, delay: isWinner ? 0 : 0.1 + index * 0.06 } }}
                style={{ zIndex: spot.z }}
                className="absolute inset-x-0 top-0 mx-auto aspect-[2/3] w-[52%]"
              >
                <m.div
                  initial={isWinner ? { y: '0%', scale: 1 } : { opacity: 1, scale: 1 }}
                  animate={reduce ? {} : isWinner ? { y: '-7%', scale: 1.1 } : { opacity: 0.38, scale: 0.92 }}
                  transition={isWinner ? { ...spring.pop, delay: 0.75 } : { duration: 0.45, ease: EASE_OUT, delay: 0.7 }}
                  className="h-full w-full"
                >
                  <div className={frame}>
                    <TmdbImage kind="poster" path={card.media.poster_path} fill sizes="240px" alt="" priority={isWinner} className="object-cover" />
                  </div>
                </m.div>
              </m.div>
            )
          })}
        </div>

        <m.div
          initial={{ opacity: 0, y: reduce ? 0 : 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...tween.slow, delay: reduce ? 0.05 : 1.05 }}
          className="mt-6 flex w-full max-w-md flex-col items-center"
        >
          <h2 id={titleId} className="text-balance font-display text-[clamp(34px,8vw,56px)] font-extrabold leading-[0.95] text-white">
            {richT(t, 'movieNight.film.watching', { title: won.media.title })}
          </h2>
          <p className="mt-3 text-[14px] text-white/65">{votes}</p>
          <p className="mt-1 text-[13px] text-white/55">{t('movieNight.vote.rule')}</p>
          <Button ref={button} type="button" size="lg" className="mt-8 px-8" onClick={onClose}>{t('movieNight.reveal.close')}</Button>
        </m.div>
      </div>
    </m.div>
  )
}
