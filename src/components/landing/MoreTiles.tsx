"use client"
// More of the landing page's bento (see Tools): the daily games, Decide together's wheel, Play on
// my TV and the sleep timer. Each tile does what it describes, on today's pictures.
import { useEffect, useRef, useState } from 'react'
import { Moon, Play, Tv } from 'lucide-react'
import { AnimatePresence, animate, m, useMotionValue } from 'framer-motion'
import { useI18n } from '@/src/components/I18nProvider'
import TmdbImage from '@/src/components/TmdbImage'
import { BrandMark } from '@/src/components/brand/BrandMark'
import { haptic, spring } from '@/src/lib/motion'
import type { Pic } from '@/src/lib/landing-model'
import { cn } from '@/src/lib/utils'
import { PicImg, useCalm } from './parts'
import { Tile, TileLink } from './tile'

// ---- A game a day --------------------------------------------------------------------------------

/** How close the still is cropped at each try: tight at first, the whole frame at the last. */
const ZOOMS = [3.2, 2.4, 1.8, 1.4, 1.12, 1]

/** A film's still, cropped tight like the daily game's: each "Zoom out" shows more of it. */
export function GuessTile({ still }: { still: { title: string, backdrop: string } }) {
  const { t } = useI18n()
  const reduced = useCalm()
  const [step, setStep] = useState(0)
  const done = step === ZOOMS.length - 1
  return (
    <Tile
      title="landing.guess.title"
      text="landing.guess.text"
      footer={(
        <div className="flex flex-wrap gap-2">
          <TileLink href="/guess">{t('landing.guess.film')}</TileLink>
          <TileLink href="/guess/music">{t('landing.guess.music')}</TileLink>
          <TileLink href="/guess/actor">{t('landing.guess.actor')}</TileLink>
        </div>
      )}
    >
      <div className="relative aspect-video overflow-hidden rounded-tile bg-black ring-1 ring-white/10">
        <m.div
          className="absolute inset-0"
          style={{ transformOrigin: '62% 38%' }}
          initial={false}
          animate={{ scale: ZOOMS[step] }}
          transition={reduced ? { duration: 0 } : { type: 'spring', bounce: 0.12, duration: 0.8 }}
        >
          <TmdbImage path={still.backdrop} kind="backdrop" alt="" fill sizes="(min-width: 1024px) 70vw, 100vw" className="object-cover" />
        </m.div>
        <AnimatePresence>
          {done && (
            <m.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1], delay: reduced ? 0 : 0.35 }}
              className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-4 pt-12"
            >
              <p className="truncate font-display text-[20px] font-bold text-white sm:text-[24px]" dir="auto">{t('landing.guess.answer', { title: still.title })}</p>
            </m.div>
          )}
        </AnimatePresence>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <div aria-hidden className="flex flex-1 gap-1">
          {ZOOMS.map((_, index) => (
            <span key={index} className={cn('h-1.5 flex-1 rounded-full transition-colors duration-300', index <= step ? (done ? 'bg-emerald-400' : 'bg-red-500') : 'bg-white/15')} />
          ))}
        </div>
        <span className="shrink-0 text-[12.5px] tabular-nums text-white/55" aria-live="polite">
          {done ? '' : t('landing.guess.try', { n: step + 1 })}
        </span>
        <button
          type="button"
          onClick={() => { haptic(8); setStep((value) => (value === ZOOMS.length - 1 ? 0 : value + 1)) }}
          className="pressable h-9 shrink-0 rounded-full bg-white px-4 text-[13px] font-semibold text-black transition-colors hover:bg-white/85"
        >
          {done ? t('landing.guess.again') : t('landing.guess.zoom')}
        </button>
      </div>
    </Tile>
  )
}

// ---- Decide together -----------------------------------------------------------------------------

const SLICE = 60
/** The wheel's slices, two shades of the pick-a-film violet taking turns. */
const WHEEL = `conic-gradient(from -30deg, ${Array.from({ length: 6 }, (_, index) => `${index % 2 ? '#1b0c2c' : '#2c1446'} ${index * SLICE}deg ${(index + 1) * SLICE}deg`).join(', ')})`

/** Six of this week's films on a wheel: spin it and tonight's film lands under the pointer. */
export function DecideTile({ pics }: { pics: Pic[] }) {
  const { t } = useI18n()
  const reduced = useCalm()
  const rotation = useMotionValue(0)
  const [spinning, setSpinning] = useState(false)
  const [winner, setWinner] = useState<number | null>(null)

  const spin = () => {
    if (spinning) return
    haptic(8)
    // Never the same film twice in a row.
    const choices = pics.map((_, index) => index).filter((index) => index !== winner)
    const pick = choices[Math.floor(Math.random() * choices.length)]
    // Whole turns, then the pick's slice under the pointer (slice i sits at i × 60° from the top).
    const base = Math.ceil(rotation.get() / 360) * 360 + 360 * 4
    const target = base + ((360 - pick * SLICE) % 360)
    setWinner(null)
    setSpinning(true)
    animate(rotation, target, {
      duration: reduced ? 0 : 3.2,
      ease: [0.12, 0.8, 0.16, 1],
      onComplete: () => { setSpinning(false); setWinner(pick); haptic(16) },
    })
  }

  return (
    <Tile title="landing.decide.title" text="landing.decide.text" footer={<TileLink href="/decide">{t('landing.decide.start')}</TileLink>}>
      <div className="flex flex-col items-center">
        <div className="relative aspect-square w-[min(100%,250px)]">
          <m.div className="absolute inset-0 rounded-full ring-1 ring-white/10 shadow-[0_30px_60px_-30px_rgb(168_85_247/0.6)]" style={{ rotate: rotation, background: WHEEL }}>
            {pics.map((pic, index) => (
              <div
                key={index}
                className="absolute left-1/2 top-1/2 w-[22%]"
                style={{ transform: `translate(-50%, -50%) rotate(${index * SLICE}deg) translateY(-92%)` }}
              >
                <PicImg
                  pic={pic}
                  width={92}
                  className={cn('aspect-[2/3] w-full rounded-[6px] ring-2 transition-[box-shadow,filter] duration-300', winner === index ? 'ring-white' : 'ring-black/50', winner !== null && winner !== index && 'brightness-[0.45]')}
                />
              </div>
            ))}
          </m.div>
          {/* The hub (it hides where the posters meet) and its button, which don't turn. */}
          <div aria-hidden className="absolute left-1/2 top-1/2 h-[38%] w-[38%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-black ring-4 ring-white/[0.08]" />
          <button
            type="button"
            onClick={spin}
            disabled={spinning}
            aria-label={t('landing.decide.hint')}
            className="pressable absolute left-1/2 top-1/2 grid h-[30%] w-[30%] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-[14px] font-bold text-black shadow-[0_10px_30px_-10px_rgb(168_85_247/0.9)] transition-[background-color,opacity] hover:bg-white/90 disabled:opacity-70"
          >
            {t('landing.decide.spin')}
          </button>
          {/* The pointer. */}
          <span aria-hidden className="absolute left-1/2 top-[-4px] z-10 h-0 w-0 -translate-x-1/2 border-x-[9px] border-t-[15px] border-x-transparent border-t-red-500 drop-shadow-[0_2px_6px_rgb(0_0_0/0.6)]" />
        </div>
        <p className="mt-3 min-h-[22px] max-w-full truncate text-center text-[15px] font-semibold text-white" aria-live="polite" dir="auto">
          {winner !== null ? t('landing.decide.won', { title: pics[winner].title }) : ''}
        </p>
      </div>
    </Tile>
  )
}

// ---- Play on my TV -------------------------------------------------------------------------------

type Phase = 'idle' | 'sending' | 'arrived' | 'playing'

/** A phone and a TV: send the phone's film and it lands on the TV, then plays. */
export function TvTile({ pics }: { pics: Pic[] }) {
  const { t } = useI18n()
  const reduced = useCalm()
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>('idle')
  const pic = pics[index % pics.length]

  useEffect(() => {
    if (phase !== 'sending' && phase !== 'arrived') return
    const next: Phase = phase === 'sending' ? 'arrived' : 'playing'
    const timer = window.setTimeout(() => setPhase(next), phase === 'sending' ? (reduced ? 0 : 750) : 1600)
    return () => window.clearTimeout(timer)
  }, [phase, reduced])

  const busy = phase === 'sending' || phase === 'arrived'
  const press = () => {
    if (busy) return
    haptic(10)
    if (phase === 'playing') {
      setIndex((value) => value + 1)
      setPhase('idle')
    } else {
      setPhase('sending')
    }
  }

  return (
    <Tile title="landing.tv.title" text="landing.tv.text" footer={<TileLink href="/app">{t('landing.tv.apps')}</TileLink>}>
      <div className="flex items-end justify-center gap-3 sm:gap-5">
        {/* The phone. */}
        <div className="w-[24%] max-w-[120px] shrink-0">
          <div className="relative aspect-[9/18.5] rounded-[18px] bg-black p-[5px] shadow-[0_30px_50px_-25px_rgb(0_0_0/0.9)] ring-1 ring-white/15">
            <div className="flex h-full flex-col overflow-hidden rounded-[13px] bg-[#111]">
              <AnimatePresence mode="popLayout" initial={false}>
                <m.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: phase === 'sending' ? 0.4 : 1, y: 0, scale: phase === 'sending' ? 0.94 : 1 }}
                  exit={{ opacity: 0 }}
                  transition={spring.ui}
                >
                  <PicImg pic={pic} width={154} className="aspect-[2/3] w-full" />
                </m.div>
              </AnimatePresence>
              <div className="flex flex-1 flex-col justify-end gap-1 p-1.5">
                <span className="truncate text-[9px] font-semibold text-white/85" dir="auto">{pic.title}</span>
                <span
                  aria-hidden
                  onClick={press}
                  className={cn('flex h-[18px] cursor-pointer items-center justify-center gap-1 rounded-full text-[8.5px] font-semibold text-white transition-colors', busy ? 'bg-red-800' : 'bg-red-600 hover:bg-red-500')}
                >
                  <Tv className="h-2.5 w-2.5" />
                  {t('landing.tv.button')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* The way across: a dot runs from the phone to the TV. */}
        <div aria-hidden className="relative mb-[14%] h-3 w-[12%] max-w-[80px] shrink-0 self-end rtl:-scale-x-100">
          <span className="absolute inset-x-0 top-1/2 border-t-2 border-dashed border-white/15" />
          {phase === 'sending' && !reduced && (
            <m.span
              className="absolute top-0 h-3 w-3 rounded-full bg-red-500 shadow-[0_0_14px_rgb(239_68_68)]"
              initial={{ left: '-10%' }}
              animate={{ left: '100%' }}
              transition={{ duration: 0.7, ease: [0.45, 0, 0.55, 1] }}
            />
          )}
        </div>

        {/* The TV. */}
        <div className="w-[60%] max-w-[380px]">
          <div className="relative aspect-video rounded-[8px] bg-black p-[4px] shadow-[0_40px_60px_-30px_rgb(0_0_0/0.9)] ring-1 ring-white/15">
            <div className="relative h-full w-full overflow-hidden rounded-[5px] bg-[#0b0b0d]">
              <AnimatePresence initial={false}>
                {phase === 'playing' ? (
                  <m.div key={`play-${index}`} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}>
                    <PicImg pic={pic} width={342} className="absolute inset-0 h-full w-full scale-125 opacity-60 blur-xl" />
                    <div className="absolute inset-0 flex items-center justify-center gap-[5%] px-[8%]">
                      <PicImg pic={pic} width={185} className="aspect-[2/3] h-[78%] w-auto rounded-[4px] shadow-xl" />
                      <div className="min-w-0">
                        <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-black">
                          <Play aria-hidden className="h-2.5 w-2.5 fill-current rtl:-scale-x-100" />
                          {t('landing.tv.playing')}
                        </span>
                        <p className="mt-1.5 line-clamp-2 font-display text-[clamp(12px,1.6vw,18px)] font-bold leading-tight text-white" dir="auto">{pic.title}</p>
                      </div>
                    </div>
                    <span className="absolute inset-x-0 bottom-0 h-[3px] bg-white/20">
                      <m.span className="block h-full origin-left bg-red-500 rtl:origin-right" initial={{ scaleX: 0 }} animate={{ scaleX: 0.35 }} transition={{ duration: reduced ? 0 : 9, ease: 'linear' }} />
                    </span>
                  </m.div>
                ) : (
                  <m.div key="home" className="absolute inset-0 grid place-items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <BrandMark className="h-[22%] w-auto opacity-25" />
                  </m.div>
                )}
              </AnimatePresence>
              {/* What the TV shows when a title arrives (like the TV app's own). */}
              <AnimatePresence>
                {phase === 'arrived' && (
                  <m.div
                    initial={{ opacity: 0, y: 16, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={spring.ui}
                    className="absolute bottom-[7%] end-[5%] flex max-w-[70%] items-center gap-2 rounded-[8px] bg-black/85 p-1.5 pe-3 ring-1 ring-white/15 backdrop-blur"
                  >
                    <PicImg pic={pic} width={92} className="aspect-[2/3] w-7 shrink-0 rounded-[3px]" />
                    <span className="min-w-0">
                      <span className="block text-[9.5px] text-white/60">{t('landing.tv.from')}</span>
                      <span className="block truncate text-[11px] font-semibold text-white" dir="auto">{pic.title}</span>
                    </span>
                  </m.div>
                )}
              </AnimatePresence>
            </div>
          </div>
          <div aria-hidden className="mx-auto flex w-[40%] justify-between">
            <span className="h-3 w-1.5 -skew-x-[20deg] rounded-b-[2px] bg-white/20" />
            <span className="h-3 w-1.5 skew-x-[20deg] rounded-b-[2px] bg-white/20" />
          </div>
        </div>
      </div>
      <div className="mt-4 flex justify-center">
        <button
          type="button"
          onClick={press}
          disabled={busy}
          className="pressable inline-flex h-10 items-center gap-2 rounded-full bg-white px-4 text-[13.5px] font-semibold text-black transition-[background-color,opacity] hover:bg-white/85 disabled:opacity-60"
        >
          <Tv aria-hidden className="h-4 w-4" />
          {phase === 'playing' ? t('landing.tv.again') : t('landing.tv.send')}
        </button>
      </div>
      <p className="sr-only" aria-live="polite">{phase === 'playing' ? `${t('landing.tv.playing')}: ${pic.title}` : ''}</p>
    </Tile>
  )
}

// ---- Sleep timer ---------------------------------------------------------------------------------

/** The demo runs this long whatever was chosen (a real timer takes the real minutes). */
const DEMO_MS = 6500
/** A typical episode, for "End of episode". */
const EPISODE_MINUTES = 42
const MINUTES = [15, 30, 45, 60] as const

type Choice = (typeof MINUTES)[number] | 'episode'

const clockOf = (minutes: number) => {
  const seconds = Math.max(0, Math.round(minutes * 60))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

/** Pick a time: it counts down (sped up), the picture dims at the end, then it's good night. */
export function SleepTile({ still }: { still: string | null }) {
  const { t } = useI18n()
  const reduced = useCalm()
  const [choice, setChoice] = useState<Choice | null>(null)
  const [progress, setProgress] = useState(0)
  const frame = useRef(0)
  const asleep = choice !== null && progress >= 1

  useEffect(() => {
    if (choice === null) return
    const start = performance.now()
    const tick = (now: number) => {
      const value = Math.min(1, (now - start) / (reduced ? 1500 : DEMO_MS))
      setProgress(value)
      if (value < 1) frame.current = requestAnimationFrame(tick)
      else haptic(14)
    }
    frame.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame.current)
  }, [choice, reduced])

  const total = choice === null ? 0 : choice === 'episode' ? EPISODE_MINUTES : choice
  // Full brightness, then the last quarter fades towards dark, as the real timer warns.
  const brightness = progress < 0.75 ? 1 : 1 - ((progress - 0.75) / 0.25) * 0.75
  const pick = (value: Choice) => { haptic(6); setProgress(0); setChoice(value) }

  return (
    <Tile title="landing.sleep.title" text="landing.sleep.text">
      <div className="relative aspect-video overflow-hidden rounded-tile bg-black ring-1 ring-white/10">
        <div className="absolute inset-0 transition-[filter] duration-150" style={{ filter: `brightness(${brightness})` }}>
          {still
            ? <TmdbImage path={still} kind="backdrop" alt="" fill sizes="(min-width: 1024px) 30vw, 90vw" className="object-cover" />
            : <div className="h-full w-full bg-gradient-to-br from-indigo-950 to-black" />}
        </div>
        {choice !== null && !asleep && (
          <span className="absolute end-2.5 top-2.5 inline-flex items-center gap-1.5 rounded-full bg-black/70 px-2.5 py-1 text-[12px] font-semibold tabular-nums text-white backdrop-blur" dir="ltr">
            <Moon aria-hidden className="h-3.5 w-3.5" />
            {clockOf(total * (1 - progress))}
          </span>
        )}
        <AnimatePresence>
          {asleep && (
            <m.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduced ? 0 : 0.8 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black"
            >
              <Moon aria-hidden className="h-7 w-7 text-indigo-200" />
              <p className="font-display text-[20px] font-bold text-white">{t('landing.sleep.night')}</p>
              <button
                type="button"
                onClick={() => { haptic(6); setChoice(null); setProgress(0) }}
                className="pressable h-8 rounded-full bg-white/[0.12] px-3.5 text-[12.5px] font-medium text-white transition-colors hover:bg-white/[0.2]"
              >
                {t('landing.sleep.wake')}
              </button>
            </m.div>
          )}
        </AnimatePresence>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label={t('landing.sleep.pick')}>
        {MINUTES.map((minutes) => (
          <SleepChip key={minutes} on={choice === minutes} onClick={() => pick(minutes)}>{t('landing.sleep.minutes', { n: minutes })}</SleepChip>
        ))}
        <SleepChip on={choice === 'episode'} onClick={() => pick('episode')}>{t('landing.sleep.episode')}</SleepChip>
      </div>
      {/* The clock changes every frame: read out only where it ends. */}
      <p className="mt-2 text-[12px] text-white/45">
        {choice === null ? t('landing.sleep.pick') : asleep ? '' : `${t('landing.sleep.left')} ${clockOf(total * (1 - progress))} · ${t('landing.sleep.fast')}`}
      </p>
      <p className="sr-only" aria-live="polite">{asleep ? t('landing.sleep.night') : ''}</p>
    </Tile>
  )
}

function SleepChip({ on, onClick, children }: { on: boolean, onClick: () => void, children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn('pressable h-8 rounded-full px-3 text-[12.5px] font-medium transition-colors', on ? 'bg-indigo-200 text-black' : 'bg-white/[0.07] text-white/75 hover:bg-white/[0.12]')}
    >
      {children}
    </button>
  )
}
