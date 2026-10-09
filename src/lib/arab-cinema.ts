// The Arab cinema map's data: the index behind the 22 tiles (how much each country has on record,
// and its film of the day), and one country's page (stats, today's pick, rows, people). Server only.
//
// The index costs 3 TMDB requests per country (66 per language and profile kind, once a day) and is
// cached whole, per language, per day, and separately for Kids (filtered before it is cached).
import { unstable_cache } from 'next/cache'
import { tmdbFetchSafe, tmdbLanguage } from '@/src/lib/tmdb'
import { tunisDate } from '@/src/lib/hijri'
import { withTimeout } from '@/src/lib/with-timeout'
import { ARAB_COUNTRY_CODES, arabCountryName, type ArabCountryCode } from '@/src/lib/arab-countries'
import { MAP_CELLS } from '@/src/lib/arab-map'
import { countryPeople, filmOfTheDay, itemsOf, runQuery, titleOf, toMapTitle, type CountryPerson, type DiscoverPage, type MapTitle } from '@/src/lib/country-cinema'
import type { Locale } from '@/src/lib/i18n/locales'

const DAY = 86400

/** At most this many countries are fetched at once (each is 3 requests). */
const CONCURRENCY = 12

/** Runs `fn` over `items` with at most `limit` running at once, keeping the order. */
export async function mapLimit<T, R>(items: readonly T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const index = next++
      results[index] = await fn(items[index], index)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

/** One tile of the map. `films`/`series` are null when TMDB didn't answer for this country. */
export type MapCountry = {
  code: ArabCountryCode
  /** In the viewer's language, and in English (typeahead finds either). */
  name: string
  en: string
  films: number | null
  series: number | null
  /** Titles on record (films + series): how lit the tile is. */
  n: number
  pick: MapTitle | null
}

export type ArabMapIndex = {
  date: string
  /** The 22 countries in grid order (MAP_CELLS). */
  countries: MapCountry[]
  /** TMDB failed for most countries: names only, nothing lit (and nothing cached). */
  namesOnly: boolean
}

/** Bumped when the index's shape or rules change, so a cached day of the old one is not served. */
const INDEX_VERSION = '2'

/** The data cache key of one index: per profile kind (Kids are filtered), TMDB language and day. */
export function indexCacheKey(kids: boolean, language: string, date: string): string[] {
  return ['arab-map-index', INDEX_VERSION, kids ? 'kids' : 'all', language, date]
}

const names = (code: ArabCountryCode, locale: Locale) => ({ name: arabCountryName(code, locale), en: arabCountryName(code, 'en') })

/** The three requests behind a tile (shared with the country's page). */
async function tileData(code: ArabCountryCode, language: string, kids: boolean, date: string) {
  const [popular, series, known] = await Promise.all([
    runQuery(code, 'popularFilms', language, kids),
    runQuery(code, 'popularSeries', language, kids),
    runQuery(code, 'knownFilms', language, kids),
  ])
  const failed = !popular && !series && !known
  const films = popular?.total_results ?? known?.total_results ?? null
  const shows = series?.total_results ?? null
  return {
    failed,
    films,
    series: shows,
    n: (films ?? 0) + (shows ?? 0),
    pick: filmOfTheDay(code, date, { known, popular, series }),
  }
}

/**
 * Builds the index. Throws when more than half the countries failed (TMDB is down or the key is
 * missing), so a broken index is never cached for a day.
 */
export async function buildArabMapIndex(locale: Locale, kids: boolean, date: string): Promise<ArabMapIndex> {
  const language = tmdbLanguage(locale)
  const cells = await mapLimit(MAP_CELLS, CONCURRENCY, (cell) => tileData(cell.code, language, kids, date))
  const failures = cells.filter((cell) => cell.failed).length
  if (failures > ARAB_COUNTRY_CODES.length / 2) throw new Error(`arab-map: TMDB failed for ${failures} of ${ARAB_COUNTRY_CODES.length} countries`)
  return {
    date,
    namesOnly: false,
    countries: MAP_CELLS.map((cell, index) => {
      const { failed: _failed, ...data } = cells[index]
      return { code: cell.code, ...names(cell.code, locale), ...data }
    }),
  }
}

/** Every country by name, nothing lit: what the map shows when TMDB can't be reached. */
export function namesOnlyIndex(locale: Locale, date: string): ArabMapIndex {
  return {
    date,
    namesOnly: true,
    countries: MAP_CELLS.map((cell) => ({ code: cell.code, ...names(cell.code, locale), films: null, series: null, n: 0, pick: null })),
  }
}

/**
 * How long a page waits for a day's index that isn't cached yet. TMDB answers in a few seconds;
 * when it hangs, the map shows the names well before the route's 30s limit. The requests that did
 * answer are in the data cache, so the next visit picks up where this one stopped.
 */
const INDEX_DEADLINE = 20_000

/**
 * The map's index for this viewer: cached for the day, per TMDB language, Kids apart. When TMDB
 * fails for most countries, or doesn't answer in time, the names only (not cached, so the next
 * visit tries again).
 */
export async function getArabMapIndex(locale: Locale, kids: boolean): Promise<ArabMapIndex> {
  const date = tunisDate()
  const language = tmdbLanguage(locale)
  const index = await withTimeout(
    unstable_cache(() => buildArabMapIndex(locale, kids, date), indexCacheKey(kids, language, date), { revalidate: DAY })(),
    INDEX_DEADLINE,
    null,
  )
  return index ?? namesOnlyIndex(locale, date)
}

// ---------------------------------------------------------------------------------------------
// One country's page.

export type CountryPick = MapTitle & { overview: string, vote: number, runtime: number | null, seasons: number | null, genres: string[] }

export type CountryCinema = {
  code: ArabCountryCode
  films: number
  series: number
  /** The earliest film on record. */
  first: MapTitle | null
  pick: CountryPick | null
  rows: { id: 'new' | 'favourites' | 'series' | 'classics', kind: 'movie' | 'tv', items: any[] }[]
  /** Fewer than 12 titles on record: all of them, in one grid, instead of the rows. */
  everything: any[] | null
  /** TMDB didn't answer at all (not the same as nothing on record). */
  failed: boolean
}

/** A row only shows with at least this many titles. */
export const ROW_MIN = 4
/** Under this many titles on record, one grid instead of rows. */
export const GRID_UNDER = 12

const dedupe = (items: any[]) => {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = `${item.media_type}-${item.id}`
    return !seen.has(key) && seen.add(key)
  })
}

/** Today's pick with what the card shows (runtime or seasons, genres); details cached for a day. */
async function pickDetails(pick: MapTitle | null, language: string, pool: any[]): Promise<CountryPick | null> {
  if (!pick) return null
  const item = pool.find((entry) => entry.id === pick.id && entry.media_type === pick.kind)
  const details = await tmdbFetchSafe<any>(`${pick.kind}/${pick.id}`, { language }, DAY)
  return {
    ...pick,
    overview: (details?.overview || item?.overview || '').trim(),
    vote: Number(details?.vote_average ?? item?.vote_average ?? 0) || 0,
    runtime: pick.kind === 'movie' ? details?.runtime || null : null,
    seasons: pick.kind === 'tv' ? details?.number_of_seasons || null : null,
    genres: (details?.genres ?? []).slice(0, 2).map((genre: any) => genre.name).filter(Boolean),
  }
}

/**
 * A country's page: its stats, today's pick (the same film that lights its tile), and its rows,
 * or one grid of everything when it has fewer than 12 titles on record. About 8 requests, three
 * of them shared with the map.
 */
export async function getCountryCinema(code: ArabCountryCode, locale: Locale, kids: boolean): Promise<CountryCinema> {
  const language = tmdbLanguage(locale)
  const date = tunisDate()
  const [popular, series, known, recent, favourites, classics, firstPage] = await Promise.all([
    runQuery(code, 'popularFilms', language, kids),
    runQuery(code, 'popularSeries', language, kids),
    runQuery(code, 'knownFilms', language, kids),
    runQuery(code, 'newFilms', language, kids),
    runQuery(code, 'favourites', language, kids),
    runQuery(code, 'classics', language, kids),
    runQuery(code, 'firstFilm', language, kids),
  ])
  const failed = [popular, series, known].every((page) => page === null)
  const films = popular?.total_results ?? known?.total_results ?? 0
  const shows = series?.total_results ?? 0
  const pool = [...itemsOf(known, 'movie'), ...itemsOf(popular, 'movie'), ...itemsOf(series, 'tv')]
  const firstItem = (firstPage?.results ?? []).find((item: any) => item.release_date)
  const pick = await pickDetails(filmOfTheDay(code, date, { known, popular, series }), language, pool)

  const total = films + shows
  const everything = total > 0 && total < GRID_UNDER
    ? dedupe([...itemsOf(popular, 'movie'), ...itemsOf(known, 'movie'), ...itemsOf(series, 'tv')])
      .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
    : null
  const rows: CountryCinema['rows'] = everything ? [] : ([
    { id: 'new', kind: 'movie', items: itemsOf(recent, 'movie') },
    { id: 'favourites', kind: 'movie', items: itemsOf(favourites, 'movie') },
    { id: 'series', kind: 'tv', items: itemsOf(series, 'tv') },
    { id: 'classics', kind: 'movie', items: itemsOf(classics, 'movie') },
  ] as const).map((row) => ({ ...row, items: row.items.slice(0, 20) })).filter((row) => row.items.length >= ROW_MIN)

  return {
    code,
    films,
    series: shows,
    first: firstItem ? toMapTitle(firstItem, 'movie') : null,
    pick,
    rows,
    everything: everything && everything.length > 0 ? everything : null,
    failed,
  }
}

// ---------------------------------------------------------------------------------------------
// Share cards (English, like every share card).

const poster342 = (path: string | null | undefined) => (path ? `https://image.tmdb.org/t/p/w342${path}` : null)

/**
 * The share card of the map (no `code`) or of one country: a wall of today's films (the map) or
 * of the country's best-known titles. The same shape as SHARE_SECTIONS entries, so the map can be
 * one ('arab-cinema': arabCinemaShareSection()).
 */
export function arabCinemaShareSection(code?: ArabCountryCode) {
  const name = code ? arabCountryName(code, 'en') : null
  return {
    title: name ?? 'Arab cinema',
    subtitle: name
      ? `Films and series from ${name}, on the Arab cinema map: new releases, all-time favourites and classics.`
      : 'Films and series from the 22 countries of the Arab world, on one map.',
    cta: 'Explore the map',
    glow: '200 162 122',
    posters: async (): Promise<string[]> => {
      if (!code) {
        const index = await getArabMapIndex('en', false)
        return index.countries.map((country) => poster342(country.pick?.poster)).filter((url): url is string => !!url).slice(0, 12)
      }
      const [known, popular, series] = await Promise.all([
        runQuery(code, 'knownFilms', tmdbLanguage('en'), false),
        runQuery(code, 'popularFilms', tmdbLanguage('en'), false),
        runQuery(code, 'popularSeries', tmdbLanguage('en'), false),
      ])
      const urls = [...itemsOf(known, 'movie'), ...itemsOf(popular, 'movie'), ...itemsOf(series, 'tv')].map((item) => poster342(item.poster_path))
      return Array.from(new Set(urls.filter((url): url is string => !!url))).slice(0, 12)
    },
  }
}

/** The people born in the country among the casts and directors of its best-known titles. */
export async function getCountryPeople(code: ArabCountryCode, locale: Locale): Promise<CountryPerson[]> {
  const language = tmdbLanguage(locale)
  const [popular, series]: (DiscoverPage | null)[] = await Promise.all([
    runQuery(code, 'popularFilms', language, false),
    runQuery(code, 'popularSeries', language, false),
  ])
  const titles = [...itemsOf(popular, 'movie').slice(0, 12), ...itemsOf(series, 'tv').slice(0, 6)]
    .map((item) => ({ id: item.id, media_type: item.media_type, title: titleOf(item) }))
  if (titles.length === 0) return []
  return countryPeople(code, titles, language)
}
