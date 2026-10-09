// The TunisiaFlicks "A" (public/A.svg) as inline SVG: three strokes that fold into a triangle, so
// it can move. BrandMark is the still logo; BrandLoader is the site's one loader ("chase": the
// strokes light up in turn, opacity only, see globals.css .tf-chase). Server-safe: no hooks.
import { cn } from '@/src/lib/utils'

/** The three strokes, in the order they light up (right, left, base). Coordinates of public/A.svg's path. */
export const MARK_STROKES = [
  'M50 11.03 48.38 13.84 44.66 20.31 44.13 21.25 44.66 22.19 70.41 66.78 45.66 66.78 45.13 67.72 41.41 74.22 39.78 77 43 77 84.88 77.03 88.09 77 86.47 74.19 51.63 13.84Z',
  'M43.09 23 41.47 25.81 6.63 86.19 5 88.97 16.81 88.97 17.34 88.03 43.09 43.44 54.94 63.91 55.44 64.84 67.25 64.84 65.63 62.06 44.72 25.81Z',
  'M42.97 47.13 41.38 49.94 20.44 86.16 18.81 88.97 95 88.97 93.38 86.16 89.66 79.69 89.09 78.75 36.53 78.75 48.34 58.28 48.88 57.34 48.34 56.41 44.59 49.94Z',
] as const

/** The mark's box within those coordinates (a little air around the strokes). */
export const MARK_VIEWBOX = '0 6 100 88'

type MarkProps = {
  className?: string
  /** 'brand': the logo's red. 'current': the surrounding text colour (inside buttons). */
  tone?: 'brand' | 'current'
}

export function BrandMark({ className, tone = 'brand' }: MarkProps) {
  return (
    <svg viewBox={MARK_VIEWBOX} aria-hidden className={cn('shrink-0', tone === 'brand' ? 'fill-[#ff0f00]' : 'fill-current', className)}>
      {MARK_STROKES.map((d) => <path key={d} d={d} />)}
    </svg>
  )
}

/**
 * Something is loading. Sized by className like an icon (h-4 w-4 in a button, h-8 w-8 on its
 * own). Decorative unless given a `label`, which screen readers then hear as a status.
 */
export function BrandLoader({ className, tone = 'current', label }: MarkProps & { label?: string }) {
  return (
    <svg
      viewBox={MARK_VIEWBOX}
      role={label ? 'status' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn('tf-chase shrink-0', tone === 'brand' ? 'fill-[#ff0f00]' : 'fill-current', className)}
    >
      {MARK_STROKES.map((d) => <path key={d} d={d} />)}
    </svg>
  )
}
