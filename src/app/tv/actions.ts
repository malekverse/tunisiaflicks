import { tmdbFetchSafe } from '@/src/lib/tmdb';
import type { TVShowsState } from './types';

// Each row loads independently: if one TMDB call fails the others still render.
export default async function getTVShows(): Promise<Partial<TVShowsState>> {
  const [trendingTVShows, popularTVShows, topRatedTVShows, onTheAirTVShows, airingTodayTVShows] = await Promise.all([
    tmdbFetchSafe('trending/tv/day', { page: 1 }),
    tmdbFetchSafe('tv/popular', { page: 1 }),
    tmdbFetchSafe('tv/top_rated', { page: 1 }),
    tmdbFetchSafe('tv/on_the_air', { page: 1 }),
    tmdbFetchSafe('tv/airing_today', { page: 1 }),
  ]);

  return {
    trendingTVShows: trendingTVShows ?? undefined,
    popularTVShows: popularTVShows ?? undefined,
    topRatedTVShows: topRatedTVShows ?? undefined,
    onTheAirTVShows: onTheAirTVShows ?? undefined,
    airingTodayTVShows: airingTodayTVShows ?? undefined,
  };
}
