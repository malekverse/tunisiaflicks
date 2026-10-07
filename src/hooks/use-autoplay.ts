"use client"
import { useEffect, useState } from 'react'

// Trailer autoplay (billboard, hover previews, detail page): on by default for mouse users, off on
// touch screens, with Data Saver, with reduced motion, and whenever the viewer switched it off in
// Settings. Mobile data costs real money; previews never start on a phone by themselves.
const KEY = 'tf-autoplay-previews'
const EVENT = 'tf-autoplay-change'

export function autoplayPreference(): boolean {
  try { return localStorage.getItem(KEY) !== 'off' } catch { return true }
}

export function setAutoplayPreference(on: boolean) {
  try { localStorage.setItem(KEY, on ? 'on' : 'off') } catch { /* private mode */ }
  window.dispatchEvent(new Event(EVENT))
}

export function canAutoplay(requireHover = true) {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  const connection = (navigator as any).connection
  return (!requireHover || window.matchMedia('(hover: hover) and (pointer: fine)').matches)
    && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    && !connection?.saveData
    && autoplayPreference()
}

/** Whether trailers may start on their own here (false during SSR and the first render). */
export function useCanAutoplay(requireHover = true) {
  const [allowed, setAllowed] = useState(false)
  useEffect(() => {
    const update = () => setAllowed(canAutoplay(requireHover))
    update()
    window.addEventListener(EVENT, update)
    return () => window.removeEventListener(EVENT, update)
  }, [requireHover])
  return allowed
}

/** The Settings switch. */
export function useAutoplayPreference() {
  const [on, setOn] = useState(true)
  useEffect(() => {
    const update = () => setOn(autoplayPreference())
    update()
    window.addEventListener(EVENT, update)
    return () => window.removeEventListener(EVENT, update)
  }, [])
  return [on, setAutoplayPreference] as const
}
