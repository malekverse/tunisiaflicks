"use client"
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { useT } from '@/src/components/I18nProvider'
import { arabCountryHref } from '@/src/lib/arab-countries'
import MapStats from './MapStats'
import type { MapCountry } from '@/src/lib/arab-cinema'

/**
 * The line under the map: the country being looked at (a finger sliding across the map, or the
 * keyboard), its counts and an 'Open {country}' button; at rest, the open country or a hint.
 * Sliding only ever previews: opening takes this button or a tap on a tile.
 */
export default function MapReadout({ country, selected, dim, coarse, onPrefetch }: {
  country: MapCountry | null
  selected: boolean
  dim: boolean
  /** A touch screen (the hint talks about tapping and sliding). */
  coarse: boolean
  onPrefetch: (href: string) => void
}) {
  const t = useT()
  if (!country) {
    return (
      <div data-map-readout="" className="flex min-h-[56px] items-center">
        <p className="text-[13.5px] leading-snug text-white/60">{t(coarse ? 'arabMap.hintTouch' : 'arabMap.hint')}</p>
      </div>
    )
  }
  const href = arabCountryHref(country.code)
  return (
    <div data-map-readout="" className="flex min-h-[56px] items-center gap-3">
      <div className="min-w-0 flex-1">
        <p dir="auto" className="truncate font-display text-[20px] font-bold leading-tight text-white sm:text-[22px]">{country.name}</p>
        <MapStats country={country} dim={dim} className="mt-0.5" />
      </div>
      {!selected && (
        <Link
          href={href}
          scroll={false}
          prefetch={false}
          onPointerEnter={() => onPrefetch(href)}
          onFocus={() => onPrefetch(href)}
          onPointerDown={() => onPrefetch(href)}
          className="pressable inline-flex h-11 max-w-[60%] shrink-0 items-center gap-1 rounded-full bg-white px-4 text-[14px] font-semibold text-black outline-none transition-colors hover:bg-white/85 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        >
          <span className="truncate">{t('arabMap.open', { country: country.name })}</span>
          <ChevronRight aria-hidden className="-me-1 h-4 w-4 rtl:rotate-180" />
        </Link>
      )}
    </div>
  )
}
