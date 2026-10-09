"use client"
// A calendar leaf: the month on its binding strip, the day big, the weekday under it. In the
// night's own time zone. The month turns to the signal red only on the day itself (it's on tonight).
import { useI18n } from '@/src/components/I18nProvider'
import { leafParts, nightDay, relativeDay } from '@/src/lib/movie-night-format'
import { cn } from '@/src/lib/utils'

const SIZES = {
  sm: { box: 'w-11 rounded-[11px]', strip: 'h-[15px] text-[9.5px]', day: 'text-[19px] pt-0.5', weekday: 'text-[9.5px] pb-1', hole: 'top-[3px] h-[3px] w-[3px]' },
  md: { box: 'w-[60px] rounded-[14px]', strip: 'h-[19px] text-[11px]', day: 'text-[28px] pt-1', weekday: 'text-[11px] pb-1.5', hole: 'top-[4px] h-1 w-1' },
  lg: { box: 'w-[76px] rounded-[18px] sm:w-[92px] sm:rounded-[20px]', strip: 'h-[22px] text-[12px] sm:h-[26px] sm:text-[13.5px]', day: 'text-[38px] pt-1.5 sm:text-[48px]', weekday: 'text-[12px] pb-2 sm:text-[13.5px] sm:pb-2.5', hole: 'top-[5px] h-[5px] w-[5px] sm:top-[6px]' },
} as const

export default function DateTile({ at, tz, size = 'md' }: { at: string; tz: string; size?: 'sm' | 'md' | 'lg' }): JSX.Element {
  const { locale } = useI18n()
  const parts = leafParts(at, tz, locale)
  const today = relativeDay(at, tz) === 'today'
  const s = SIZES[size]
  return (
    <span
      role="img"
      aria-label={nightDay(at, tz, locale)}
      suppressHydrationWarning
      className={cn(
        'relative inline-flex shrink-0 select-none flex-col items-center overflow-hidden bg-white/[0.07] text-center shadow-[0_14px_30px_-16px_rgb(0_0_0/0.9)] ring-1 ring-inset ring-white/[0.12]',
        s.box,
      )}
    >
      {/* The binding: a strip with two punched holes, as on a tear-off calendar. */}
      <span aria-hidden className={cn('relative flex w-full items-end justify-center bg-white/[0.1] font-semibold leading-none', s.strip, today ? 'text-red-400' : 'text-white/75')} suppressHydrationWarning>
        <span className={cn('absolute start-[22%] rounded-full bg-black/70', s.hole)} />
        <span className={cn('absolute end-[22%] rounded-full bg-black/70', s.hole)} />
        <span className="pb-[3px]">{parts.month}</span>
      </span>
      <span aria-hidden className={cn('font-display font-extrabold leading-none tabular-nums text-white', s.day)}>{parts.day}</span>
      <span aria-hidden className={cn('leading-none text-white/60', s.weekday)}>{parts.weekday}</span>
    </span>
  )
}
