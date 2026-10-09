"use client"
// "Listen on": the soundtrack on Deezer (the album) and as a search on Anghami, Spotify and
// YouTube Music. Anghami leads in Arabic and Derja; the service the viewer last opened leads
// from then on (remembered on this device). Never shown to Kids profiles (no links out).
import { useEffect, useId, useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { useI18n } from '@/src/components/I18nProvider'
import { LAST_SERVICE_KEY, SERVICE_NAMES, listenOrder, listenUrl, type ListenService } from '@/src/lib/listen-links'
import type { TKey } from '@/src/lib/i18n'
import { cn } from '@/src/lib/utils'

const readLast = () => {
  try {
    return window.localStorage.getItem(LAST_SERVICE_KEY)
  } catch {
    return null
  }
}

/** The services in the order to show them (Deezer or Anghami first until the viewer picks one). */
export function useListenOrder(): ListenService[] {
  const { locale } = useI18n()
  const [last, setLast] = useState<string | null>(null)
  useEffect(() => setLast(readLast()), [])
  return listenOrder(locale, last)
}

export const rememberService = (service: ListenService) => {
  try {
    window.localStorage.setItem(LAST_SERVICE_KEY, service)
  } catch {
    // Private mode: the order just isn't remembered.
  }
}

export const LINK_CHIP = 'pressable inline-flex h-10 shrink-0 select-none items-center gap-1.5 whitespace-nowrap rounded-full bg-white/[0.06] px-4 text-[13.5px] font-medium text-white/80 outline-none transition-[transform,background-color,color] duration-200 ease-out hover:bg-white/[0.12] hover:text-white focus-visible:ring-2 focus-visible:ring-red-500'

export default function ListenLinks({ query, deezerAlbum, label, labelKey = 'soundtrack.listenOn', className }: {
  /** What the searches look for ('Inception Hans Zimmer'). */
  query: string
  /** The album on Deezer, when there is one (otherwise Deezer is a search too). */
  deezerAlbum?: string | null
  /** For the "Find the soundtrack" panel: each link says 'Search on …'. */
  label?: 'search'
  labelKey?: TKey
  className?: string
}) {
  const { t } = useI18n()
  const order = useListenOrder()
  const headingId = useId()
  return (
    <div className={className}>
      {!label && <p id={headingId} className="mb-2 text-[13px] text-white/60">{t(labelKey)}</p>}
      <ul aria-labelledby={label ? undefined : headingId} className={cn('flex flex-wrap gap-2', label && 'flex-col items-stretch')}>
        {order.map((service) => (
          <li key={service} className="flex">
            <a
              href={listenUrl(service, query, deezerAlbum)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => rememberService(service)}
              aria-label={label ? t('soundtrack.searchOn', { service: SERVICE_NAMES[service] }) : t('soundtrack.openIn', { service: SERVICE_NAMES[service] })}
              className={cn(LINK_CHIP, label && 'h-11 w-full justify-between px-4')}
            >
              <span>{label ? t('soundtrack.searchOn', { service: SERVICE_NAMES[service] }) : SERVICE_NAMES[service]}</span>
              <ArrowUpRight aria-hidden className="h-4 w-4 shrink-0 text-white/50 rtl:-scale-x-100" />
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
