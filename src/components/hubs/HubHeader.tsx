import RoomTint from '@/src/components/shell/RoomTint'
import { cn } from '@/src/lib/utils'

/**
 * The top of a hub (Tunisian, the drama hubs, Arab cinema...): the room lit in the hub's accent, a
 * big display title, one line under it, an optional watermark glyph behind (about 13% of the
 * accent), an end slot (SegmentedLinks) and a below slot (HubDoors).
 *
 * The accent ("r g b") is only ever light: the tint, the watermark and a glow. Never a button.
 * `display` is the big hub title; `compact` leaves room for a picture frame right under it.
 * Works in server and client trees (no hooks of its own).
 */
export default function HubHeader({ title, subtitle, accent, watermark, end, below, size = 'display' }: {
  title: string
  subtitle?: string
  accent: string
  watermark?: React.ReactNode
  end?: React.ReactNode
  below?: React.ReactNode
  size?: 'display' | 'compact'
}) {
  const compact = size === 'compact'
  return (
    <header className={cn('page-x page-top relative isolate overflow-hidden', compact ? 'pb-5 sm:pb-6' : 'pb-7 sm:pb-8')}>
      <RoomTint color={accent} />
      {/* A pool of the hub's light behind the title. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -start-32 -top-40 -z-20 h-[440px] w-[680px] rounded-full opacity-60 blur-3xl"
        style={{ background: `radial-gradient(closest-side, rgb(${accent} / 0.32), transparent)` }}
      />
      {watermark && (
        <div
          aria-hidden
          className={cn(
            'pointer-events-none absolute -z-10 opacity-[0.13] [&>svg]:h-full [&>svg]:w-full',
            compact ? '-end-16 -top-16 h-[320px] w-[320px] sm:-end-6 sm:h-[400px] sm:w-[400px]' : '-end-24 -top-10 h-[420px] w-[420px] sm:-end-10 sm:h-[560px] sm:w-[560px]',
          )}
          style={{ color: `rgb(${accent})` }}
        >
          {watermark}
        </div>
      )}
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between md:gap-8">
        <div className="min-w-0">
          <h1
            className={cn(
              'animate-focus-in text-balance font-display font-extrabold text-white',
              compact ? 'text-[clamp(36px,5.4vw,72px)] leading-[0.95]' : 'text-[clamp(40px,6.5vw,92px)] leading-[0.92]',
            )}
          >
            {title}
          </h1>
          {subtitle && (
            <p className={cn('max-w-[56ch] animate-focus-in text-pretty text-[15px] leading-relaxed text-white/60 [animation-delay:60ms]', compact ? 'mt-2.5' : 'mt-3')}>
              {subtitle}
            </p>
          )}
        </div>
        {end && <div className="shrink-0 animate-focus-in [animation-delay:120ms]">{end}</div>}
      </div>
      {below && <div className="mt-8">{below}</div>}
    </header>
  )
}
