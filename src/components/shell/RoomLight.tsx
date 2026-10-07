"use client"
import { useEffect, useRef, useState } from 'react'
import { useRoom } from '@/src/store/room'

// With nothing on screen to borrow from, the room keeps a faint red: the exit sign in the dark.
const DEFAULT_LIGHT = '255 36 20'

const glow = (color: string, strength: number) =>
  `radial-gradient(110% 62% at 50% -12%, rgb(${color} / ${0.34 * strength}), rgb(${color} / ${0.1 * strength}) 42%, transparent 72%)`

/**
 * The light in the room: a glow at the top of the viewport tinted by what the viewer is looking at.
 * Two stacked layers cross-fade (opacity only, so the compositor does the work) whenever the
 * colour changes.
 */
export default function RoomLight() {
  const base = useRoom((state) => state.base)
  const hover = useRoom((state) => state.hover)
  const color = hover ?? base ?? DEFAULT_LIGHT
  const strength = hover || base ? 1 : 0.45

  const [layers, setLayers] = useState<[{ color: string, strength: number }, { color: string, strength: number }]>(
    () => [{ color, strength }, { color, strength }]
  )
  const [front, setFront] = useState(0)
  const frontRef = useRef(0)

  useEffect(() => {
    const current = layers[frontRef.current]
    if (current.color === color && current.strength === strength) return
    const back = 1 - frontRef.current
    setLayers((previous) => {
      const next = [...previous] as typeof previous
      next[back] = { color, strength }
      return next
    })
    frontRef.current = back
    setFront(back)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [color, strength])

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-black">
      {layers.map((layer, index) => (
        <div
          key={index}
          className="absolute inset-0 transition-opacity [transition-duration:1100ms] ease-out"
          style={{ backgroundImage: glow(layer.color, layer.strength), opacity: index === front ? 1 : 0 }}
        />
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
