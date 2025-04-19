"server";

"use server";
import type { TVShowsState } from './types';

export default async function getTVShows(): Promise<TVShowsState> {
  const API_KEY = process.env.TMDB_API_KEY;
  if (!API_KEY) {
    throw new Error("TMDB_API_KEY is not set");
  }

  const endpoints = [
    'trending/tv/day',
    'tv/popular',
    'tv/top_rated',
    'tv/on_the_air',
    'tv/airing_today'
  ];

  try {
    const responses = await Promise.all(
      endpoints.map(endpoint =>
        fetch(
          `https://api.themoviedb.org/3/${endpoint}?api_key=${API_KEY}&language=en-US&page=1`,
          { next: { revalidate: 3600 } }
        )
      )
    );

    const data = await Promise.all(
      responses.map(async (res) => {
        if (!res.ok) {
          throw new Error(`Failed to fetch: ${res.statusText}`);
        }
        return res.json();
      })
    );

    return {
      trendingTVShows: data[0],
      popularTVShows: data[1],
      topRatedTVShows: data[2],
      onTheAirTVShows: data[3],
      airingTodayTVShows: data[4],
    };
  } catch (error) {
    console.error("Error fetching TV shows:", error);
    throw error;
  }
}