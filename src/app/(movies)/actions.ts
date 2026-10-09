import { fetchList } from '@/src/lib/kids'
import type { MoviesState } from './types'

// Each row loads independently: if one TMDB call fails the others still render.
// Kids profiles get the same rows built from G/PG titles only (see lib/kids.ts).
/** `language`: TMDB's language for the titles (catalogueLanguage in lib/tmdb-locale), English when left out. */
export default async function getMovies(kids = false, language?: string): Promise<MoviesState> {
  const [TrendingMovies, popularMovies, topRatedMovies, nowPlayingMovies, upcomingMovies] = await Promise.all([
    fetchList('movie', 'trending', kids, 'trending/movie/day', language),
    fetchList('movie', 'popular', kids, 'movie/popular', language),
    fetchList('movie', 'top_rated', kids, 'movie/top_rated', language),
    fetchList('movie', 'now_playing', kids, 'movie/now_playing', language),
    fetchList('movie', 'upcoming', kids, 'movie/upcoming', language),
  ])

  return {
    TrendingMovies: TrendingMovies ?? undefined,
    popularMovies: popularMovies ?? undefined,
    topRatedMovies: topRatedMovies ?? undefined,
    nowPlayingMovies: nowPlayingMovies ?? undefined,
    upcomingMovies: upcomingMovies ?? undefined,
  }
}
