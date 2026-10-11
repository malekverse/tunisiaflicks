// GET /api/app/v1/home?lang=&kids= → { billboard, rows } (see lib/app-api/home).
import { getHome } from '@/src/lib/app-api/home'
import { HOUR, readQuery } from '@/src/lib/app-api/shared'
import { cached, limited } from '@/src/lib/app-api/respond'

export const dynamic = 'force-dynamic'
export const maxDuration = 20

export async function GET(request: Request) {
  const blocked = await limited(request, 'home')
  if (blocked) return blocked
  const { locale, kids } = readQuery(new URL(request.url))
  const home = await getHome(locale, kids)
  // A short life when the home came back thin (TMDB had a bad moment): it fills in on the next call.
  return cached(home, home.rows.length >= 4 ? HOUR : 120)
}
