"use client"
import { useEffect, useRef, useState } from 'react'
import { useRoom } from '@/src/store/room'
import { cn } from '@/src/lib/utils'

// With nothing on screen to borrow from, the room keeps the season's light: lantern gold through
// Ramadan and the Eids, champagne at New Year, the flag's red (dimmed) on the national days. The
// root layout sets it on <html> (data-season, --season-light and --season-glow, from
// getSeasonSkin in src/lib/seasons.ts), so the very first paint already has it. Out of season, a
// faint red: the exit sign in the dark.
const DEFAULT_LIGHT = 'var(--season-glow, var(--season-light, 255 36 20))'

const glow = (color: string) =>
  `radial-gradient(110% 62% at 50% -12%, rgb(${color} / 0.34), rgb(${color} / 0.1) 42%, transparent 72%)`

/** `fallback`: the default light, dimmed by CSS (more softly in season). */
type Layer = { color: string, fallback: boolean }

/**
 * The light in the room: a glow at the top of the viewport tinted by what the viewer is looking at.
 * Two stacked layers cross-fade (opacity only, so the compositor does the work) whenever the
 * colour changes. Pages with a picture keep their picture's light; the season only lights the
 * room when nothing else does, a little brighter than the exit sign (CSS decides, from
 * data-season, so server and browser agree).
 */
export default function RoomLight() {
  const base = useRoom((state) => state.base)
  const hover = useRoom((state) => state.hover)
  const lit = hover ?? base
  const color = lit ?? DEFAULT_LIGHT
  const fallback = !lit

  const [layers, setLayers] = useState<[Layer, Layer]>(() => [{ color, fallback }, { color, fallback }])
  const [front, setFront] = useState(0)
  const frontRef = useRef(0)

  useEffect(() => {
    const current = layers[frontRef.current]
    if (current.color === color && current.fallback === fallback) return
    const back = 1 - frontRef.current
    setLayers((previous) => {
      const next = [...previous] as typeof previous
      next[back] = { color, fallback }
      return next
    })
    frontRef.current = back
    setFront(back)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [color, fallback])

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-black">
      {layers.map((layer, index) => (
        <div
          key={index}
          className="absolute inset-0 transition-opacity [transition-duration:1100ms] ease-out"
          style={{ opacity: index === front ? 1 : 0 }}
        >
          <div
            className={cn('absolute inset-0', layer.fallback && 'opacity-[0.45] [[data-season]_&]:opacity-[0.65]')}
            style={{ backgroundImage: glow(layer.color) }}
          />
        </div>
      ))}
    </div>
  )
}

/**
 * Lights the room in `color` while the calling component is on screen. `enabled: false` leaves the
 * light alone (e.g. a layout that is hidden at this screen size).
 */
export function useRoomLight(color: string | null | undefined, enabled = true) {
  const setBase = useRoom((state) => state.setBase)
  useEffect(() => {
    if (enabled) setBase(color ?? null)
  }, [color, enabled, setBase])
  useEffect(() => {
    if (!enabled) return
    return () => setBase(null)
  }, [enabled, setBase])
}
