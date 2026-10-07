import { fetchList } from '@/src/lib/kids';
import type { TVShowsState } from './types';

// Each row loads independently: if one TMDB call fails the others still render.
// Kids profiles get the same rows built from kids' TV only (see lib/kids.ts).
export default async function getTVShows(kids = false): Promise<Partial<TVShowsState>> {
  const [trendingTVShows, popularTVShows, topRatedTVShows, onTheAirTVShows, airingTodayTVShows] = await Promise.all([
    fetchList('tv', 'trending', kids, 'trending/tv/day'),
    fetchList('tv', 'popular', kids, 'tv/popular'),
    fetchList('tv', 'top_rated', kids, 'tv/top_rated'),
    fetchList('tv', 'on_the_air', kids, 'tv/on_the_air'),
    fetchList('tv', 'airing_today', kids, 'tv/airing_today'),
  ]);

  return {
    trendingTVShows: trendingTVShows ?? undefined,
    popularTVShows: popularTVShows ?? undefined,
    topRatedTVShows: topRatedTVShows ?? undefined,
    onTheAirTVShows: onTheAirTVShows ?? undefined,
    airingTodayTVShows: airingTodayTVShows ?? undefined,
  };
}
