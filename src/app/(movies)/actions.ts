import { tmdbFetchSafe } from '@/src/lib/tmdb'
import type { MoviesState } from './types'

// Each row loads independently: if one TMDB call fails the others still render.
export default async function getMovies(): Promise<MoviesState> {
  const [TrendingMovies, popularMovies, topRatedMovies, nowPlayingMovies, upcomingMovies] = await Promise.all([
    tmdbFetchSafe('trending/movie/day', { page: 1 }),
    tmdbFetchSafe('movie/popular', { page: 1 }),
    tmdbFetchSafe('movie/top_rated', { page: 1 }),
    tmdbFetchSafe('movie/now_playing', { page: 1 }),
    tmdbFetchSafe('movie/upcoming', { page: 1 }),
  ])

  return {
    TrendingMovies: TrendingMovies ?? undefined,
    popularMovies: popularMovies ?? undefined,
    topRatedMovies: topRatedMovies ?? undefined,
    nowPlayingMovies: nowPlayingMovies ?? undefined,
    upcomingMovies: upcomingMovies ?? undefined,
  }
}
