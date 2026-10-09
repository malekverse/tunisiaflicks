import { fetchList } from '@/src/lib/kids';
import type { TVShowsState } from './types';

// Each row loads independently: if one TMDB call fails the others still render.
// Kids profiles get the same rows built from kids' TV only (see lib/kids.ts).
/** `language`: TMDB's language for the titles (catalogueLanguage in lib/tmdb-locale), English when left out. */
export default async function getTVShows(kids = false, language?: string): Promise<Partial<TVShowsState>> {
  const [trendingTVShows, popularTVShows, topRatedTVShows, onTheAirTVShows, airingTodayTVShows] = await Promise.all([
    fetchList('tv', 'trending', kids, 'trending/tv/day', language),
    fetchList('tv', 'popular', kids, 'tv/popular', language),
    fetchList('tv', 'top_rated', kids, 'tv/top_rated', language),
    fetchList('tv', 'on_the_air', kids, 'tv/on_the_air', language),
    fetchList('tv', 'airing_today', kids, 'tv/airing_today', language),
  ]);

  return {
    trendingTVShows: trendingTVShows ?? undefined,
    popularTVShows: popularTVShows ?? undefined,
    topRatedTVShows: topRatedTVShows ?? undefined,
    onTheAirTVShows: onTheAirTVShows ?? undefined,
    airingTodayTVShows: airingTodayTVShows ?? undefined,
  };
}
