// The lists the apps show as rows and "See all" grids, by key: TMDB's fixed lists (their kid-safe
// stand-ins on a Kids profile, see lib/kids), Tunisian cinema, and a genre for movies or shows.
import { tmdbFetchSafe } from '@/src/lib/tmdb'
import { catalogueLanguage } from '@/src/lib/tmdb-locale'
import { kidsDiscoverParams, kidsList, type KidsList } from '@/src/lib/kids'
import type { Locale } from '@/src/lib/i18n/locales'
import { toCards, type AppCard, type Kind } from './shared'

type Fixed = { kind: Kind, list: KidsList, path: string }

const FIXED: Record<string, Fixed> = {
  'trending-movies': { kind: 'movie', list: 'trending', path: 'trending/movie/week' },
  'trending-tv': { kind: 'tv', list: 'trending', path: 'trending/tv/week' },
  'popular-movies': { kind: 'movie', list: 'popular', path: 'movie/popular' },
  'popular-tv': { kind: 'tv', list: 'popular', path: 'tv/popular' },
  'top-rated-movies': { kind: 'movie', list: 'top_rated', path: 'movie/top_rated' },
  'top-rated-tv': { kind: 'tv', list: 'top_rated', path: 'tv/top_rated' },
  'now-playing': { kind: 'movie', list: 'now_playing', path: 'movie/now_playing' },
  upcoming: { kind: 'movie', list: 'upcoming', path: 'movie/upcoming' },
  'on-the-air': { kind: 'tv', list: 'on_the_air', path: 'tv/on_the_air' },
}

const GENRE = /^genre-(movie|tv)-(\d{1,6})$/

// Talk shows and news top TMDB's popular TV lists every day; nobody opens a film app for them.
const TALK_AND_NEWS = new Set([10767, 10763])
const notTalkOrNews = (item: any) => !(item?.genre_ids ?? []).some((genre: number) => TALK_AND_NEWS.has(genre))

export const LIST_KEYS = [...Object.keys(FIXED), 'tunisian-movies', 'tunisian-tv'] as const

/** Whether `key` names a list (a fixed one, Tunisian, or genre-movie-28 / genre-tv-18). */
export const isListKey = (key: string) => key in FIXED || key === 'tunisian-movies' || key === 'tunisian-tv' || GENRE.test(key)

export type AppList = { key: string, kind: Kind, items: AppCard[], page: number, totalPages: number }

type TmdbPage = { results?: any[], page?: number, total_pages?: number }

/** One page (1-20) of a list; null when the key is unknown or TMDB can't answer. */
export async function getList(key: string, page: number, locale: Locale, kids: boolean): Promise<AppList | null> {
  const language = catalogueLanguage(locale)
  let kind: Kind
  let data: TmdbPage | null

  if (key in FIXED) {
    const fixed = FIXED[key]
    kind = fixed.kind
    if (kids) {
      const request = kidsList(fixed.kind, fixed.list)
      data = await tmdbFetchSafe<TmdbPage>(request.path, { ...request.params, page, language })
    } else {
      data = await tmdbFetchSafe<TmdbPage>(fixed.path, { page, language })
    }
  } else if (key === 'tunisian-movies' || key === 'tunisian-tv') {
    kind = key === 'tunisian-movies' ? 'movie' : 'tv'
    const params = { with_origin_country: 'TN', sort_by: 'popularity.desc', page, language }
    data = await tmdbFetchSafe<TmdbPage>(`discover/${kind}`, kids ? kidsDiscoverParams(kind, params) : params)
  } else {
    const match = GENRE.exec(key)
    if (!match) return null
    kind = match[1] as Kind
    const params = { with_genres: match[2], sort_by: 'popularity.desc', 'vote_count.gte': 30, page, language }
    data = await tmdbFetchSafe<TmdbPage>(`discover/${kind}`, kids ? kidsDiscoverParams(kind, params) : params)
  }

  if (!data) return null
  return {
    key,
    kind,
    // On a Kids profile every request above already asks TMDB for kid-safe ratings only.
    items: toCards(kind === 'tv' ? (data.results ?? []).filter(notTalkOrNews) : data.results, kind),
    page: data.page ?? page,
    // TMDB serves at most 500 pages; the apps never need more than 20.
    totalPages: Math.min(data.total_pages ?? 1, 20),
  }
}
