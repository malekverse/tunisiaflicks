// The Turkish and Korean drama hubs: what each hub is (language, country, accent, thresholds), its
// shelves, and the pure rules the data layer (lib/dramas.ts) and the pages share: queries, daily
// rotation, air-date badges, the featured series' reasons, logos and trailers, plural keys.
// No I/O here, so unit tests can import it as is.
import type { Locale } from '@/src/lib/i18n/locales'
import { htmlLang } from '@/src/lib/i18n/locales'
import { addDays } from '@/src/lib/hijri'
import { hash, shuffled } from '@/src/lib/seed'

export type HubId = 'turkish' | 'korean'
export const HUB_IDS: readonly HubId[] = ['turkish', 'korean']
export const isHubId = (v: unknown): v is HubId => v === 'turkish' || v === 'korean'

export type HubConfig = {
  id: HubId
  /** TMDB original language and origin country. */
  language: 'tr' | 'ko'
  country: 'TR' | 'KR'
  /** "r g b": the room light, the watermark and glows. Never a button. */
  accent: string
  /** The lattice drawn behind the hub's title: an Ottoman kafes screen, a Korean changsal window. */
  watermark: 'kafes' | 'changsal'
  /** A "short series" has at most this many episodes. */
  shortMaxEpisodes: number
  /** Minimum TMDB vote counts: series rows, the all-time favourites, films. */
  votes: { tv: number, favourites: number, movie: number }
  favouritesMinRating: number
  /** TMDB keyword names, resolved to ids through search/keyword (cached a month). */
  keywords: { romance: readonly string[], historical: readonly string[] }
}

const ROMANCE = ['romance', 'love', 'romantic comedy', 'love triangle', 'forbidden love', 'first love', 'contract marriage']

export const HUBS: Record<HubId, HubConfig> = {
  turkish: {
    id: 'turkish',
    language: 'tr',
    country: 'TR',
    accent: '40 196 184',
    watermark: 'kafes',
    shortMaxEpisodes: 13,
    votes: { tv: 10, favourites: 40, movie: 30 },
    favouritesMinRating: 7.5,
    keywords: { romance: ROMANCE, historical: ['ottoman empire', 'sultan', 'historical drama', 'period drama', 'seljuk empire'] },
  },
  korean: {
    id: 'korean',
    language: 'ko',
    country: 'KR',
    accent: '104 124 255',
    watermark: 'changsal',
    shortMaxEpisodes: 12,
    votes: { tv: 30, favourites: 200, movie: 150 },
    favouritesMinRating: 7.8,
    keywords: { romance: ROMANCE, historical: ['joseon dynasty', 'goryeo dynasty', 'historical drama', 'period drama', 'sageuk'] },
  },
}

/** TMDB's "War & Politics": history rows top up with it when the keywords find too little. */
export const HISTORICAL_FALLBACK_GENRE = 10768
/** Animation, documentary, kids, news, reality and talk shows aren't dramas. */
export const EXCLUDED_TV_GENRES = [16, 99, 10762, 10763, 10764, 10767]
export const EXCLUDED_MOVIE_GENRES = [16, 99]

export const SHELF_IDS = ['new-episodes', 'trending', 'for-you', 'favourites', 'romance', 'historical', 'thrillers', 'short', 'films'] as const
export type ShelfId = typeof SHELF_IDS[number]
export type DataShelf = Exclude<ShelfId, 'for-you'>

/** The shelves the filter chips open as a full grid (`?shelf=`), in chip order. */
export const FILTER_SHELVES = ['romance', 'historical', 'thrillers', 'short', 'films'] as const
export type FilterShelf = typeof FILTER_SHELVES[number]
export const isFilterShelf = (v: unknown): v is FilterShelf => typeof v === 'string' && (FILTER_SHELVES as readonly string[]).includes(v)

/** Titles in a row, and in a full grid. */
export const ROW_SIZE = 20
export const GRID_SIZE = 60

/** A row with fewer titles than this isn't shown: new episodes 3, the Top 10 5, others 6. */
export function rowMinimum(shelf: ShelfId): number {
  return shelf === 'new-episodes' ? 3 : shelf === 'trending' ? 5 : 6
}

export const hubPath = (hub: HubId, shelf?: FilterShelf | null) => (shelf ? `/dramas/${hub}?shelf=${shelf}` : `/dramas/${hub}`)
export const otherHub = (hub: HubId): HubId => (hub === 'turkish' ? 'korean' : 'turkish')

type Params = Record<string, string | number | boolean>

/** What every series query of a hub starts from. */
export function tvBaseParams(hub: HubId, language: string): Params {
  const config = HUBS[hub]
  return {
    with_original_language: config.language,
    with_origin_country: config.country,
    // Scripted and miniseries: no reality, talk or news formats.
    with_type: '2|4',
    without_genres: EXCLUDED_TV_GENRES.join(','),
    include_adult: false,
    language,
  }
}

/** What every film query of a hub starts from. */
export function movieBaseParams(hub: HubId, language: string): Params {
  const config = HUBS[hub]
  return {
    with_original_language: config.language,
    with_origin_country: config.country,
    without_genres: EXCLUDED_MOVIE_GENRES.join(','),
    include_adult: false,
    language,
  }
}

/** Whether a TMDB list item (trending, recommendations) belongs to the hub. */
export function belongsToHub(item: any, hub: HubId): boolean {
  const config = HUBS[hub]
  if (item?.original_language !== config.language) return false
  const countries: string[] = item.origin_country ?? item.production_countries?.map((country: any) => country.iso_3166_1) ?? []
  if (countries.length > 0 && !countries.includes(config.country)) return false
  const genres: number[] = item.genre_ids ?? item.genres?.map((genre: any) => genre.id) ?? []
  return !genres.some((genre) => EXCLUDED_TV_GENRES.includes(genre))
}

/** The id of a keyword from TMDB's search/keyword results: the exact name, or "name (...)". */
export function chooseKeywordId(word: string, results: { id: number, name: string }[]): number | null {
  const wanted = word.toLowerCase()
  const exact = results.find((result) => result.name?.toLowerCase() === wanted)
  if (exact) return exact.id
  const qualified = results.find((result) => result.name?.toLowerCase().startsWith(`${wanted} (`))
  return qualified?.id ?? null
}

/** The day's order of a shelf: the same for everyone all day (Tunis time), new tomorrow. */
export const rotationSeed = (date: string, hub: HubId, shelf: ShelfId | string) => `${date}:${hub}:${shelf}`
export const rotate = <T>(items: T[], seed: string): T[] => shuffled(items, seed)

/** Text written only in Hangul (TMDB had no translation): shown with its English title instead. */
export function isHangulOnly(text: string | null | undefined): boolean {
  if (!text) return false
  return /\p{Script=Hangul}/u.test(text) && !/[\p{Script=Latin}\p{Script=Arabic}]/u.test(text)
}

/**
 * The title-treatment logo: English, then textless, then (Turkish hub) Turkish. Never one in
 * Korean script, which most viewers can't read.
 */
export function pickHubLogo(logos: any[] | null | undefined, hub: HubId): { path: string, ratio: number } | null {
  const order = hub === 'turkish' ? ['en', null, 'tr'] : ['en', null]
  for (const language of order) {
    const logo = (logos ?? []).find((item) => (item.iso_639_1 ?? null) === language && item.file_path)
    if (logo) return { path: logo.file_path, ratio: logo.aspect_ratio || 3 }
  }
  return null
}

/** The trailer: English first, then the hub's language, then any; an official trailer before a teaser. */
export function pickHubTrailer(videos: any[] | null | undefined, hub: HubId): string | null {
  const youtube = (videos ?? []).filter((video) => video.site === 'YouTube' && video.key && (video.type === 'Trailer' || video.type === 'Teaser'))
  const rank = (video: any) => {
    const language = video.iso_639_1 === 'en' ? 0 : video.iso_639_1 === HUBS[hub].language ? 1 : 2
    const kind = video.type === 'Trailer' ? (video.official ? 0 : 1) : 2
    return kind * 3 + language
  }
  const best = [...youtube].sort((a, b) => rank(a) - rank(b))[0]
  return best?.key ?? null
}

// ---------------------------------------------------------------------------------------------
// Air dates (badges on "New episodes this week").

export type AirState =
  | { kind: 'today', date: string }
  | { kind: 'new', date: string }
  | { kind: 'tomorrow', date: string }
  | { kind: 'next', date: string }

/**
 * Where a series is in its week, from TMDB's last and next episode: out today, out in the last two
 * days, out tomorrow, or later this week (up to 4 days). Null when nothing falls in that window.
 */
export function airState(detail: any, today: string): AirState | null {
  const last: string | undefined = detail?.last_episode_to_air?.air_date
  const next: string | undefined = detail?.next_episode_to_air?.air_date
  if (last === today || next === today) return { kind: 'today', date: today }
  if (last && last >= addDays(today, -2) && last < today) return { kind: 'new', date: last }
  if (next === addDays(today, 1)) return { kind: 'tomorrow', date: next }
  if (next && next > today && next <= addDays(today, 4)) return { kind: 'next', date: next }
  return null
}

const AIR_ORDER: Record<AirState['kind'], number> = { today: 0, new: 1, tomorrow: 2, next: 3 }

/** Sort for the new-episodes row: what's out today, then the freshest, then what's next. */
export function compareAir(a: AirState, b: AirState): number {
  if (AIR_ORDER[a.kind] !== AIR_ORDER[b.kind]) return AIR_ORDER[a.kind] - AIR_ORDER[b.kind]
  // Newest first among what's out; soonest first among what's coming.
  return a.kind === 'new' ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)
}

// ---------------------------------------------------------------------------------------------
// The featured series and why it's featured today.

export type FeaturedReason =
  | { type: 'premiere', season: number }
  | { type: 'new', date: string }
  | { type: 'airing', date: string }
  | { type: 'justAired', episode: number }
  | { type: 'trending', rank: number }
  | { type: 'favourite' }
  | { type: 'popular' }

/** Most interesting first: a season that just started, a brand-new series, one on air, the charts, the classics. */
export const REASON_ORDER: FeaturedReason['type'][] = ['premiere', 'new', 'airing', 'justAired', 'trending', 'favourite', 'popular']

/** The best reason a series has to be featured today (see REASON_ORDER). */
export function reasonFor(detail: any, o: { today: string, trendingRank?: number | null, favourite?: boolean }): FeaturedReason {
  const { today } = o
  const last = detail?.last_episode_to_air
  const next = detail?.next_episode_to_air
  if (last?.episode_number === 1 && last.season_number > 1 && last.air_date >= addDays(today, -7) && last.air_date <= today) {
    return { type: 'premiere', season: last.season_number }
  }
  const first: string | undefined = detail?.first_air_date
  if (first && first >= addDays(today, -21) && first <= today) return { type: 'new', date: first }
  if (next?.air_date && next.air_date >= today && next.air_date <= addDays(today, 7)) return { type: 'airing', date: next.air_date }
  if (last?.air_date && last.air_date >= addDays(today, -6) && last.air_date <= today && last.episode_number) return { type: 'justAired', episode: last.episode_number }
  if (o.trendingRank && o.trendingRank <= 10) return { type: 'trending', rank: o.trendingRank }
  if (o.favourite) return { type: 'favourite' }
  return { type: 'popular' }
}

/** Reasons in tiers: fresh starts, on air this week, the charts, everything else. */
export function reasonTier(reason: FeaturedReason): number {
  switch (reason.type) {
    case 'premiere': case 'new': return 0
    case 'airing': case 'justAired': return 1
    case 'trending': return 2
    default: return 3
  }
}

/**
 * Today's featured series among `candidates` (in the order they were found, best first): the best
 * tier that has something not featured recently, then the day's draw among its first five.
 */
export function chooseFeatured<T extends { id: number, reason: FeaturedReason }>(candidates: T[], seed: string, recent: ReadonlySet<number>): T | null {
  const fresh = candidates.filter((candidate) => !recent.has(candidate.id))
  const pool = fresh.length > 0 ? fresh : candidates
  if (pool.length === 0) return null
  const best = Math.min(...pool.map((candidate) => reasonTier(candidate.reason)))
  const tier = pool.filter((candidate) => reasonTier(candidate.reason) === best).slice(0, 5)
  return tier[hash(seed) % tier.length]
}

// ---------------------------------------------------------------------------------------------
// Counted phrases.

export const PLURAL_CATEGORIES = ['zero', 'one', 'two', 'few', 'many', 'other'] as const
export type PluralCategory = typeof PLURAL_CATEGORIES[number]

/** `pluralKey('dramas.episodes', 'ar', 3)` gives 'dramas.episodes.few' (Intl.PluralRules of the locale). */
export function pluralKey<B extends string>(base: B, locale: Locale, count: number): `${B}.${PluralCategory}` {
  let category: PluralCategory = 'other'
  try {
    category = new Intl.PluralRules(htmlLang(locale)).select(count) as PluralCategory
  } catch {
    // An unknown language: 'other' reads fine.
  }
  return `${base}.${category}`
}
