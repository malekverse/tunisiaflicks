import { NextResponse, type NextRequest } from 'next/server'
import { tmdbFetchSafe } from '@/src/lib/tmdb'
import { kidsDiscoverParams } from '@/src/lib/kids'
import { getKidsMode } from '@/src/lib/profiles'

// "Surprise me": redirect to a random, well-rated, well-known title. Each call picks a random page
// of a quality-filtered TMDB discover list (pages are cached for a day), then a random item on it.
export const dynamic = 'force-dynamic'

const MAX_PAGE = 25 // ~500 titles per type: the well-known, well-rated ones
const KIDS_MAX_PAGE = 5

const pick = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)]

export async function GET(request: NextRequest) {
  const requested = request.nextUrl.searchParams.get('type')
  const type = requested === 'movie' || requested === 'tv' ? requested : Math.random() < 0.6 ? 'movie' : 'tv'

  // Kids profiles: G/PG movies and kids' TV, a smaller pool so the bar is lower.
  const kids = await getKidsMode()
  const params = {
    sort_by: 'vote_count.desc',
    'vote_average.gte': kids ? 6.5 : 7,
    'vote_count.gte': kids ? 200 : type === 'movie' ? 1500 : 500,
    include_adult: false,
  }

  // A couple of attempts in case a page comes back empty or TMDB hiccups.
  for (let attempt = 0; attempt < 3; attempt++) {
    const page = 1 + Math.floor(Math.random() * (kids ? KIDS_MAX_PAGE : MAX_PAGE))
    const data = await tmdbFetchSafe<{ results: any[] }>(`discover/${type}`, {
      ...(kids ? kidsDiscoverParams(type, params) : params),
      page,
    }, 86400)
    const candidates = (data?.results ?? []).filter((item) => item.poster_path)
    if (candidates.length > 0) {
      const choice = pick(candidates)
      return NextResponse.redirect(new URL(`/${type}/${choice.id}`, request.url), 307)
    }
  }

  // TMDB unavailable: land somewhere useful instead of an error page.
  return NextResponse.redirect(new URL('/discover', request.url), 307)
}
