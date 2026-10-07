'use server'

import { tmdbFetch } from '@/src/lib/tmdb'

export async function searchMovies(query: string, adult: boolean = false, page: number = 1) {
  const q = query.trim()
  if (!q) {
    return { results: [], total_pages: 0, total_results: 0, page: 1 }
  }

  // Short cache: results can be a little stale, but the same query shouldn't hit TMDB twice.
  // (No revalidatePath here: it forced a refresh of the current page on every keystroke.)
  return tmdbFetch('search/multi', { query: q, page, include_adult: adult }, 60)
}
