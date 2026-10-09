// The film playing in the picture of the desktop app (/desktop, the spotlight on /app): this week's
// most popular film with a backdrop, in the viewer's language, Kids-safe for a Kids profile.
import { tmdbFetchSafe } from '@/src/lib/tmdb'
import { catalogueLanguage } from '@/src/lib/tmdb-locale'
import { getLocale } from '@/src/lib/i18n/server'
import { filterKidSafe } from '@/src/lib/kids'
import { getKidsMode } from '@/src/lib/profiles'

export type ShowcaseFilm = { backdrop: string, title: string }

/** Null when TMDB has nothing or is unreachable. */
export async function showcaseFilm(): Promise<ShowcaseFilm | null> {
  const [kids, trending] = await Promise.all([
    getKidsMode().catch(() => false),
    tmdbFetchSafe('trending/movie/week', { language: catalogueLanguage(getLocale()) }),
  ])
  let films: any[] = (trending?.results ?? []).filter((film: any) => film?.backdrop_path && (film.title || film.original_title))
  if (kids) films = await filterKidSafe(films, 'movie')
  const film = films[0]
  return film ? { backdrop: film.backdrop_path, title: film.title || film.original_title } : null
}
