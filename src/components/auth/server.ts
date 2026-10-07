// Server-only data for the sign-in pages: the posters on the wall, and whether Google sign-in is on.
import { tmdbFetchSafe } from '@/src/lib/tmdb'

type Trending = { results?: { poster_path?: string | null, adult?: boolean }[] }

/** How many posters the wall shows (spread over its columns). */
const WALL_SIZE = 24

/** This week's trending posters (two pages, so every column gets its own). Empty if TMDB is down. */
export async function getWallPosters(): Promise<string[]> {
  const pages = await Promise.all([1, 2].map((page) => tmdbFetchSafe<Trending>('trending/all/week', { page }, 3600)))
  const seen = new Set<string>()
  for (const item of pages.flatMap((data) => data?.results ?? [])) {
    if (item.poster_path && !item.adult) seen.add(item.poster_path)
    if (seen.size === WALL_SIZE) break
  }
  return Array.from(seen)
}

/**
 * Same rule as `googleEnabled` in lib/auth (both Google env vars set). Read here so the pages know
 * on the server and the Google button never pops in after the form has rendered.
 */
export const googleSignInEnabled = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)

/** A same-site path to return to after signing in (next-auth hands back absolute URLs). */
export function safeCallbackUrl(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value
  if (!raw) return undefined
  let path = raw
  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw)
      const site = process.env.NEXTAUTH_URL ? new URL(process.env.NEXTAUTH_URL).host : null
      if (site && url.host !== site) return undefined
      path = `${url.pathname}${url.search}${url.hash}`
    } catch {
      return undefined
    }
  }
  // Same-site paths only, and never back to the sign-in pages themselves.
  if (!/^\/(?![/\\])/.test(path) || /^\/(login|signup|auth)(\/|\?|#|$)/.test(path)) return undefined
  return path
}
