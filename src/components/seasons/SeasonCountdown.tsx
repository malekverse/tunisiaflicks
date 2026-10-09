"use client"
import { m } from 'framer-motion'
import NumberFlow from '@number-flow/react'
import { useI18n } from '@/src/components/I18nProvider'
import { useCountdown } from '@/src/hooks/use-countdown'
import { tween } from '@/src/lib/motion'
import type { CountdownParts } from '@/src/lib/seasons'
import { cn } from '@/src/lib/utils'

type Unit = 'days' | 'hours' | 'minutes' | 'seconds'

const UNIT_LABEL = { days: 'countdown.days', hours: 'countdown.hours', minutes: 'countdown.minutes', seconds: 'seasons.countdown.seconds' } as const
const INTL_UNIT = { days: 'day', hours: 'hour', minutes: 'minute', seconds: 'second' } as const

/** Beats the inline filter motion writes, for people who ask for less motion. */
const NO_BLUR = 'motion-reduce:![filter:none]'

/** '1 day, 4 hours and 12 minutes' in the viewer's language, for screen readers. */
function spoken(parts: CountdownParts, units: Unit[], language: string) {
  try {
    const items = units
      .filter((unit) => parts[unit] > 0)
      .map((unit) => new Intl.NumberFormat(language, { style: 'unit', unit: INTL_UNIT[unit], unitDisplay: 'long' }).format(parts[unit]))
    return new Intl.ListFormat(language, { style: 'long', type: 'conjunction' }).format(items)
  } catch {
    return units.map((unit) => parts[unit]).join(' ')
  }
}

/**
 * A live countdown in tiles (days when there are any, hours, minutes, and seconds for New Year), lit
 * by the accent set as `--door` on an ancestor. At zero the tiles give way to `zeroTitle` (a
 * crossfade through a slight blur; opacity only for people who ask for less motion), announced
 * once. `initial` is what the server rendered, so hydration never jumps.
 */
export default function SeasonCountdown({ at, initial, seconds = false, zeroTitle, size = 'sm', className }: {
  /** The moment, in ms since the epoch, on this browser's clock. */
  at: number
  initial: CountdownParts
  seconds?: boolean
  zeroTitle: string
  size?: 'sm' | 'lg'
  className?: string
}) {
  const { t, dir, dateLocale } = useI18n()
  const { parts, done } = useCountdown(at, { seconds, initial })
  // A days tile only when there are days to count (decided once, so the tiles never reflow).
  const units: Unit[] = [...(initial.days > 0 ? ['days' as const] : []), 'hours', 'minutes', ...(seconds ? ['seconds' as const] : [])]
  const lg = size === 'lg'
  // The same targets on the server and in the browser (so hydration matches); for people who ask
  // for less motion, CSS takes the blur out (NO_BLUR) and the crossfade is opacity only.
  const hidden = { opacity: 0, filter: 'blur(2px)' }
  const shown = { opacity: 1, filter: 'blur(0px)' }

  // Both stay in the same grid cell, so the block keeps its size when the tiles give way.
  return (
    // justify-items-start: the tiles sit at the start of the line (the right in Arabic) even though
    // they read left to right.
    <div className={cn('grid justify-items-start', className)}>
      <m.div
        initial={false}
        animate={done ? hidden : shown}
        transition={tween.base}
        aria-hidden={done || undefined}
        className={cn('col-start-1 row-start-1', NO_BLUR, done && 'pointer-events-none')}
      >
        <div role="timer" aria-live="off" dir="ltr" className={cn('flex', lg ? 'gap-2.5' : 'gap-2')}>
          {units.map((unit) => (
            <span
              key={unit}
              aria-hidden
              className={cn(
                'flex min-w-[4.25rem] flex-col items-center rounded-2xl bg-white/[0.06] ring-1 ring-[rgb(var(--door,255_255_255)/0.2)]',
                lg ? 'px-4 py-3' : 'px-3 py-2.5',
              )}
            >
              <NumberFlow
                value={parts[unit]}
                format={{ minimumIntegerDigits: unit === 'days' ? 1 : 2 }}
                className={cn('font-display font-bold leading-none tabular-nums text-white', lg ? 'text-[30px]' : 'text-[26px]')}
              />
              <span className="mt-1.5 text-[11px] text-white/60" dir={dir}>{t(UNIT_LABEL[unit])}</span>
            </span>
          ))}
          <span className="sr-only" dir={dir}>{t('seasons.countdown.label', { time: spoken(parts, units, dateLocale ?? 'en') })}</span>
        </div>
      </m.div>
      <m.p
        aria-hidden
        initial={false}
        animate={done ? shown : hidden}
        transition={tween.base}
        className={cn(
          'col-start-1 row-start-1 self-center font-display font-extrabold leading-tight text-white', NO_BLUR,
          lg ? 'text-[28px] sm:text-[34px]' : 'text-[22px] sm:text-[26px]',
          !done && 'pointer-events-none',
        )}
        dir="auto"
      >
        {zeroTitle}
      </m.p>
      {/* Says the moment once, when it comes. */}
      <span role="status" className="sr-only">{done ? zeroTitle : ''}</span>
    </div>
  )
}
