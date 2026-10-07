"use client"
import { useCallback, useEffect, useRef, useState } from 'react'
import { canAutoplay } from '@/src/hooks/use-autoplay'

const HOVER_DELAY_MS = 900

// One lookup per title per page load, shared by every card showing it.
const keyCache = new Map<string, Promise<string | null>>()

export function fetchTrailerKey(type: 'movie' | 'tv', id: string) {
  const cacheKey = `${type}-${id}`
  let pending = keyCache.get(cacheKey)
  if (!pending) {
    pending = fetch(`/api/trailer?type=${type}&id=${id}`)
      .then((response) => (response.ok ? response.json() : { key: null }))
      .then((data) => data.key ?? null)
      .catch(() => null)
    keyCache.set(cacheKey, pending)
  }
  return pending
}

/**
 * Muted trailer preview after hovering a card for a moment. Returns the YouTube key to show
 * (null when not hovering / no trailer) plus the mouse handlers to put on the card.
 */
export function useHoverTrailer(enabled: boolean, type: 'movie' | 'tv', id?: string) {
  const [trailerKey, setTrailerKey] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  const hovering = useRef(false)

  const onMouseEnter = useCallback(() => {
    if (!enabled || !id || !/^\d+$/.test(id) || !canAutoplay()) return
    hovering.current = true
    clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      const key = await fetchTrailerKey(type, id)
      if (hovering.current && key) setTrailerKey(key)
    }, HOVER_DELAY_MS)
  }, [enabled, id, type])

  const onMouseLeave = useCallback(() => {
    hovering.current = false
    clearTimeout(timer.current)
    setTrailerKey(null)
  }, [])

  useEffect(() => () => clearTimeout(timer.current), [])

  return { trailerKey, onMouseEnter, onMouseLeave }
}
