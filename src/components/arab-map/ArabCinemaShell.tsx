"use client"
import { useEffect, useRef, useState } from 'react'
import { useSelectedLayoutSegment } from 'next/navigation'
import { Map as MapIcon } from 'lucide-react'
import { useT } from '@/src/components/I18nProvider'
import { useTvMode } from '@/src/hooks/use-tv-mode'
import { cn } from '@/src/lib/utils'

/**
 * /arab-cinema and every country page share this frame, so the map stays mounted (and keeps its
 * state) while the panel beside it changes. The URL's country segment selects the tile.
 *
 * From 1280px: two columns, the map sticky on the start side and the panel scrolling on the end
 * side (the columns swap in Arabic; the map itself never mirrors). Below: the map stays put at the
 * top and the panel is a sheet that scrolls up over it, with a 'Back to the map' pill once it
 * covers the map. TV mode has no map (a remote can't use it): the panel's country list is the
 * way in.
 */
export default function ArabCinemaShell({ map, children }: {
  /** The map (streamed: the layout doesn't wait for TMDB). */
  map: React.ReactNode
  children: React.ReactNode
}) {
  const t = useT()
  const tv = useTvMode()
  const segment = useSelectedLayoutSegment()

  const sheetRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<HTMLDivElement>(null)
  const [covered, setCovered] = useState(false)

  // Below 1280px: the sheet covers the map once it has slid over most of it.
  useEffect(() => {
    if (tv) return
    const wide = window.matchMedia('(min-width: 1280px)')
    let frame = 0
    const measure = () => {
      frame = 0
      const sheet = sheetRef.current
      const map = mapRef.current
      if (!sheet || !map || wide.matches) return setCovered(false)
      const mapBox = map.getBoundingClientRect()
      setCovered(sheet.getBoundingClientRect().top < mapBox.top + mapBox.height * 0.45)
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure) }
    measure()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    wide.addEventListener('change', schedule)
    return () => {
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      wide.removeEventListener('change', schedule)
      cancelAnimationFrame(frame)
    }
  }, [tv])

  // A new country, chosen on the map while the panel was scrolled down: start the panel at its top.
  const firstSegment = useRef(true)
  useEffect(() => {
    if (firstSegment.current) {
      firstSegment.current = false
      return
    }
    const sheet = sheetRef.current
    if (!sheet || !window.matchMedia('(min-width: 1280px)').matches) return
    if (sheet.getBoundingClientRect().top < 0) window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [segment])

  const backToMap = () => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
    const tile = mapRef.current?.querySelector<HTMLElement>('[data-country][tabindex="0"]')
    tile?.focus({ preventScroll: true })
  }

  if (tv) return <div className="pb-10">{children}</div>

  return (
    <div className="relative xl:grid xl:grid-cols-[minmax(0,1fr)_minmax(400px,36%)]">
      <div
        ref={mapRef}
        className="page-x page-top sticky top-0 z-0 pb-3 xl:flex xl:h-dvh xl:flex-col xl:justify-center xl:pb-8"
      >
        <div className="mx-auto w-full max-w-[760px] xl:max-w-[min(100%,calc((100dvh-var(--topbar)-170px)*1.8))]">
          {map}
        </div>
      </div>

      {/* The panel: a sheet below 1280px (clears the desktop rail on its own), a column from 1280px. */}
      <div className="rail-x relative z-10 min-w-0 xl:ms-0">
        <div
          ref={sheetRef}
          className={cn(
            '[--rail:0px] xl:[--gutter:28px] 2xl:[--gutter:36px]',
            'glass-strong min-h-[calc(100dvh-var(--topbar))] rounded-t-[28px] border-x-0 border-b-0 pb-10 shadow-[0_-24px_48px_-24px_rgb(0_0_0/0.9)]',
            'xl:min-h-dvh xl:rounded-none xl:border-y-0 xl:border-e-0 xl:border-s xl:border-white/[0.07] xl:bg-white/[0.02] xl:pt-[var(--topbar)] xl:shadow-none xl:backdrop-blur-none',
          )}
        >
          {/* The grabber: says "this slides" (decoration). */}
          <div aria-hidden className="flex justify-center pb-1 pt-2.5 xl:hidden">
            <span className="h-1 w-9 rounded-full bg-white/20" />
          </div>
          {children}
        </div>
      </div>

      <button
        type="button"
        onClick={backToMap}
        tabIndex={covered ? 0 : -1}
        aria-hidden={!covered}
        className={cn(
          'glass-strong fixed inset-x-0 top-[calc(var(--topbar)+env(safe-area-inset-top,0px)+8px)] z-40 mx-auto inline-flex h-11 w-max items-center gap-2 rounded-full px-4 text-[14px] font-medium text-white shadow-[0_12px_32px_-12px_rgb(0_0_0/0.9)] outline-none xl:hidden',
          'transition-[opacity,transform] duration-200 ease-out active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-red-500',
          covered ? 'opacity-100' : 'pointer-events-none -translate-y-2 opacity-0',
        )}
      >
        <MapIcon aria-hidden className="h-[18px] w-[18px]" />
        {t('arabMap.back')}
      </button>
    </div>
  )
}
