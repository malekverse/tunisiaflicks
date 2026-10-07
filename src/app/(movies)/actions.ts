import { fetchList } from '@/src/lib/kids'
import type { MoviesState } from './types'

// Each row loads independently: if one TMDB call fails the others still render.
// Kids profiles get the same rows built from G/PG titles only (see lib/kids.ts).
export default async function getMovies(kids = false): Promise<MoviesState> {
  const [TrendingMovies, popularMovies, topRatedMovies, nowPlayingMovies, upcomingMovies] = await Promise.all([
    fetchList('movie', 'trending', kids, 'trending/movie/day'),
    fetchList('movie', 'popular', kids, 'movie/popular'),
    fetchList('movie', 'top_rated', kids, 'movie/top_rated'),
    fetchList('movie', 'now_playing', kids, 'movie/now_playing'),
    fetchList('movie', 'upcoming', kids, 'movie/upcoming'),
  ])

  return {
    TrendingMovies: TrendingMovies ?? undefined,
    popularMovies: popularMovies ?? undefined,
    topRatedMovies: topRatedMovies ?? undefined,
    nowPlayingMovies: nowPlayingMovies ?? undefined,
    upcomingMovies: upcomingMovies ?? undefined,
  }
}
