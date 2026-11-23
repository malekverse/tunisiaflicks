"use client"
// The music game's player: one big button that plays the first seconds of the day's track (as many
// as the clue being looked at allows), and a bar of the 30-second preview with the parts you may
// hear so far. The sound comes from /api/soundtrack/preview/<track> (a fresh Deezer link each
// time); a link that has expired by the time you press play again is fetched anew.
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { m, useReducedMotion } from 'framer-motion'
import { Loader2, Pause, Play, Volume2 } from 'lucide-react'
import { useI18n } from '@/src/components/I18nProvider'
import { CLIPS, PREVIEW_SECONDS } from '@/src/lib/guess-music'
import { cn } from '@/src/lib/utils'

type State = 'idle' | 'loading' | 'playing' | 'error'

const PLAY_TIMEOUT_MS = 12_000

export default function MusicPlayer({ track, seconds, unlocked }: {
  track: number
  /** How long this play lasts (the clue being looked at). */
  seconds: number
  /** The longest clip reached so far (the bar shows it). */
  unlocked: number
}) {
  const { t } = useI18n()
  const reduceMotion = useReducedMotion()
  const audio = useRef<HTMLAudioElement | null>(null)
  const frame = useRef<number | null>(null)
  const retried = useRef(false)
  const [state, setState] = useState<State>('idle')
  const [position, setPosition] = useState(0)

  const stopLoop = () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current)
    frame.current = null
  }
  const stop = useCallback(() => {
    stopLoop()
    audio.current?.pause()
    setState((current) => (current === 'error' ? current : 'idle'))
    setPosition(0)
  }, [])

  // A new day (another track): forget the old sound.
  useEffect(() => {
    retried.current = false
    return () => {
      stopLoop()
      audio.current?.pause()
      audio.current = null
    }
  }, [track])
  // Looking at another clue stops what's playing.
  useEffect(() => { stop() }, [seconds, stop])

  const source = (fresh: boolean) => `/api/soundtrack/preview/${track}${fresh ? `?r=${Date.now()}` : ''}`

  const play = async () => {
    if (state === 'playing') return stop()
    if (!audio.current) {
      audio.current = new Audio(source(false))
      audio.current.preload = 'auto'
    }
    const element = audio.current
    setState('loading')
    try {
      element.currentTime = 0
      // A play that never starts (no sound device, a stalled link) gives up instead of spinning.
      await Promise.race([element.play(), new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), PLAY_TIMEOUT_MS))])
    } catch {
      element.pause()
      // The preview link may have expired (they last minutes): one fresh try.
      if (!retried.current) {
        retried.current = true
        audio.current = new Audio(source(true))
        return play()
      }
      setState('error')
      return
    }
    retried.current = false
    setState('playing')
    const tick = () => {
      const now = element.currentTime
      setPosition(now)
      if (now >= seconds || element.ended) {
        element.pause()
        stopLoop()
        setState('idle')
        setPosition(0)
        return
      }
      frame.current = requestAnimationFrame(tick)
    }
    stopLoop()
    frame.current = requestAnimationFrame(tick)
  }

  const percent = (value: number) => `${(Math.min(value, PREVIEW_SECONDS) / PREVIEW_SECONDS) * 100}%`
  const label = state === 'playing' ? t('guessMusic.stop') : seconds >= PREVIEW_SECONDS ? t('guessMusic.playAll') : t('guessMusic.play', { seconds })

  return (
    <div className="relative isolate overflow-hidden rounded-stage bg-gradient-to-br from-red-600/25 via-white/[0.04] to-transparent px-5 py-8 ring-1 ring-white/10 rtl:bg-gradient-to-bl sm:px-8 sm:py-10">
      <div aria-hidden className="absolute -end-24 -top-24 -z-10 h-72 w-72 rounded-full bg-red-600/20 blur-3xl" />
      <div className="flex flex-col items-center text-center">
        <m.button
          type="button"
          onClick={play}
          whileTap={reduceMotion ? undefined : { scale: 0.94 }}
          aria-label={label}
          className="pressable grid h-24 w-24 place-items-center rounded-full bg-red-600 text-white shadow-[0_20px_50px_-12px_rgb(var(--red-600)/0.85)] outline-none focus-visible:ring-4 focus-visible:ring-white/70 sm:h-28 sm:w-28"
        >
          {state === 'loading'
            ? <Loader2 aria-hidden className="h-10 w-10 animate-spin" />
            : state === 'playing'
              ? <Pause aria-hidden className="h-10 w-10 fill-current" />
              : <Play aria-hidden className="ms-1 h-10 w-10 fill-current rtl:-scale-x-100" />}
        </m.button>
        <p className="mt-4 flex items-center gap-2 text-[15px] font-semibold text-white"><Volume2 aria-hidden className="h-4 w-4 text-white/70" />{label}</p>
        {state === 'error' && <p role="alert" className="mt-2 text-[13.5px] text-red-300">{t('guessMusic.audioFailed')}</p>}
      </div>

      {/* The preview's 30 seconds: what you may hear so far, and where the sound is. */}
      <div className="relative mx-auto mt-7 h-3 max-w-[560px] overflow-hidden rounded-full bg-white/[0.08]" dir="ltr" aria-hidden>
        <div className="absolute inset-y-0 start-0 rounded-full bg-white/25" style={{ width: percent(unlocked) }} />
        <div className="absolute inset-y-0 start-0 rounded-full bg-red-500" style={{ width: percent(position) }} />
        {CLIPS.slice(0, -1).map((clip) => (
          <span key={clip} className="absolute inset-y-0 w-px bg-black/60" style={{ left: percent(clip) }} />
        ))}
      </div>
      <div className="mx-auto mt-2 flex max-w-[560px] justify-between text-[12px] text-white/50" dir="ltr">
        <span>0:00</span>
        <span className={cn(unlocked >= PREVIEW_SECONDS && 'text-white/80')}>0:{String(PREVIEW_SECONDS).padStart(2, '0')}</span>
      </div>
    </div>
  )
}
