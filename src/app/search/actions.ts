'use server'

import { tmdbFetch } from '@/src/lib/tmdb'
import { filterKidSafe } from '@/src/lib/kids'
import { getKidsMode } from '@/src/lib/profiles'

export async function searchMovies(query: string, adult: boolean = false, page: number = 1) {
  const q = query.trim()
  if (!q) {
    return { results: [], total_pages: 0, total_results: 0, page: 1 }
  }

  // Short cache: results can be a little stale, but the same query shouldn't hit TMDB twice.
  // (No revalidatePath here: it forced a refresh of the current page on every keystroke.)
  // Kids profiles: search can't be filtered by rating at TMDB, so each hit is checked (lib/kids.ts).
  if (await getKidsMode()) {
    const data = await tmdbFetch('search/multi', { query: q, page, include_adult: false }, 60)
    return { ...data, results: await filterKidSafe(data.results ?? []) }
  }
  return tmdbFetch('search/multi', { query: q, page, include_adult: adult }, 60)
}

export type TrendingSuggestion = { id: number, media_type: 'movie' | 'tv', title: string, year: string, poster_path: string | null, backdrop_path: string | null }

/** What the search palette suggests before anything is typed: today's trending titles. */
export async function getTrendingSuggestions(): Promise<TrendingSuggestion[]> {
  const kids = await getKidsMode()
  try {
    const data = await tmdbFetch('trending/all/day', {}, 3600)
    let results: any[] = (data.results ?? []).filter((item: any) => item.media_type === 'movie' || item.media_type === 'tv')
    if (kids) results = await filterKidSafe(results)
    return results.slice(0, 8).map((item) => ({
      id: item.id,
      media_type: item.media_type,
      title: item.title || item.name,
      year: (item.release_date || item.first_air_date || '').slice(0, 4),
      poster_path: item.poster_path ?? null,
      backdrop_path: item.backdrop_path ?? null,
    }))
  } catch {
    return []
  }
}
