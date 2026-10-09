// "Where have I seen them?": GET /api/seen-with?people=<ids, up to 30>&exclude=movie:603
//   → {people: {[personId]: SeenTitle[]}}
// The signed-in profile's own history only (Kids profiles too); never cached anywhere.
import { NextResponse } from 'next/server'
import { requireActiveProfile } from '@/src/lib/profiles'
import { rateLimit, tooManyRequests } from '@/src/lib/rate-limit'
import { parseExclude, parsePeople, seenWith, watchedTitles } from '@/src/lib/seen-with'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const NO_STORE = { 'Cache-Control': 'private, no-store' }

export async function GET(request: Request) {
  const owner = await requireActiveProfile()
  if ('error' in owner) {
    owner.error.headers.set('Cache-Control', 'private, no-store')
    return owner.error
  }
  const params = new URL(request.url).searchParams
  const people = parsePeople(params.get('people'))
  if (!people) return NextResponse.json({ code: 'invalid_people' }, { status: 400, headers: NO_STORE })
  const exclude = parseExclude(params.get('exclude'))

  const limit = await rateLimit(`seen-with:${owner.userId}:${owner.profile.id}`, 60, 600)
  if (!limit.ok) return tooManyRequests(limit.retryAfter)

  try {
    const watched = await watchedTitles(owner.userId, owner.profile.id)
    return NextResponse.json({ people: await seenWith(people, watched, exclude) }, { headers: NO_STORE })
  } catch (error) {
    console.error('seen-with:', error)
    return NextResponse.json({ code: 'unavailable' }, { status: 503, headers: NO_STORE })
  }
}
