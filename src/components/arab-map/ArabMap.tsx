"use client"
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useRouter, useSelectedLayoutSegment } from 'next/navigation'
import { m } from 'framer-motion'
import { useT } from '@/src/components/I18nProvider'
import { useMediaQuery } from '@/src/hooks/use-media-query'
import { loadAmbientColor } from '@/src/hooks/use-ambient-color'
import { useRoom } from '@/src/store/room'
import { arabCountryHref, isArabCountry, type ArabCountryCode } from '@/src/lib/arab-countries'
import { FIRST_TILE, LAST_TILE, MAP_ACCENT, MAP_ORIGIN, cellOf, step, typeahead, type Direction } from '@/src/lib/arab-map'
import { haptic, spring } from '@/src/lib/motion'
import MapTile from './MapTile'
import MapPreview, { type PreviewPlace } from './MapPreview'
import MapReadout from './MapReadout'
import type { MapCountry } from '@/src/lib/arab-cinema'

// The entrance ripple plays once per visit, not on every return to the map.
let rippled = false

const ARROWS: Record<string, Direction> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' }

/** Hover preview: rest this long on a tile before the card opens (and the room takes its light). */
const DWELL = 120
/** After a card closes, another opens at once for this long (moving from tile to tile). */
const WARM = 400
/** A finger has to slide this far sideways before it scrubs (otherwise it's a tap or a scroll). */
const SCRUB_SLOP = 8
/** Typeahead: letters typed within this long of each other make one word. */
const TYPEAHEAD_PAUSE = 700

const CARD_WIDTH = 248

/**
 * The Arab world as 22 tiles. A link per country (one tab stop, arrow keys move between
 * neighbours on the map, Home and End, and typing a name), a hover card with the film of the day
 * on a mouse, and on a touch screen a sideways slide that previews countries in the readout
 * without ever opening one. Laid out left to right in every language: maps don't mirror.
 */
export default function ArabMap({ countries, kids }: { countries: MapCountry[], kids: boolean }) {
  const t = useT()
  const router = useRouter()
  // Rendered by the /arab-cinema layout: its selected segment is the open country.
  const segment = useSelectedLayoutSegment()
  const selected: ArabCountryCode | null = segment && isArabCountry(segment) ? segment : null
  const helpId = useId()
  const coarse = useMediaQuery('(hover: none)')
  const setHover = useRoom((state) => state.setHover)

  const byCode = useMemo(() => new Map(countries.map((country) => [country.code, country])), [countries])
  const entries = useMemo(() => countries.map((country) => ({ code: country.code, names: [country.name, country.en] })), [countries])
  const dimmed = useCallback((country: MapCountry | null | undefined) => !!country && kids && country.films !== null && country.n === 0, [kids])

  const [ripple] = useState(() => !rippled)
  useEffect(() => { rippled = true }, [])

  // The keyboard's one tab stop: the open country, else Tunisia.
  const [current, setCurrent] = useState<ArabCountryCode>(selected ?? MAP_ORIGIN)
  useEffect(() => { if (selected) setCurrent(selected) }, [selected])

  // What the readout shows: a country slid over or reached with the keyboard.
  const [preview, setPreview] = useState<ArabCountryCode | null>(null)
  useEffect(() => { setPreview(null) }, [selected])

  const mapRef = useRef<HTMLDivElement>(null)
  const tiles = useRef(new Map<ArabCountryCode, HTMLAnchorElement>())
  const tileRef = (code: ArabCountryCode) => (node: HTMLAnchorElement | null) => {
    if (node) tiles.current.set(code, node)
    else tiles.current.delete(code)
  }

  // Prefetch a country's panel as soon as the pointer or the focus says it's next.
  const prefetched = useRef(new Set<string>())
  const prefetch = useCallback((href: string) => {
    if (prefetched.current.has(href)) return
    prefetched.current.add(href)
    router.prefetch(href)
  }, [router])

  // ----- Hover card (mouse) -------------------------------------------------------------------
  const [card, setCard] = useState<{ code: ArabCountryCode, place: PreviewPlace, open: boolean, instant: boolean } | null>(null)
  const openTimer = useRef<number>()
  const closedAt = useRef(0)
  const hovered = useRef<ArabCountryCode | null>(null)

  const placeFor = (code: ArabCountryCode): PreviewPlace | null => {
    const map = mapRef.current
    const tile = tiles.current.get(code)
    if (!map || !tile) return null
    const width = map.clientWidth
    const left = Math.min(Math.max(tile.offsetLeft + tile.offsetWidth / 2 - CARD_WIDTH / 2, -4), width - CARD_WIDTH + 4)
    const below = cellOf(code).y <= 1
    return below
      ? { left, top: tile.offsetTop + tile.offsetHeight + 8, below }
      : { left, bottom: map.clientHeight - tile.offsetTop + 8, below }
  }

  const showCard = (code: ArabCountryCode, instant: boolean) => {
    const place = placeFor(code)
    if (!place) return
    setCard({ code, place, open: true, instant })
    const poster = byCode.get(code)?.pick?.poster
    if (poster) {
      loadAmbientColor(poster).then((color) => { if (hovered.current === code && color) setHover(color) })
    }
  }

  const onTileEnter = (code: ArabCountryCode) => (event: React.PointerEvent) => {
    prefetch(arabCountryHref(code))
    if (event.pointerType !== 'mouse') return
    hovered.current = code
    window.clearTimeout(openTimer.current)
    const warm = (card?.open ?? false) || performance.now() - closedAt.current < WARM
    if (warm) showCard(code, true)
    else openTimer.current = window.setTimeout(() => showCard(code, false), DWELL)
  }

  const onTileLeave = (code: ArabCountryCode) => (event: React.PointerEvent) => {
    if (event.pointerType !== 'mouse') return
    window.clearTimeout(openTimer.current)
    if (hovered.current === code) hovered.current = null
    setCard((previous) => {
      if (!previous?.open) return previous
      closedAt.current = performance.now()
      return { ...previous, open: false, instant: false }
    })
  }

  const onMapLeave = (event: React.PointerEvent) => {
    if (event.pointerType === 'mouse') setHover(null)
  }

  useEffect(() => () => {
    window.clearTimeout(openTimer.current)
    setHover(null)
  }, [setHover])

  // ----- Scrub (touch) ------------------------------------------------------------------------
  const drag = useRef<{ id: number, x: number, y: number, scrubbing: boolean, code: ArabCountryCode | null } | null>(null)
  const swallowClick = useRef(false)
  const swallowTimer = useRef<number>()
  useEffect(() => () => window.clearTimeout(swallowTimer.current), [])

  const tileAt = (x: number, y: number): ArabCountryCode | null => {
    const element = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-country]')
    const code = element?.dataset.country
    return code && byCode.has(code as ArabCountryCode) ? (code as ArabCountryCode) : null
  }

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    // A new touch: whatever a slide left behind no longer applies (a tap right after it opens).
    swallowClick.current = false
    if (event.pointerType === 'mouse' || drag.current) return
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, scrubbing: false, code: null }
  }

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    // A touch or a pen only moves while it is down: start from here if the down was missed.
    if (!drag.current && (event.pointerType === 'touch' || (event.pointerType === 'pen' && event.buttons > 0))) onPointerDown(event)
    const state = drag.current
    if (!state || state.id !== event.pointerId) return
    if (!state.scrubbing) {
      const dx = event.clientX - state.x
      const dy = event.clientY - state.y
      if (Math.abs(dx) <= SCRUB_SLOP || Math.abs(dx) <= Math.abs(dy)) return
      state.scrubbing = true
      try { mapRef.current?.setPointerCapture(event.pointerId) } catch { /* the pointer is gone */ }
    }
    const code = tileAt(event.clientX, event.clientY)
    if (code && code !== state.code) {
      state.code = code
      setPreview(code)
      prefetch(arabCountryHref(code))
      haptic(6)
    }
  }

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const state = drag.current
    if (!state || state.id !== event.pointerId) return
    drag.current = null
    if (!state.scrubbing) return
    // Lifting the finger after a slide never opens anything: the click that may follow is eaten,
    // even when a busy phone delivers it late. The next touch or key clears the flag at once, and
    // it lapses on its own after a while (a screen reader's click comes without a touch).
    swallowClick.current = true
    window.clearTimeout(swallowTimer.current)
    swallowTimer.current = window.setTimeout(() => { swallowClick.current = false }, 600)
  }

  const onClickCapture = (event: React.MouseEvent) => {
    if (!swallowClick.current) return
    swallowClick.current = false
    event.preventDefault()
    event.stopPropagation()
  }

  // ----- Keyboard -----------------------------------------------------------------------------
  const typed = useRef({ text: '', at: 0 })

  const focusTile = (code: ArabCountryCode) => {
    setCurrent(code)
    tiles.current.get(code)?.focus()
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    swallowClick.current = false
    const from = ((event.target as HTMLElement).closest<HTMLElement>('[data-country]')?.dataset.country ?? current) as ArabCountryCode
    const now = performance.now()
    // Typing a name ('United Arab Emirates', 'المملكة العربية'): a space inside it is part of it.
    const typing = typed.current.text !== '' && now - typed.current.at <= TYPEAHEAD_PAUSE
    const direction = ARROWS[event.key]
    if (direction) {
      event.preventDefault()
      const next = step(from, direction)
      if (next) focusTile(next)
      return
    }
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      focusTile(event.key === 'Home' ? FIRST_TILE : LAST_TILE)
      return
    }
    if (event.key === ' ' && !typing) {
      // A link opens with Enter; Space opens it too here (it would scroll the page otherwise).
      event.preventDefault()
      tiles.current.get(from)?.click()
      return
    }
    if (event.key === 'Escape') {
      setPreview(null)
      return
    }
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const text = typing ? typed.current.text + event.key : event.key
      typed.current = { text, at: now }
      // A space waits for the next word (it would scroll the page otherwise).
      if (event.key === ' ') return event.preventDefault()
      const found = typeahead(text, entries, from)
      if (found) {
        event.preventDefault()
        focusTile(found)
      }
    }
  }

  const onTileFocus = (code: ArabCountryCode) => () => {
    setCurrent(code)
    prefetch(arabCountryHref(code))
    // The readout follows the keyboard (a click focuses too, and then opens the country anyway).
    if (code !== selected) setPreview(code)
  }

  const onMapBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null) && !drag.current) setPreview(null)
  }

  // At rest the readout gives the hint (the open country is the panel's title already).
  const shown = preview ? byCode.get(preview) ?? null : null
  const cardCountry = card ? byCode.get(card.code) ?? null : null
  const selectedCell = selected ? cellOf(selected) : null

  return (
    <div className="w-full">
      <div
        ref={mapRef}
        role="group"
        aria-label={t('arabMap.mapLabel')}
        aria-describedby={helpId}
        dir="ltr"
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={onMapLeave}
        onClickCapture={onClickCapture}
        onBlur={onMapBlur}
        className="relative grid grid-cols-9 gap-1 [touch-action:pan-y] sm:gap-1.5 xl:gap-2"
        style={{ '--map-accent': MAP_ACCENT } as React.CSSProperties}
      >
        {countries.map((country) => (
          <MapTile
            key={country.code}
            ref={tileRef(country.code)}
            country={country}
            state={{ selected: country.code === selected, current: country.code === current, dim: dimmed(country), ripple, previewed: country.code === preview && country.code !== selected }}
            onPointerEnter={onTileEnter(country.code)}
            onPointerLeave={onTileLeave(country.code)}
            onPointerDown={() => prefetch(arabCountryHref(country.code))}
            onFocus={onTileFocus(country.code)}
          />
        ))}
        {/* The open country's red ring: one element that glides from tile to tile. */}
        {selectedCell && (
          <m.span
            layoutId="arab-map-selected"
            transition={spring.ui}
            aria-hidden
            className="pointer-events-none relative z-10 aspect-square rounded-[10px] ring-2 ring-inset ring-red-500 shadow-[0_0_24px_-4px_rgb(255_36_20/0.55),inset_0_0_16px_rgb(255_36_20/0.3)]"
            style={{ gridColumnStart: selectedCell.x + 1, gridRowStart: selectedCell.y + 1 }}
          />
        )}
        <MapPreview
          country={cardCountry}
          dim={dimmed(cardCountry)}
          place={card?.place ?? null}
          open={!!card?.open}
          instant={!!card?.instant}
        />
      </div>
      <p id={helpId} className="sr-only">{t('arabMap.mapHelp')}</p>
      <div className="mt-3 sm:mt-4">
        <MapReadout country={shown} selected={!!shown && shown.code === selected} dim={dimmed(shown)} coarse={coarse} onPrefetch={prefetch} />
      </div>
    </div>
  )
}
