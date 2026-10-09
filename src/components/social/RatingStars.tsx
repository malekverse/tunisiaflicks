"use client"
// Our own scale: one to five whole stars (TMDB's score keeps its single star and a decimal
// elsewhere). Stars are never red: the star colour, or a quiet outline when empty.
import { useRef, useState } from 'react'
import { m } from 'framer-motion'
import { Star } from 'lucide-react'
import { useI18n } from '@/src/components/I18nProvider'
import type { TKey } from '@/src/lib/i18n'
import { haptic, spring } from '@/src/lib/motion'
import { cn } from '@/src/lib/utils'

const STARS = [1, 2, 3, 4, 5] as const
const word = (n: number) => `social.ratings.star${n}` as TKey

/**
 * The rating input: a radio group of five 44px targets. Arrow keys move the rating (mirrored in
 * Arabic), Home and End jump to one and five, Delete clears it. A mouse previews on hover; touch
 * commits on tap.
 */
export function RatingStars({ value, onChange, label, disabled }: { value: number | null; onChange: (v: number | null) => void; label: string; disabled?: boolean }) {
  const { t, dir } = useI18n()
  const [preview, setPreview] = useState<number | null>(null)
  const buttons = useRef<(HTMLButtonElement | null)[]>([])
  const shown = preview ?? value ?? 0

  const commit = (next: number | null, focus = false) => {
    if (disabled || next === value) return
    haptic(10)
    onChange(next)
    if (focus) buttons.current[(next ?? 1) - 1]?.focus()
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    const forward = dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight'
    const backward = dir === 'rtl' ? 'ArrowRight' : 'ArrowLeft'
    let next: number | null | undefined
    if (event.key === forward || event.key === 'ArrowUp') next = Math.min(5, (value ?? 0) + 1)
    else if (event.key === backward || event.key === 'ArrowDown') next = Math.max(1, (value ?? 2) - 1)
    else if (event.key === 'Home') next = 1
    else if (event.key === 'End') next = 5
    else if (event.key === 'Delete' || event.key === 'Backspace') next = null
    if (next === undefined) return
    event.preventDefault()
    commit(next, true)
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <div
        role="radiogroup"
        aria-label={label}
        aria-disabled={disabled || undefined}
        onKeyDown={onKeyDown}
        onPointerLeave={() => setPreview(null)}
        className={cn('-mx-2.5 flex', disabled && 'opacity-50')}
      >
        {STARS.map((n) => {
          const filled = n <= shown
          const checked = value === n
          return (
            <button
              key={n}
              ref={(node) => { buttons.current[n - 1] = node }}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-label={`${t('social.ratings.starsAria', { count: n })}, ${t(word(n))}`}
              tabIndex={(value ?? 1) === n ? 0 : -1}
              disabled={disabled}
              onClick={() => commit(n)}
              onPointerEnter={(event) => { if (event.pointerType === 'mouse') setPreview(n) }}
              className="group grid h-11 w-11 shrink-0 select-none place-items-center rounded-full outline-none [-webkit-tap-highlight-color:transparent] [touch-action:manipulation] focus-visible:ring-2 focus-visible:ring-red-500"
            >
              <m.span
                key={checked ? 'on' : 'off'}
                initial={checked ? { scale: 0.7 } : false}
                animate={{ scale: 1 }}
                transition={spring.pop}
                className="grid place-items-center"
              >
                {/* The press scale lives on the star: Motion owns the wrapper's transform. */}
                <Star
                  aria-hidden
                  strokeWidth={1.8}
                  className={cn(
                    'h-6 w-6 transition-[color,fill,opacity,transform] duration-150 ease-out group-active:scale-90',
                    filled ? 'fill-star text-star' : 'text-white/30',
                    filled && preview !== null && preview !== value && 'opacity-80',
                  )}
                />
              </m.span>
            </button>
          )
        })}
      </div>
      <span aria-hidden className={cn('min-w-[7.5rem] text-[13.5px] transition-colors', shown ? 'text-white/75' : 'text-white/50')}>
        {shown ? t(word(shown)) : t('social.ratings.notRated')}
      </span>
    </div>
  )
}

/** One star filled to `fill` (0..1), from the start side: averages show halves. */
function PartialStar({ fill, size }: { fill: number; size: number }) {
  return (
    <span className="relative inline-block shrink-0" style={{ width: size, height: size }}>
      <Star aria-hidden strokeWidth={1.8} className="absolute inset-0 text-white/30" style={{ width: size, height: size }} />
      {fill > 0 && (
        <span className="absolute inset-y-0 start-0 overflow-hidden" style={{ width: `${Math.round(fill * 100)}%` }}>
          <Star aria-hidden strokeWidth={1.8} className="fill-star text-star" style={{ width: size, height: size, maxWidth: 'none' }} />
        </span>
      )}
    </span>
  )
}

/** A read-only row of five small stars for an average (or one person's rating), with the count. */
export function RatingSummary({ average, countLabel, className }: { average: number; countLabel: string; className?: string }) {
  const { t } = useI18n()
  const value = Math.max(0, Math.min(5, average))
  return (
    <span role="img" aria-label={t('social.ratings.averageAria', { value, count: countLabel })} className={cn('inline-flex items-center gap-2', className)}>
      <span className="inline-flex items-center gap-0.5">
        {STARS.map((n) => <PartialStar key={n} fill={Math.max(0, Math.min(1, value - (n - 1)))} size={14} />)}
      </span>
      <span className="text-[13px] font-semibold tabular-nums text-white">{value.toFixed(1).replace(/\.0$/, '')}</span>
      <span className="text-[13px] text-white/50">{t('social.ratings.from', { count: countLabel })}</span>
    </span>
  )
}

/** Someone's whole-star rating, read-only (friends' ratings, feed rows). */
export function StarsReadOnly({ stars, size = 14, className }: { stars: number; size?: number; className?: string }) {
  const { t } = useI18n()
  return (
    <span role="img" aria-label={t('social.ratings.starsAria', { count: stars })} className={cn('inline-flex items-center gap-0.5', className)}>
      {STARS.map((n) => <PartialStar key={n} fill={n <= stars ? 1 : 0} size={size} />)}
    </span>
  )
}
