// TV mode is a mode, not a set of routes: the cookie tf-tv=1 (set by /?tv=1, cleared by /?tv=0 or
// POST /api/tv-mode, see src/middleware.ts) swaps the shell for the remote-friendly one on the same
// URLs. Also where the apps are published (the /app page reads these).
import { cookies } from 'next/headers'

export const TV_COOKIE = 'tf-tv'
/**
 * Set once TV mode has been switched on by itself (a Samsung / LG TV's browser opening the home
 * page, see src/middleware.ts) or switched off by the viewer: from then on it's the viewer's call,
 * and TV mode never comes back on by itself.
 */
export const TV_CHOSEN_COOKIE = 'tf-tv-chosen'

/** The TV cookie's settings (1 year, readable by the page so the TV settings can show the state). */
export const TV_COOKIE_OPTIONS = {
  path: '/',
  maxAge: 60 * 60 * 24 * 365,
  sameSite: 'lax' as const,
  httpOnly: false,
}

/** Whether this request is in TV mode (server components and route handlers). */
export function isTvMode(): boolean {
  try {
    return cookies().get(TV_COOKIE)?.value === '1'
  } catch {
    // Outside a request (build time, scripts): never TV mode.
    return false
  }
}
