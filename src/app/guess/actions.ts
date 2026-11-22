'use server'

import { tmdbFetch } from '@/src/lib/tmdb'
import { filterKidSafe } from '@/src/lib/kids'
import { getKidsMode } from '@/src/lib/profiles'
import { getLocale } from '@/src/lib/i18n/server'
import { catalogueLanguage } from '@/src/lib/tmdb-locale'
import type { Candidate } from '@/src/lib/guess'

/**
 * Films matching what's typed in the guess box (films only: the puzzle is always a film). Kids
 * profiles only see kid-safe titles; Halal mode filters the answer in tmdbFetch. Films with hardly
 * any votes go last, so the one meant is near the top.
 */
export async function searchGuessFilms(query: string): Promise<Candidate[]> {
  const q = String(query ?? '').trim().slice(0, 80)
  if (q.length < 2) return []
  try {
    const data = await tmdbFetch<{ results?: any[] }>('search/movie', { query: q, include_adult: false, language: catalogueLanguage(getLocale()) }, 600)
    let results = (data.results ?? []).filter((film) => Number.isInteger(film?.id) && (film.title || film.original_title))
    if (await getKidsMode()) results = await filterKidSafe(results, 'movie')
    const known = (film: any) => (film.vote_count ?? 0) >= 25
    return [...results.filter(known), ...results.filter((film) => !known(film))].slice(0, 8).map((film) => ({
      id: film.id,
      title: String(film.title || film.original_title),
      year: typeof film.release_date === 'string' && /^\d{4}/.test(film.release_date) ? Number(film.release_date.slice(0, 4)) : null,
      genre_ids: Array.isArray(film.genre_ids) ? film.genre_ids.filter(Number.isInteger) : [],
      poster_path: film.poster_path ?? null,
    }))
  } catch {
    return []
  }
}
