// "More like this, but…": GET /api/more-like-this?type=movie|tv&id=&but=<variation>&kids=0|1
//
// `kids` is what the page knew when it rendered. If the profile has changed since (another tab
// switched to a Kids profile, or back), the answer is 409 {code:'profile_changed'} and the page
// refreshes itself, rather than showing one profile's titles to another.
import { NextResponse } from 'next/server'
import { getKidsMode } from '@/src/lib/profiles'
import { getLocale } from '@/src/lib/i18n/server'
import { catalogueLanguage } from '@/src/lib/tmdb-locale'
import { clientIp, rateLimit, tooManyRequests } from '@/src/lib/rate-limit'
import { isVariation } from '@/src/lib/variations'
import { fetchVariation } from '@/src/lib/variations-tmdb'

export const dynamic = 'force-dynamic'

const bad = (code: string) => NextResponse.json({ code }, { status: 400, headers: { 'Cache-Control': 'no-store' } })

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const type = params.get('type')
  const id = params.get('id') ?? ''
  const but = params.get('but')
  const kidsParam = params.get('kids')
  if (type !== 'movie' && type !== 'tv') return bad('invalid_type')
  if (!/^[0-9]{1,9}$/.test(id)) return bad('invalid_id')
  if (!isVariation(but)) return bad('invalid_variation')
  if (kidsParam !== '0' && kidsParam !== '1') return bad('invalid_kids')

  const limit = await rateLimit(`more-like-this:${clientIp(request.headers)}`, 120, 600)
  if (!limit.ok) return tooManyRequests(limit.retryAfter)

  const kids = await getKidsMode()
  if (kids !== (kidsParam === '1')) {
    return NextResponse.json({ code: 'profile_changed' }, { status: 409, headers: { 'Cache-Control': 'no-store' } })
  }

  const items = await fetchVariation(type, String(Number(id)), but, { kids, language: catalogueLanguage(getLocale()) })
  if (items === null) {
    return NextResponse.json({ code: 'tmdb_unavailable' }, { status: 502, headers: { 'Cache-Control': 'no-store' } })
  }
  return NextResponse.json({ but, items }, { headers: { 'Cache-Control': 'private, max-age=3600' } })
}
