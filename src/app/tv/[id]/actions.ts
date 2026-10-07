"use server";

import { tmdbFetch } from '@/src/lib/tmdb'

// Called from the client when a season is picked in the TV detail page.
export async function getSeasonDetails(id: string, season: number | string) {
  return tmdbFetch(`tv/${encodeURIComponent(id)}/season/${encodeURIComponent(String(season))}`)
}
