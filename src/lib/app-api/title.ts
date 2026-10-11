// A movie or a show for the apps' title screen, in the asked language (as the site's title pages:
// lib/tmdb-locale), with what the screen draws: the logo, the trailer, the cast, the seasons, more
// like it, and the sources to play from (the same list as the site's player, see
// lib/stream-providers; the app fills in the season and episode).
import { TmdbError, tmdbFetch, tmdbFetchSafe, tmdbLanguage } from '@/src/lib/tmdb'
import { catalogueLanguage, localizeDetail, logoLanguages, translatedRecord } from '@/src/lib/tmdb-locale'
import { filterKidSafe, isKidSafe } from '@/src/lib/kids'
import { pickLogo, pickTrailer, trailerLanguages } from '@/src/lib/media-assets'
import { getProviderTemplates, type ProviderTemplate } from '@/src/lib/stream-providers'
import type { Locale } from '@/src/lib/i18n/locales'
import { toCards, type AppCard, type Kind } from './shared'

export type AppPerson = { id: number, name: string, character: string, profile: string | null }
export type AppSeason = { number: number, name: string, episodes: number, poster: string | null, year: string }

export type AppTitle = {
  id: number
  kind: Kind
  title: string
  originalTitle: string
  tagline: string
  overview: string
  year: string
  /** Minutes (a movie, or a show's typical episode); null when TMDB doesn't say. */
  runtime: number | null
  rating: number | null
  genres: { id: number, name: string }[]
  backdrop: string | null
  poster: string | null
  logo: { path: string, ratio: number } | null
  /** YouTube key of the trailer, in the viewer's language when there is one. */
  trailer: string | null
  imdbId: string | null
  cast: AppPerson[]
  /** Shows only (season 0, specials, left out). */
  seasons: AppSeason[]
  similar: AppCard[]
  /** Where it plays: `{id}`, `{season}` and `{episode}` are left for the app to fill in. */
  sources: ProviderTemplate[]
}

export type TitleResult = { status: 'ok', title: AppTitle } | { status: 'not_found' } | { status: 'kids_blocked' } | { status: 'unavailable' }

const yearOf = (date: unknown) => (typeof date === 'string' ? date.slice(0, 4) : '')

export async function getTitle(kind: Kind, id: string, locale: Locale, kids: boolean): Promise<TitleResult> {
  if (!/^\d{1,9}$/.test(id)) return { status: 'not_found' }
  let record: any
  try {
    record = await tmdbFetch(`${kind}/${id}`, {
      append_to_response: 'images,credits,videos,external_ids',
      include_image_language: logoLanguages(locale),
      include_video_language: 'en,ar,fr,null',
    })
  } catch (error) {
    if (error instanceof TmdbError && error.status === 404) return { status: 'not_found' }
    console.error(error)
    return { status: 'unavailable' }
  }
  if (kids && !(await isKidSafe(record, kind))) return { status: 'kids_blocked' }

  const [translated, recommendations] = await Promise.all([
    translatedRecord(kind, id, locale),
    tmdbFetchSafe<{ results?: any[] }>(`${kind}/${id}/recommendations`, { language: catalogueLanguage(locale) }),
  ])
  const data = localizeDetail(record, translated, locale)
  const similar = kids ? await filterKidSafe(recommendations?.results ?? [], kind) : recommendations?.results ?? []
  const votes = typeof record.vote_count === 'number' ? record.vote_count : 0

  return {
    status: 'ok',
    title: {
      id: record.id,
      kind,
      title: (kind === 'movie' ? data.title : data.name) || '',
      originalTitle: (kind === 'movie' ? record.original_title : record.original_name) || '',
      tagline: data.tagline || '',
      overview: data.overview || '',
      year: yearOf(kind === 'movie' ? record.release_date : record.first_air_date),
      runtime: kind === 'movie' ? record.runtime || null : record.episode_run_time?.[0] || null,
      rating: votes > 0 && typeof record.vote_average === 'number' ? Math.round(record.vote_average * 10) / 10 : null,
      genres: (data.genres ?? []).map((genre: any) => ({ id: genre.id, name: genre.name })),
      backdrop: record.backdrop_path ?? null,
      poster: data.poster_path ?? record.poster_path ?? null,
      logo: pickLogo(record.images?.logos),
      trailer: pickTrailer(record.videos?.results, trailerLanguages(locale)),
      imdbId: record.external_ids?.imdb_id ?? record.imdb_id ?? null,
      cast: (record.credits?.cast ?? []).slice(0, 15).map((person: any) => ({
        id: person.id,
        name: person.name,
        character: person.character || '',
        profile: person.profile_path ?? null,
      })),
      seasons: kind === 'tv'
        ? (data.seasons ?? record.seasons ?? [])
          .filter((season: any) => season.season_number > 0 && (season.episode_count ?? 0) > 0)
          .map((season: any) => ({
            number: season.season_number,
            name: season.name || '',
            episodes: season.episode_count ?? 0,
            poster: season.poster_path ?? null,
            year: yearOf(season.air_date),
          }))
        : [],
      similar: toCards(similar, kind).slice(0, 20),
      sources: getProviderTemplates(),
    },
  }
}

export type AppEpisode = { number: number, name: string, overview: string, still: string | null, runtime: number | null, airDate: string, rating: number | null }
export type AppSeasonDetail = { number: number, name: string, overview: string, episodes: AppEpisode[] }

/** One season of a show, its episodes in order; null when TMDB has no such season. */
export async function getSeason(id: string, season: number, locale: Locale): Promise<AppSeasonDetail | null> {
  if (!/^\d{1,9}$/.test(id) || !Number.isInteger(season) || season < 0 || season > 200) return null
  const [english, translated] = await Promise.all([
    tmdbFetchSafe<any>(`tv/${id}/season/${season}`),
    locale === 'en' ? null : tmdbFetchSafe<any>(`tv/${id}/season/${season}`, { language: tmdbLanguage(locale) }),
  ])
  if (!english) return null
  const byNumber = new Map<number, any>((translated?.episodes ?? []).map((episode: any) => [episode.episode_number, episode]))
  return {
    number: english.season_number ?? season,
    name: translated?.name || english.name || '',
    overview: translated?.overview || english.overview || '',
    episodes: (english.episodes ?? []).map((episode: any) => {
      const local = byNumber.get(episode.episode_number)
      return {
        number: episode.episode_number,
        name: local?.name || episode.name || '',
        overview: local?.overview || episode.overview || '',
        still: episode.still_path ?? null,
        runtime: episode.runtime ?? null,
        airDate: episode.air_date ?? '',
        rating: episode.vote_count > 0 ? Math.round(episode.vote_average * 10) / 10 : null,
      }
    }),
  }
}
