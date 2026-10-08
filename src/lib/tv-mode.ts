// TV mode is a mode, not a set of routes: the cookie tf-tv=1 (set by /?tv=1, cleared by /?tv=0, see
// src/middleware.ts) swaps the shell for the remote-friendly one on the same URLs.
import { cookies } from 'next/headers'

export const TV_COOKIE = 'tf-tv'

/** Whether this request is in TV mode (server components and route handlers). */
export function isTvMode(): boolean {
  try {
    return cookies().get(TV_COOKIE)?.value === '1'
  } catch {
    // Outside a request (build time, scripts): never TV mode.
    return false
  }
}
