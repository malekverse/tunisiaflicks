import { NextResponse, type NextRequest } from 'next/server'
import { buildActorPuzzle } from '@/src/lib/guess-actor-server'
import { isGuessLanguage, isGuessPool, tunisDay } from '@/src/lib/guess'
import { isPlayableActorDay } from '@/src/lib/guess-actor'

export const dynamic = 'force-dynamic'
// Choosing a day's actor the first time can take a few TMDB lookups.
export const maxDuration = 30

/**
 * A day's puzzle of "Guess the actor": /api/guess/actor/2026-11-24?pool=all&lang=en.
 * The same for everyone, and it never changes once chosen, so the CDN keeps it (one function call
 * per day, pool and language). Days to come don't exist yet.
 */
export async function GET(request: NextRequest, { params }: { params: { day: string } }) {
  const search = request.nextUrl.searchParams
  const pool = search.get('pool') ?? 'all'
  const lang = search.get('lang') ?? 'en'
  if (!isGuessPool(pool) || !isGuessLanguage(lang)) return NextResponse.json({ error: 'Invalid pool or language' }, { status: 400 })
  // A few minutes' grace at midnight, for a phone whose clock runs a little ahead.
  if (!isPlayableActorDay(params.day, tunisDay(new Date(Date.now() + 5 * 60 * 1000)))) {
    return NextResponse.json({ error: 'No puzzle for that day' }, { status: 404, headers: { 'Cache-Control': 'no-store' } })
  }

  const puzzle = await buildActorPuzzle(params.day, pool, lang).catch((error) => {
    console.error('Guess actor puzzle:', error)
    return null
  })
  if (!puzzle) return NextResponse.json({ error: 'The puzzle is not ready, try again in a minute' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  return NextResponse.json(puzzle, {
    headers: { 'Cache-Control': 'public, max-age=600, s-maxage=31536000, stale-while-revalidate=86400' },
  })
}
