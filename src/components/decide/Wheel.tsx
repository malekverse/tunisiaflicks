"use client"
// Spin the wheel: every pick is a slice (in fair mode each person's picks share one person's share
// of the wheel), the pointer is at the top, and the wheel slows down onto the winner. For a double
// or triple feature it spins again without the films already in.
import React, { useEffect, useId, useMemo, useRef, useState } from 'react'
import { animate, m, useMotionValue, useReducedMotion } from 'framer-motion'
import { Scale } from 'lucide-react'
import { Button } from '@/src/components/ui/button'
import { Switch } from '@/src/components/ui/switch'
import { useT } from '@/src/components/I18nProvider'
import { fairnessMatters, landingRotation, spinIndex, wheelWeights, type Pick } from '@/src/lib/decide'
import { haptic, spring } from '@/src/lib/motion'
import { tmdbImageUrl } from '@/src/lib/tmdb-image'
import { cn } from '@/src/lib/utils'
import { Avatar } from './parts'
import { PERSON_COLORS, type DecidePerson } from './storage'

const R = 190
/** Where the posters sit (a fraction of the radius), and the hub's edge. */
const POSTER_AT = 0.82
const HUB = 0.27
const posterRadius = (size: number) => Math.min(22, Math.sin(((size / 2) * Math.PI) / 180) * R * POSTER_AT - 3)
const SLICE_COLORS = ['#dc2626', '#1c1c21', '#8f1414', '#2b2b31']
const point = (angle: number, radius: number) => {
  const rad = (angle * Math.PI) / 180
  return [radius * Math.sin(rad), -radius * Math.cos(rad)]
}
const sliceColor = (index: number, count: number) => (count > 1 && index === count - 1 && index % SLICE_COLORS.length === 0 ? SLICE_COLORS[2] : SLICE_COLORS[index % SLICE_COLORS.length])
const clip = (text: string, max: number) => (Array.from(text).length > max ? `${Array.from(text).slice(0, max - 1).join('').trim()}…` : text)

export default function Wheel({ picks, people, count, fair, onFair, fairAvailable = true, onDone }: {
  picks: Pick[]
  people: DecidePerson[]
  /** Films to pick (one spin each). */
  count: number
  fair: boolean
  onFair?: (fair: boolean) => void
  /** Fair mode makes sense here (not when breaking a vote's tie). */
  fairAvailable?: boolean
  onDone: (keys: string[]) => void
}) {
  const t = useT()
  const ids = useId()
  const reduceMotion = useReducedMotion()
  const rotation = useMotionValue(0)
  const [remaining, setRemaining] = useState(picks)
  const [won, setWon] = useState<string[]>([])
  const [spinning, setSpinning] = useState(false)
  const [landed, setLanded] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  const spinningRef = useRef(false)
  useEffect(() => () => clearTimeout(timer.current), [])

  const showFair = fairAvailable && fairnessMatters(remaining)
  const weights = useMemo(() => wheelWeights(remaining, showFair && fair), [remaining, showFair, fair])
  const slices = useMemo(() => {
    let start = 0
    return remaining.map((pick, index) => {
      const size = weights[index] * 360
      const slice = { pick, index, start, size, mid: start + size / 2 }
      start += size
      return slice
    })
  }, [remaining, weights])
  const owner = (pick: Pick) => people.find((person) => person.id === pick.by) ?? null
  const target = Math.min(count, picks.length)

  // A little tick each time a slice passes under the pointer (Android).
  useEffect(() => {
    let last = -1
    return rotation.on('change', (value) => {
      const under = ((360 - (value % 360)) % 360 + 360) % 360
      const index = slices.findIndex((slice) => under >= slice.start && under < slice.start + slice.size)
      if (index !== last) {
        last = index
        if (spinningRef.current) haptic(3)
      }
    })
  }, [rotation, slices])

  const spin = () => {
    if (spinning || remaining.length === 0) return
    const index = spinIndex(weights)
    const key = remaining[index].key
    const to = landingRotation(weights, index, rotation.get(), undefined, reduceMotion ? 2 : 6)
    setSpinning(true)
    spinningRef.current = true
    setLanded(null)
    haptic(12)
    animate(rotation, to, {
      duration: reduceMotion ? 0.9 : 5.2,
      ease: [0.12, 0.72, 0.08, 1],
      onComplete: () => {
        spinningRef.current = false
        setSpinning(false)
        setLanded(key)
        haptic(30)
        timer.current = setTimeout(() => {
          const next = [...won, key]
          if (next.length >= target || remaining.length <= 1) {
            onDone(next)
            return
          }
          setWon(next)
          setRemaining((list) => list.filter((pick) => pick.key !== key))
          setLanded(null)
        }, 1500)
      },
    })
  }

  const landedPick = remaining.find((pick) => pick.key === landed) ?? null

  return (
    <div className="flex flex-col items-center">
      {target > 1 && (
        <p className="mb-3 text-[14px] font-medium text-white/70">{t('decide.stage.film', { index: Math.min(won.length + 1, target), count: target })}</p>
      )}
      {won.length > 0 && (
        <ol className="mb-4 flex flex-wrap justify-center gap-2">
          {won.map((key, index) => {
            const pick = picks.find((item) => item.key === key)!
            return (
              <li key={key} className="inline-flex max-w-[220px] items-center gap-2 rounded-full bg-white/[0.08] py-1 pe-3 ps-1 text-[13px] text-white/85">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-red-600 text-[12px] font-bold text-white">{index + 1}</span>
                <bdi dir="auto" className="truncate">{pick.title}</bdi>
              </li>
            )
          })}
        </ol>
      )}

      <div className="relative mt-6 w-[min(88vw,440px)]">
        {/* The pointer. */}
        <div aria-hidden className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-[38%] drop-shadow-[0_6px_10px_rgb(0_0_0/0.6)]">
          <svg width="34" height="40" viewBox="0 0 34 40"><path d="M17 40 L2 8 A16 16 0 0 1 32 8 Z" fill="#fff" /><circle cx="17" cy="13" r="5" fill="#dc2626" /></svg>
        </div>

        <m.div style={{ rotate: rotation }} className="aspect-square w-full rounded-full shadow-[0_30px_80px_-20px_rgb(229_15_5/0.45)]">
          <svg viewBox="-200 -200 400 400" className="h-full w-full" role="img" aria-label={t('decide.wheel.name')}>
            <defs>
              {slices.map((slice) => {
                const [x, y] = point(slice.mid, R * POSTER_AT)
                const radius = posterRadius(slice.size)
                return <clipPath key={slice.pick.key} id={`${ids}-c${slice.index}`}><circle cx={x} cy={y} r={Math.max(0, radius)} /></clipPath>
              })}
            </defs>
            <circle r={R + 8} fill="#0b0b0d" stroke="rgb(255 255 255 / 0.14)" strokeWidth="2" />
            {slices.map((slice) => {
              const color = sliceColor(slice.index, slices.length)
              const isLanded = landed === slice.pick.key
              const [x0, y0] = point(slice.start, R)
              const [x1, y1] = point(slice.start + slice.size, R)
              const large = slice.size > 180 ? 1 : 0
              const path = slices.length === 1 ? null : `M0 0 L${x0} ${y0} A${R} ${R} 0 ${large} 1 ${x1} ${y1} Z`
              const [px, py] = point(slice.mid, R * POSTER_AT)
              const radius = posterRadius(slice.size)
              const showPoster = slice.size >= 22 && !!slice.pick.poster_path && radius > 12
              // The title runs along the radius, from just inside the poster (or the rim) towards
              // the hub, as long as it fits; on the left half it's turned so it never reads upside down.
              const fontSize = slice.size >= 30 ? 13 : 11
              const outer = showPoster ? R * POSTER_AT - radius - 6 : R * 0.93
              const maxChars = Math.max(4, Math.floor((outer - R * HUB - 6) / (fontSize * 0.54)))
              const flip = slice.mid > 180
              const person = owner(slice.pick)
              return (
                <g key={slice.pick.key} opacity={landed && !isLanded ? 0.45 : 1} style={{ transition: 'opacity 300ms ease' }}>
                  {path ? <path d={path} fill={color} stroke="#0b0b0d" strokeWidth="2" /> : <circle r={R} fill={color} />}
                  {showPoster && (
                    <>
                      <image
                        href={tmdbImageUrl(slice.pick.poster_path!, 'poster', 92)}
                        x={px - radius}
                        y={py - radius * 1.5}
                        width={radius * 2}
                        height={radius * 3}
                        preserveAspectRatio="xMidYMid slice"
                        clipPath={`url(#${ids}-c${slice.index})`}
                      />
                      <circle cx={px} cy={py} r={radius} fill="none" stroke={person ? PERSON_COLORS[person.color % PERSON_COLORS.length] : 'rgb(255 255 255 / 0.5)'} strokeWidth="2.5" />
                    </>
                  )}
                  {slice.size >= 11 && (
                    <text
                      transform={`rotate(${slice.mid}) translate(0 ${-outer}) rotate(${flip ? 90 : -90})`}
                      textAnchor={flip ? 'start' : 'end'}
                      // Anchors mean the same on an Arabic page (the title itself still reads right to left).
                      direction="ltr"
                      dominantBaseline="central"
                      fill="#fff"
                      fontSize={fontSize}
                      fontWeight={600}
                      style={{ fontFamily: 'inherit' }}
                    >
                      {clip(slice.pick.title, maxChars)}
                    </text>
                  )}
                </g>
              )
            })}
          </svg>
        </m.div>

        {/* The hub spins the wheel too. */}
        <button
          type="button"
          onClick={spin}
          disabled={spinning || !!landed}
          aria-label={t('decide.wheel.spin')}
          className="pressable absolute left-1/2 top-1/2 grid h-[22%] w-[22%] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white font-display text-[clamp(14px,3.6vw,18px)] font-extrabold text-black shadow-[0_10px_30px_-6px_rgb(0_0_0/0.8)] outline-none ring-4 ring-black focus-visible:ring-red-500 disabled:cursor-default"
        >
          {t('decide.wheel.spin')}
        </button>
      </div>

      <p aria-live="polite" className="mt-6 min-h-[34px] text-balance text-center font-display text-[22px] font-bold text-white">
        {landedPick ? <m.span initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={spring.ui} className="inline-block">{t('decide.wheel.landed', { title: landedPick.title })}</m.span> : null}
      </p>

      <Button type="button" size="lg" onClick={spin} disabled={spinning || !!landed} className="mt-3 w-full max-w-xs">
        {spinning ? t('decide.wheel.spinning') : t('decide.wheel.spin')}
      </Button>

      {showFair && onFair && (
        <label className="mt-6 flex w-full max-w-md cursor-pointer items-start gap-3 rounded-[16px] bg-white/[0.05] p-4">
          <Scale aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-white/70" />
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold text-white">{t('decide.wheel.fair')}</span>
            <span className="mt-0.5 block text-[13px] leading-relaxed text-white/60">{t('decide.wheel.fairHint')}</span>
          </span>
          <Switch checked={fair} onCheckedChange={onFair} disabled={spinning} aria-label={t('decide.wheel.fair')} />
        </label>
      )}

      {/* Every film and its chance, readable at any size. */}
      <ul className="mt-6 w-full max-w-md space-y-1">
        {slices.map((slice) => {
          const person = owner(slice.pick)
          return (
            <li key={slice.pick.key} className={cn('flex items-center gap-3 rounded-[12px] px-3 py-2 text-[14px] transition-opacity', landed && landed !== slice.pick.key && 'opacity-50')}>
              <span aria-hidden className="h-3 w-3 shrink-0 rounded-full ring-1 ring-white/20" style={{ background: sliceColor(slice.index, slices.length) }} />
              <bdi dir="auto" className="min-w-0 flex-1 truncate text-white/85">{slice.pick.title}</bdi>
              {person && <Avatar person={person} size={22} />}
              <span className="w-11 shrink-0 text-end tabular-nums text-white/50">{Math.round(weights[slice.index] * 100)}%</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
