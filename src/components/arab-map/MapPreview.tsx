"use client"
import TmdbImage from '@/src/components/TmdbImage'
import { useT } from '@/src/components/I18nProvider'
import { cn } from '@/src/lib/utils'
import MapStats from './MapStats'
import type { MapCountry } from '@/src/lib/arab-cinema'

export type PreviewPlace = { left: number, top?: number, bottom?: number, below: boolean }

/**
 * The card that rises over the map when a mouse rests on a country: its name, its film of the
 * day and its counts. Decoration for sighted mouse users (the tile's link says the same to a
 * screen reader), so it is hidden from assistive tech and never takes the pointer.
 */
export default function MapPreview({ country, dim, place, open, instant }: {
  country: MapCountry | null
  dim: boolean
  place: PreviewPlace | null
  open: boolean
  /** Already warm (another country was just previewed): no entrance. */
  instant: boolean
}) {
  const t = useT()
  if (!country || !place) return null
  const pick = country.pick
  return (
    <div
      aria-hidden
      data-map-preview=""
      className={cn(
        'glass pointer-events-none absolute z-30 w-[248px] rounded-[18px] p-3 shadow-[0_24px_60px_-18px_rgb(0_0_0/0.9)]',
        'transition-[opacity,transform] ease-out',
        place.below ? 'origin-top' : 'origin-bottom',
        open ? 'scale-100 opacity-100 duration-150' : 'scale-[0.97] opacity-0 duration-100',
        instant && 'duration-0',
      )}
      style={{ left: place.left, top: place.top, bottom: place.bottom }}
    >
      <div className="flex gap-3">
        <span className="relative block aspect-[2/3] w-14 shrink-0 overflow-hidden rounded-[8px] bg-white/[0.06] ring-1 ring-inset ring-white/10">
          {pick?.poster && <TmdbImage kind="poster" path={pick.poster} fill sizes="56px" alt="" className="object-cover" />}
        </span>
        <div className="min-w-0 flex-1 py-0.5">
          <p dir="auto" className="font-display text-[18px] font-bold leading-tight text-white">{country.name}</p>
          {pick && !dim && (
            <>
              <p className="mt-1.5 text-[11.5px] text-white/55">{t('arabMap.filmOfTheDay')}</p>
              <p className="mt-0.5 line-clamp-2 text-[13px] font-medium leading-snug text-white/90"><bdi>{pick.title}</bdi></p>
              {pick.year && <p className="text-[12px] tabular-nums text-white/55">{pick.year}</p>}
            </>
          )}
        </div>
      </div>
      <MapStats country={country} dim={dim} className="mt-2.5 border-t border-white/[0.08] pt-2.5" />
    </div>
  )
}
