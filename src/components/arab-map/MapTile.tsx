"use client"
import { forwardRef } from 'react'
import Link from 'next/link'
import TmdbImage from '@/src/components/TmdbImage'
import TunisiaMark from '@/src/components/tunisian/TunisiaMark'
import { useI18n } from '@/src/components/I18nProvider'
import { isArabicScript } from '@/src/lib/i18n/locales'
import { arabCountryHref } from '@/src/lib/arab-countries'
import { cellOf, posterOpacity, rippleDelay } from '@/src/lib/arab-map'
import { cn } from '@/src/lib/utils'
import type { MapCountry } from '@/src/lib/arab-cinema'

export type TileState = {
  selected: boolean
  /** The keyboard's one tab stop. */
  current: boolean
  /** Kids, nothing kid-safe on record: still selectable, drawn dimmed (dashed ring). */
  dim: boolean
  /** The entrance ripple (first mount only). */
  ripple: boolean
  /** Shown in the readout (a finger slid onto it, or the keyboard reached it), not open. */
  previewed: boolean
}

type Handlers = {
  onPointerEnter?: (event: React.PointerEvent<HTMLAnchorElement>) => void
  onPointerLeave?: (event: React.PointerEvent<HTMLAnchorElement>) => void
  onPointerDown?: (event: React.PointerEvent<HTMLAnchorElement>) => void
  onFocus?: (event: React.FocusEvent<HTMLAnchorElement>) => void
}

/**
 * One country on the map: a square lit by its film of the day (the brighter, the more the country
 * has on record), its name from 640px up and its two-letter code on phones. A link to the
 * country's panel; the map keeps one tab stop (`current`) and moves it with the arrow keys.
 */
const MapTile = forwardRef<HTMLAnchorElement, { country: MapCountry, state: TileState } & Handlers>(function MapTile(
  { country, state, ...handlers },
  ref,
) {
  const { t, locale } = useI18n()
  const { code, name, pick, n } = country
  const { x, y } = cellOf(code)
  const lit = !!pick?.poster
  return (
    <Link
      ref={ref}
      href={arabCountryHref(code)}
      scroll={false}
      prefetch={false}
      data-country={code}
      aria-current={state.selected ? 'page' : undefined}
      tabIndex={state.current ? 0 : -1}
      draggable={false}
      {...handlers}
      className={cn(
        'group/tile relative isolate block aspect-square select-none overflow-hidden rounded-[10px] outline-none [-webkit-touch-callout:none]',
        'transition-[background-color,box-shadow] duration-200 ease-out',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white',
        state.dim
          ? 'border border-dashed border-white/25 bg-white/[0.015]'
          : 'bg-white/[0.04] ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.07]',
        lit && !state.dim && 'shadow-[0_10px_28px_-12px_rgb(var(--map-accent)/0.10)]',
        state.ripple && 'animate-focus-in [animation-delay:var(--ripple)] motion-reduce:[animation-delay:0ms]',
      )}
      style={{
        gridColumnStart: x + 1,
        gridRowStart: y + 1,
        '--ripple': `${rippleDelay(code)}ms`,
        '--poster': posterOpacity(n),
      } as React.CSSProperties}
    >
      {lit && (
        <span
          aria-hidden
          className={cn(
            'absolute inset-0 -z-10 transition-opacity duration-200 ease-out group-hover/tile:opacity-90',
            state.selected ? 'opacity-75' : 'opacity-[var(--poster)]',
          )}
        >
          <TmdbImage
            kind="poster"
            path={pick!.poster}
            fill
            sizes="(min-width: 1280px) 96px, (min-width: 640px) 80px, 40px"
            shimmer={false}
            alt=""
            draggable={false}
            className="object-cover"
          />
        </span>
      )}
      {/* The sand light at the bottom, and a scrim so the name reads over any poster. */}
      <span aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(120%_80%_at_50%_120%,rgb(var(--map-accent)/0.10),transparent_70%)]" />
      {lit && <span aria-hidden className="absolute inset-x-0 bottom-0 -z-10 hidden h-3/4 bg-gradient-to-t from-black/80 via-black/30 to-transparent sm:block" />}

      {/* Phones: the code, so every tile can be told apart. */}
      <span aria-hidden dir="ltr" className="absolute inset-0 grid place-items-center text-[11px] font-semibold uppercase tracking-normal text-white/70 sm:hidden">
        {code}
      </span>
      {/* From 640px: the name, at the bottom start, two lines at most. */}
      <span
        dir="auto"
        className={cn(
          'absolute inset-x-1.5 bottom-1.5 hidden text-start font-display text-[clamp(11.5px,0.95vw,12.5px)] font-bold leading-[1.1] [hyphens:auto] [overflow-wrap:anywhere] sm:line-clamp-2 lg:inset-x-2 lg:bottom-2',
          state.dim ? 'text-white/50' : 'text-white',
        )}
      >
        {name}
      </span>
      <span className="sr-only sm:hidden">{name}</span>
      {/* What the dashed ring says to the eye, said to a screen reader. */}
      {state.dim && <span className="sr-only">{`${isArabicScript(locale) ? '، ' : ', '}${t('arabMap.kidsNothing')}`}</span>}

      {/* The country in the readout: a plain white ring, no motion (a slide crosses tiles fast). The
          keyboard's own outline already marks a focused tile, so the ring stands aside for it. */}
      {state.previewed && (
        <span aria-hidden className="pointer-events-none absolute inset-0 rounded-[10px] ring-2 ring-inset ring-white/70 group-focus-visible/tile:hidden" />
      )}

      {code === 'tn' && <TunisiaMark className="absolute end-1 top-1 h-3.5 w-3.5 text-red-500 drop-shadow-[0_0_8px_rgb(255_36_20/0.5)] sm:end-1.5 sm:top-1.5 sm:h-4 sm:w-4" />}

    </Link>
  )
})

export default MapTile
