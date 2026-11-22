import { NextResponse, type NextRequest } from 'next/server'
import { buildPuzzle } from '@/src/lib/guess-server'
import { isGuessLanguage, isGuessPool, isPlayableDay, tunisDay } from '@/src/lib/guess'

export const dynamic = 'force-dynamic'

/**
 * A day's puzzle of "Guess the film": /api/guess/2026-11-22?pool=all&lang=en. The same for
 * everyone, and it never changes once chosen, so the CDN keeps it (one function call per day,
 * pool and language). Days to come don't exist yet.
 */
export async function GET(request: NextRequest, { params }: { params: { day: string } }) {
  const search = request.nextUrl.searchParams
  const pool = search.get('pool') ?? 'all'
  const lang = search.get('lang') ?? 'en'
  if (!isGuessPool(pool) || !isGuessLanguage(lang)) return NextResponse.json({ error: 'Invalid pool or language' }, { status: 400 })
  // A few minutes' grace at midnight, for a phone whose clock runs a little ahead.
  if (!isPlayableDay(params.day, tunisDay(new Date(Date.now() + 5 * 60 * 1000)))) {
    return NextResponse.json({ error: 'No puzzle for that day' }, { status: 404, headers: { 'Cache-Control': 'no-store' } })
  }

  const puzzle = await buildPuzzle(params.day, pool, lang).catch((error) => {
    console.error('Guess puzzle:', error)
    return null
  })
  if (!puzzle) return NextResponse.json({ error: 'The puzzle is not ready, try again in a minute' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  return NextResponse.json(puzzle, {
    headers: { 'Cache-Control': 'public, max-age=600, s-maxage=31536000, stale-while-revalidate=86400' },
  })
}
