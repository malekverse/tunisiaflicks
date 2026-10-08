// Kids profiles: what the catalogue may show. Lists come from TMDB discover with US certification
// filters; anything else (search, recommendations, credits, detail pages) is checked title by title.
//
// Exact rating lists, not `certification.lte`: TMDB orders "NR" (unrated) *below* G, so
// `certification.lte=PG` lets unrated titles (including horror) through.
import { tmdbFetchSafe } from '@/src/lib/tmdb'

type Kind = 'movie' | 'tv'
type Params = Record<string, string | number | boolean | undefined>

const MOVIE_RATINGS = new Set(['G', 'PG'])
const TV_RATINGS = new Set(['TV-Y', 'TV-Y7', 'TV-G'])

// Horror, Thriller, Crime, War, War & Politics; and for TV, News, Talk, Reality, Soap.
const MATURE_GENRES = new Set([27, 53, 80, 10752, 10768])
const GROWN_UP_TV_GENRES = new Set([10763, 10767, 10764, 10766])
// Kids, Animation, Family: a TV show must have one of these.
const KIDS_TV_GENRES = new Set([10762, 16, 10751])

/** Genres hidden from the genre chips of a Kids profile. */
export const isGrownUpGenre = (id: number) => MATURE_GENRES.has(id) || GROWN_UP_TV_GENRES.has(id)

/** Adds the Kids filters to a TMDB `discover/{kind}` request. */
export function kidsDiscoverParams(kind: Kind, params: Params = {}): Params {
  if (kind === 'movie') {
    return { ...params, include_adult: false, certification_country: 'US', certification: 'G|PG', without_genres: '27,53,80,10752' }
  }
  return {
    ...params,
    include_adult: false,
    certification_country: 'US',
    certification: 'TV-Y|TV-Y7|TV-G',
    // A genre picked by the user narrows it further; the rating filter alone keeps it safe.
    with_genres: params.with_genres ?? '10762|16|10751',
    without_genres: '80,10768,10763,10767,10764,10766',
  }
}

export type KidsList = 'trending' | 'popular' | 'top_rated' | 'now_playing' | 'upcoming' | 'on_the_air' | 'airing_today'

/**
 * One of TMDB's fixed lists, or its Kids-safe stand-in for a Kids profile. `language`: TMDB's
 * language for the titles (see catalogueLanguage in lib/tmdb-locale); English when left out.
 */
export function fetchList(kind: Kind, list: KidsList, kids: boolean, path: string, language?: string) {
  if (!kids) return tmdbFetchSafe(path, { page: 1, language })
  const request = kidsList(kind, list)
  return tmdbFetchSafe(request.path, { ...request.params, page: 1, language })
}

const day = (offset: number) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10)

/** The Kids-safe discover request standing in for one of TMDB's fixed lists (which can't be filtered). */
export function kidsList(kind: Kind, list: KidsList): { path: string, params: Params } {
  const dateField = kind === 'movie' ? 'primary_release_date' : 'air_date'
  const presets: Record<KidsList, Params> = {
    trending: { sort_by: 'popularity.desc', [`${dateField}.gte`]: day(-365), 'vote_count.gte': 20 },
    popular: { sort_by: 'popularity.desc', 'vote_count.gte': 50 },
    top_rated: { sort_by: 'vote_average.desc', 'vote_count.gte': kind === 'movie' ? 500 : 200 },
    now_playing: { sort_by: 'popularity.desc', [`${dateField}.gte`]: day(-60), [`${dateField}.lte`]: day(0) },
    upcoming: { sort_by: 'popularity.desc', [`${dateField}.gte`]: day(1) },
    on_the_air: { sort_by: 'popularity.desc', 'air_date.gte': day(0), 'air_date.lte': day(7) },
    airing_today: { sort_by: 'popularity.desc', 'air_date.gte': day(0), 'air_date.lte': day(0) },
  }
  return { path: `discover/${kind}`, params: kidsDiscoverParams(kind, presets[list]) }
}

const genresOf = (item: any): number[] => item.genre_ids ?? item.genres?.map((genre: any) => genre.id) ?? []

/** Cheap first pass on what TMDB already returned (no extra requests). */
function looksKidSafe(item: any, kind: Kind) {
  if (!item || item.adult) return false
  const genres = genresOf(item)
  if (genres.some(isGrownUpGenre)) return false
  return kind === 'movie' || genres.some((genre) => KIDS_TV_GENRES.has(genre))
}

/** The US rating of a title ('' when it has none). Cached for a week; null when TMDB can't say. */
async function usRating(kind: Kind, id: string | number): Promise<string | null> {
  if (kind === 'movie') {
    const data = await tmdbFetchSafe<{ results: any[] }>(`movie/${id}/release_dates`, {}, 604800)
    if (!data) return null
    const us = data.results?.find((entry) => entry.iso_3166_1 === 'US')
    return us?.release_dates?.map((release: any) => release.certification).find(Boolean) ?? ''
  }
  const data = await tmdbFetchSafe<{ results: any[] }>(`tv/${id}/content_ratings`, {}, 604800)
  if (!data) return null
  return data.results?.find((entry) => entry.iso_3166_1 === 'US')?.rating ?? ''
}

/** Whether one movie/show (TMDB list item or detail object) is fine for a Kids profile. Unrated = no. */
export async function isKidSafe(item: any, kind: Kind) {
  if (!looksKidSafe(item, kind)) return false
  const rating = await usRating(kind, item.id)
  return rating !== null && (kind === 'movie' ? MOVIE_RATINGS : TV_RATINGS).has(rating)
}

/**
 * Keeps the Kids-safe movies/shows of a TMDB results array (people and other media types are
 * dropped). `kind` is for lists without `media_type`. At most `limit` titles are rating-checked.
 */
export async function filterKidSafe<T extends Record<string, any>>(items: T[], kind?: Kind, limit = 40): Promise<T[]> {
  const kindOf = (item: T): Kind | null => {
    const value = kind ?? item.media_type
    return value === 'movie' || value === 'tv' ? value : null
  }
  const candidates = items.filter((item) => {
    const itemKind = kindOf(item)
    return itemKind !== null && looksKidSafe(item, itemKind)
  }).slice(0, limit)
  const safe = await Promise.all(candidates.map((item) => isKidSafe(item, kindOf(item)!)))
  return candidates.filter((_, index) => safe[index])
}
