// Shared motion tokens, so every animation in the app speaks the same language.
// Springs are described the Apple way (bounce + duration) and stay critically damped by default:
// only things the user flicked or dragged get to overshoot.
import type { Transition } from 'framer-motion'

/** Strong ease-out: instant response, soft landing. For things appearing and UI reacting. */
export const EASE_OUT = [0.23, 1, 0.32, 1] as const
/** For things moving across the screen. */
export const EASE_IN_OUT = [0.77, 0, 0.175, 1] as const
/** iOS sheet curve. */
export const EASE_SHEET = [0.32, 0.72, 0, 1] as const

export const spring = {
  /** Default UI spring: no overshoot. Indicators, layout changes, cards. */
  ui: { type: 'spring', bounce: 0, duration: 0.35 } as Transition,
  /** Snappy: small controls, toggles. */
  snappy: { type: 'spring', bounce: 0, duration: 0.25 } as Transition,
  /** After a flick or a drag release: a little life. */
  momentum: { type: 'spring', bounce: 0.2, duration: 0.45 } as Transition,
  /** Celebrations (like, add to list): a visible pop. */
  pop: { type: 'spring', bounce: 0.45, duration: 0.5 } as Transition,
}

export const tween = {
  fast: { duration: 0.16, ease: EASE_OUT } as Transition,
  base: { duration: 0.24, ease: EASE_OUT } as Transition,
  slow: { duration: 0.42, ease: EASE_OUT } as Transition,
}

/** A short vibration on Android for meaningful moments (like, add to list, snap). No-op elsewhere. */
export function haptic(ms = 10) {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(ms)
  } catch {
    // Some browsers throw outside a user gesture; feedback is optional.
  }
}
