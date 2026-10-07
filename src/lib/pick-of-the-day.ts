// "Pick of the day": one well-loved movie or show, the same for everyone on a given (Tunis) day.
// Chosen deterministically from the date, so no storage or cron is needed and every server agrees.
import { tmdbFetchSafe, tmdbLanguage } from '@/src/lib/tmdb'
import { kidsDiscoverParams } from '@/src/lib/kids'
import type { Locale } from '@/src/lib/i18n'

export type PickOfTheDay = {
  kind: 'movie' | 'tv'
  date: string
  data: any
}

/** Today's date in Tunisia (YYYY-MM-DD). */
export const tunisToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Tunis' }).format(new Date())

// FNV-1a: a small, stable string hash.
function hash(value: string) {
  let result = 0x811c9dc5
  for (let i = 0; i < value.length; i++) {
    result ^= value.charCodeAt(i)
    result = Math.imul(result, 0x01000193)
  }
  return result >>> 0
}

export async function getPickOfTheDay(kids: boolean, locale: Locale, date = tunisToday()): Promise<PickOfTheDay | null> {
  const seed = hash(`${date}${kids ? ':kids' : ''}`)
  // Two days in three a movie, otherwise a show.
  const kind: 'movie' | 'tv' = seed % 3 === 2 ? 'tv' : 'movie'
  const base = {
    sort_by: 'vote_average.desc',
    'vote_count.gte': kind === 'movie' ? 1500 : 500,
    // Talk shows, news, reality and soaps make poor picks.
    without_genres: kind === 'tv' ? '10763,10764,10767,10766' : undefined,
    page: (seed % (kids ? 3 : 10)) + 1,
  }
  const params = kids ? kidsDiscoverParams(kind, { ...base, 'vote_count.gte': 200 }) : base
  const list = await tmdbFetchSafe<{ results: any[] }>(`discover/${kind}`, params, 86400)
  const candidates = (list?.results ?? []).filter((item) => item.backdrop_path && item.overview)
  if (candidates.length === 0) return null

  const pick = candidates[(seed >>> 8) % candidates.length]
  const data = await tmdbFetchSafe(`${kind}/${pick.id}`, {
    language: tmdbLanguage(locale),
    append_to_response: 'images',
    include_image_language: 'en,null',
  }, 86400)
  // Not every title has an Arabic overview: fall back to the English one.
  return data ? { kind, date, data: { ...data, overview: data.overview || pick.overview } } : null
}
