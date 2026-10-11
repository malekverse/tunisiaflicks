// Movies for the local player's own browse page (player-service/public), so the TMDB key stays on
// the server: GET /api/player/browse → trending this week; ?q=<text> → search results.
// Answers { results: [{ id, title, year, poster, vote }] }. Public, cached at the edge, rate limited
// per IP for the requests the cache doesn't absorb.
import { NextResponse } from 'next/server'
import { tmdbFetch } from '@/src/lib/tmdb'
import { clientIp, rateLimit, tooManyRequests } from '@/src/lib/rate-limit'

export const dynamic = 'force-dynamic'

const HOUR = 3600

export async function GET(request: Request) {
  const q = (new URL(request.url).searchParams.get('q') ?? '').trim()
  if (q.length > 100) return NextResponse.json({ code: 'invalid_query' }, { status: 400, headers: { 'Cache-Control': 'no-store' } })

  const limit = await rateLimit(`player-browse:${clientIp(request.headers)}`, 120, 600)
  if (!limit.ok) return tooManyRequests(limit.retryAfter)

  const maxAge = q ? 24 * HOUR : HOUR
  try {
    const data = q
      ? await tmdbFetch<{ results?: any[] }>('search/movie', { query: q, include_adult: false }, maxAge)
      : await tmdbFetch<{ results?: any[] }>('trending/movie/week', {}, maxAge)
    const results = (data.results ?? []).map((movie) => ({
      id: movie.id,
      title: movie.title,
      year: String(movie.release_date || '').slice(0, 4),
      poster: movie.poster_path ?? null,
      vote: movie.vote_average ?? null,
    }))
    return NextResponse.json(
      { results },
      { headers: { 'Cache-Control': `public, max-age=${maxAge}, s-maxage=${maxAge}, stale-while-revalidate=${7 * 24 * HOUR}` } }
    )
  } catch (error) {
    console.error(error)
    return NextResponse.json({ code: 'tmdb_unavailable' }, { status: 502, headers: { 'Cache-Control': 'no-store' } })
  }
}
