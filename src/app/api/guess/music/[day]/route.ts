import { NextResponse, type NextRequest } from 'next/server'
import { buildMusicPuzzle } from '@/src/lib/guess-music-server'
import { isGuessLanguage, isGuessPool, tunisDay } from '@/src/lib/guess'
import { isPlayableMusicDay } from '@/src/lib/guess-music'

export const dynamic = 'force-dynamic'
// Choosing a day's film the first time can take a few Deezer searches.
export const maxDuration = 30

/**
 * A day's puzzle of "Guess the film from its music": /api/guess/music/2026-11-23?pool=all&lang=en.
 * The same for everyone, and it never changes once chosen, so the CDN keeps it (one function call
 * per day, pool and language). Days to come don't exist yet.
 */
export async function GET(request: NextRequest, { params }: { params: { day: string } }) {
  const search = request.nextUrl.searchParams
  const pool = search.get('pool') ?? 'all'
  const lang = search.get('lang') ?? 'en'
  if (!isGuessPool(pool) || !isGuessLanguage(lang)) return NextResponse.json({ error: 'Invalid pool or language' }, { status: 400 })
  // A few minutes' grace at midnight, for a phone whose clock runs a little ahead.
  if (!isPlayableMusicDay(params.day, tunisDay(new Date(Date.now() + 5 * 60 * 1000)))) {
    return NextResponse.json({ error: 'No puzzle for that day' }, { status: 404, headers: { 'Cache-Control': 'no-store' } })
  }

  const puzzle = await buildMusicPuzzle(params.day, pool, lang).catch((error) => {
    console.error('Guess music puzzle:', error)
    return null
  })
  if (!puzzle) return NextResponse.json({ error: 'The puzzle is not ready, try again in a minute' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  return NextResponse.json(puzzle, {
    headers: { 'Cache-Control': 'public, max-age=600, s-maxage=31536000, stale-while-revalidate=86400' },
  })
}
