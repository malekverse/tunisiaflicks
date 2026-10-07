"use client"
import { useEffect, useState } from 'react'

/**
 * Scroll state for the floating chrome: `scrolled` once the page has moved off the top, and
 * `retracted` while the viewer is scrolling *down* past `threshold` (bars tuck away, and come
 * back on the first scroll up). One passive listener, at most one update per frame.
 */
export function useScrollChrome(threshold = 72) {
  const [state, setState] = useState({ scrolled: false, retracted: false })

  useEffect(() => {
    let last = window.scrollY
    let frame = 0
    const update = () => {
      frame = 0
      const y = window.scrollY
      const delta = y - last
      // Ignore tiny jitters (momentum scrolling, address bar resizes).
      if (Math.abs(delta) < 6 && y > 8) return
      last = y
      setState((current) => {
        const scrolled = y > 8
        const retracted = y > threshold && delta > 0
        return current.scrolled === scrolled && current.retracted === retracted ? current : { scrolled, retracted }
      })
    }
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update) }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(frame)
    }
  }, [threshold])

  return state
}
