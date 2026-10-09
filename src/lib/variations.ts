// "More like this, but…": the variations of a title's recommendations (lighter, darker, shorter,
// older, newer, as a series or a film, from the Arab world), which ones a title offers, what each
// one asks TMDB, and how the results are ranked. Pure helpers, safe on the server and the client;
// the TMDB calls live in lib/variations-tmdb.ts.
import { ARAB_TMDB_COUNTRIES } from '@/src/lib/arab-countries'

export type Kind = 'movie' | 'tv'
export type Variation = 'lighter' | 'darker' | 'shorter' | 'older' | 'newer' | 'kind' | 'arab'
/** The tab ids: the recommendations ('closest') and the variations. */
export type VariationTab = 'closest' | Variation

/** Display order (the owner's): Arab world moves right after Closest in Arabic and Derja. */
export const VARIATIONS: readonly Variation[] = ['lighter', 'darker', 'shorter', 'older', 'newer', 'kind', 'arab']

export const isVariation = (value: unknown): value is Variation => typeof value === 'string' && (VARIATIONS as readonly string[]).includes(value)

/** What a title's page knows about it, enough to decide and phrase its variations. */
export type VariationFacts = {
  kind: Kind
  genreIds: number[]
  /** First release (or first air) year. */
  year: number | null
  /** Movies: minutes. */
  runtime: number | null
  /** Shows. */
  seasons: number | null
  /** Shows: a typical episode's minutes. */
  episodeRuntime: number | null
}

const yearOf = (date: unknown) => {
  const year = typeof date === 'string' ? Number(date.slice(0, 4)) : NaN
  return Number.isInteger(year) && year > 1800 ? year : null
}

const positive = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null)

/** The facts, from a TMDB detail record (movie/{id} or tv/{id}). */
export function variationFacts(kind: Kind, data: any): VariationFacts {
  const genreIds: number[] = (data?.genres ?? []).map((genre: any) => genre?.id).filter((id: unknown) => typeof id === 'number')
  if (kind === 'movie') {
    return { kind, genreIds, year: yearOf(data?.release_date), runtime: positive(data?.runtime), seasons: null, episodeRuntime: null }
  }
  const episodeRuntime = positive(data?.episode_run_time?.[0]) ?? positive(data?.last_episode_to_air?.runtime) ?? positive(data?.next_episode_to_air?.runtime)
  return { kind, genreIds, year: yearOf(data?.first_air_date), runtime: null, seasons: positive(data?.number_of_seasons), episodeRuntime }
}

// How heavy each genre sits, from 0 (comedy, family) to 3 (horror, war).
const DARKNESS: Record<number, number> = {
  27: 3, 10752: 3, 10768: 3, 53: 2.5, 80: 2.5, 9648: 2, 37: 2,
  28: 1.75, 878: 1.75, 10759: 1.75, 10765: 1.75,
  18: 1.5, 36: 1.5, 99: 1.5, 10763: 1.5,
  12: 1, 14: 1, 10770: 1, 10764: 1, 10766: 1,
  10749: 0.5, 10402: 0.5, 16: 0.5, 10767: 0.5,
  35: 0, 10751: 0, 10762: 0,
}

/**
 * How dark a title is, from its genres: 0 (light) to 3 (dark). Mostly its darkest genre, softened
 * by the others (a comedy-drama is lighter than a drama).
 */
export function toneOf(genreIds: number[]): number {
  const weights = genreIds.map((id) => DARKNESS[id]).filter((weight): weight is number => weight !== undefined)
  if (!weights.length) return 1.5
  const max = Math.max(...weights)
  const mean = weights.reduce((sum, weight) => sum + weight, 0) / weights.length
  return Math.round((0.75 * max + 0.25 * mean) * 100) / 100
}

/** Offer "lighter" unless the title is already light; "darker" unless it is already dark. */
export const LIGHT_TONE = 1.5
export const DARK_TONE = 2.5

const round5 = (value: number) => Math.round(value / 5) * 5
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/** "Shorter" films: at most this many minutes. */
export const shorterCap = (runtime: number) => clamp(round5(runtime * 0.8), 75, 105)
/** "Newer": released since this year. */
export const newerSince = (year: number, now: Date = new Date()) => Math.max(year + 5, now.getUTCFullYear() - 8)
/** "Older": released before this year. */
export const olderBefore = (year: number) => year - 15

/** Whether a variation makes sense for this title (and this profile). */
export function isAvailable(variation: Variation, facts: VariationFacts, kids: boolean, now: Date = new Date()): boolean {
  const tone = toneOf(facts.genreIds)
  switch (variation) {
    case 'lighter': return tone >= LIGHT_TONE
    case 'darker': return !kids && tone < DARK_TONE
    case 'shorter':
      return facts.kind === 'movie'
        ? (facts.runtime ?? 0) >= 100
        : (facts.seasons ?? 0) >= 2 || (facts.episodeRuntime ?? 0) >= 45
    case 'older': return facts.year !== null && facts.year >= 1990
    case 'newer': return facts.year !== null && facts.year <= now.getUTCFullYear() - 6
    case 'kind':
    case 'arab':
      return true
  }
}

/** The title's variations, in display order for the locale. */
export function availableVariations(facts: VariationFacts, kids: boolean, locale: string, now: Date = new Date()): Variation[] {
  const list = VARIATIONS.filter((variation) => isAvailable(variation, facts, kids, now))
  if ((locale === 'ar' || locale === 'tn') && list.includes('arab')) return ['arab', ...list.filter((variation) => variation !== 'arab')]
  return list
}

/** The section renders when the recommendations have something, or two variations at least exist. */
export const showsSimilar = (closest: number, variations: number) => closest > 0 || variations >= 2

export type Phrase = { key: string, vars?: Record<string, number> }

/** The heading of a tab ('More like this, but lighter'). */
export function variationTitle(tab: VariationTab, kind: Kind): string {
  if (tab === 'closest') return 'more.title.closest'
  if (tab === 'kind') return kind === 'movie' ? 'more.title.asSeries' : 'more.title.asFilm'
  return `more.title.${tab}`
}

/** The chip of a tab. */
export function variationChip(tab: VariationTab, kind: Kind): string {
  if (tab === 'kind') return kind === 'movie' ? 'more.chip.asSeries' : 'more.chip.asFilm'
  return `more.chip.${tab}`
}

/** The line under the heading, if the tab has one. */
export function variationHint(tab: VariationTab, facts: VariationFacts, now: Date = new Date()): Phrase | null {
  switch (tab) {
    case 'lighter': return { key: 'more.hint.lighter' }
    case 'darker': return { key: 'more.hint.darker' }
    case 'shorter':
      return facts.kind === 'movie' && facts.runtime
        ? { key: 'more.hint.shorterFilm', vars: { minutes: shorterCap(facts.runtime) } }
        : { key: 'more.hint.shorterSeries' }
    case 'older': return facts.year ? { key: 'more.hint.older', vars: { year: olderBefore(facts.year) } } : null
    case 'newer': return facts.year ? { key: 'more.hint.newer', vars: { year: newerSince(facts.year, now) } } : null
    case 'arab': return { key: 'more.hint.arab' }
    default: return null
  }
}

// ---------------------------------------------------------------------------------------------
// What each variation asks TMDB (discover). At most three attempts, from the closest (the title's
// keywords) to the loosest (only the variation's own rule); the results are merged until there
// are enough.

export type Params = Record<string, string | number | boolean>
export type Attempt = { kind: Kind, params: Params }

const LIGHT_GENRES = '35|10751|16'
const DARK_GENRES: Record<Kind, string> = { movie: '53|80|9648|27', tv: '80|9648|10768' }
const LIGHT_SET = new Set([35, 10751, 16, 10762])

// A movie genre's closest TV genre, and back (TMDB's two lists differ).
const MOVIE_TO_TV: Record<number, number> = {
  28: 10759, 12: 10759, 16: 16, 35: 35, 80: 80, 99: 99, 18: 18, 10751: 10751, 14: 10765, 36: 18,
  27: 9648, 9648: 9648, 10749: 18, 878: 10765, 53: 80, 10752: 10768, 37: 37,
}
const TV_TO_MOVIE: Record<number, number> = {
  10759: 28, 16: 16, 35: 35, 80: 80, 99: 99, 18: 18, 10751: 10751, 10762: 10751, 9648: 9648,
  10763: 99, 10765: 878, 10766: 18, 10768: 10752, 37: 37,
}

/** The title's genres as the other kind's genres (for "as a series" / "as a film"). */
export function mapGenres(genreIds: number[], from: Kind): number[] {
  const table = from === 'movie' ? MOVIE_TO_TV : TV_TO_MOVIE
  return Array.from(new Set(genreIds.map((id) => table[id]).filter((id): id is number => id !== undefined)))
}

/** Keywords that say nothing about a story (they would match half the catalogue). */
const GENERIC_KEYWORDS = new Set([
  818, // based on novel or book
  9715, // superhero (it drags every Marvel film in)
  179431, // duringcreditsstinger
  179430, // aftercreditsstinger
  187056, // woman director
  9672, // based on true story
  158718, // lgbt
  9663, // sequel
  9748, // revenge
  6054, // friendship
  9826, // murder
  41645, // based on video game
  210024, // anime
])

/** The first four keywords that say something particular about this title. */
export function topKeywords(keywords: { id: number }[], limit = 4): number[] {
  return keywords.map((keyword) => keyword?.id).filter((id): id is number => typeof id === 'number' && !GENERIC_KEYWORDS.has(id)).slice(0, limit)
}

const dateField = (kind: Kind) => (kind === 'movie' ? 'primary_release_date' : 'first_air_date')

const common = (extra: Params = {}): Params => ({ include_adult: false, sort_by: 'vote_count.desc', ...extra })

/** The discover requests for a variation, closest first (at most 3). */
export function discoverAttempts(variation: Variation, facts: VariationFacts, keywordIds: number[], now: Date = new Date()): Attempt[] {
  const { kind, genreIds } = facts
  const keywords = keywordIds.slice(0, 4).join('|')
  const [g1, g2] = genreIds
  const both = g2 !== undefined ? `${g1},${g2}` : g1 !== undefined ? String(g1) : ''
  const either = [g1, g2].filter((id) => id !== undefined).join('|')
  const minVotes = kind === 'movie' ? 50 : 20

  /** Keywords, then both top genres, then either of them; each with the variation's own rule. */
  const ladder = (target: Kind, rule: Params, genres = { both, either }): Attempt[] => {
    const steps: Params[] = []
    if (keywords) steps.push({ with_keywords: keywords })
    if (genres.both) steps.push({ with_genres: genres.both })
    if (genres.either && genres.either !== genres.both) steps.push({ with_genres: genres.either })
    if (!steps.length) steps.push({})
    return steps.slice(0, 3).map((step) => ({ kind: target, params: common({ 'vote_count.gte': minVotes, ...rule, ...step }) }))
  }

  switch (variation) {
    case 'lighter': {
      const rule = { without_genres: '27,53' }
      const anchor = genreIds.find((id) => !LIGHT_SET.has(id) && (DARKNESS[id] ?? 0) < 2.5)
      const attempts: Attempt[] = []
      if (keywords) attempts.push({ kind, params: common({ 'vote_count.gte': minVotes, ...rule, with_genres: LIGHT_GENRES, with_keywords: keywords }) })
      if (anchor !== undefined) attempts.push({ kind, params: common({ 'vote_count.gte': minVotes, ...rule, with_genres: `${anchor},35` }) })
      attempts.push({ kind, params: common({ 'vote_count.gte': minVotes, ...rule, with_genres: LIGHT_GENRES }) })
      return attempts.slice(0, 3)
    }
    case 'darker': {
      const rule = { without_genres: '35,10751,16' }
      const dark = DARK_GENRES[kind]
      const anchor = genreIds.find((id) => !LIGHT_SET.has(id) && (DARKNESS[id] ?? 3) < 2.5)
      const attempts: Attempt[] = []
      if (keywords) attempts.push({ kind, params: common({ 'vote_count.gte': minVotes, ...rule, with_genres: dark, with_keywords: keywords }) })
      if (anchor !== undefined) attempts.push({ kind, params: common({ 'vote_count.gte': minVotes, ...rule, with_genres: `${anchor},${kind === 'movie' ? 53 : 80}` }) })
      attempts.push({ kind, params: common({ 'vote_count.gte': minVotes, ...rule, with_genres: dark }) })
      return attempts.slice(0, 3)
    }
    case 'shorter': {
      if (kind === 'movie') {
        const cap = shorterCap(facts.runtime ?? 120)
        return ladder('movie', { 'with_runtime.gte': 60, 'with_runtime.lte': cap })
      }
      return ladder('tv', { with_type: 2 })
    }
    case 'newer': {
      const since = newerSince(facts.year ?? now.getUTCFullYear(), now)
      return ladder(kind, { [`${dateField(kind)}.gte`]: `${since}-01-01` })
    }
    case 'older': {
      const before = olderBefore(facts.year ?? now.getUTCFullYear())
      return ladder(kind, { [`${dateField(kind)}.lte`]: `${before - 1}-12-31`, 'vote_count.gte': 200 })
    }
    case 'kind': {
      const target: Kind = kind === 'movie' ? 'tv' : 'movie'
      const mapped = mapGenres(genreIds, kind)
      const mappedBoth = mapped.slice(0, 2).join(',')
      const mappedEither = mapped.slice(0, 2).join('|')
      return ladder(target, { 'vote_count.gte': target === 'movie' ? 50 : 20 }, { both: mappedBoth, either: mappedEither })
    }
    case 'arab': {
      const countries = ARAB_TMDB_COUNTRIES.join('|')
      const rule = { 'vote_count.gte': 3 }
      const attempts: Attempt[] = []
      if (both) attempts.push({ kind, params: common({ ...rule, with_origin_country: countries, with_genres: both }) })
      if (either && either !== both) attempts.push({ kind, params: common({ ...rule, with_origin_country: countries, with_genres: either }) })
      attempts.push({ kind, params: common({ ...rule, with_original_language: 'ar', ...(either ? { with_genres: either } : {}) }) })
      if (!either) attempts.unshift({ kind, params: common({ ...rule, with_origin_country: countries }) })
      return attempts.slice(0, 3)
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Ranking

/** Jaccard similarity of two genre sets (0 when both are empty). */
export function jaccard(a: number[], b: number[]): number {
  const left = new Set(a)
  const right = new Set(b)
  if (!left.size && !right.size) return 0
  let common = 0
  left.forEach((id) => { if (right.has(id)) common++ })
  return common / (left.size + right.size - common)
}

/** The genres a variation's results are compared with: the title's, or their mapping for "as a…". */
export const referenceGenres = (variation: Variation, facts: VariationFacts) =>
  variation === 'kind' ? mapGenres(facts.genreIds, facts.kind) : facts.genreIds

/**
 * The results, once each (first seen wins), without the title itself, ranked by how many genres
 * they share with it (Jaccard), then by how many people voted.
 */
export function rankResults<T extends { id: number | string, genre_ids?: number[], vote_count?: number }>(items: T[], reference: number[], exclude?: { kind: Kind, id: string }, kind?: Kind): T[] {
  const seen = new Set<string>()
  const unique = items.filter((item) => {
    const key = String(item.id)
    if (seen.has(key)) return false
    seen.add(key)
    return !(exclude && kind === exclude.kind && key === exclude.id)
  })
  const scored = unique.map((item, index) => ({ item, index, score: jaccard(item.genre_ids ?? [], reference) }))
  scored.sort((a, b) => b.score - a.score || (b.item.vote_count ?? 0) - (a.item.vote_count ?? 0) || a.index - b.index)
  return scored.map((entry) => entry.item)
}

/** The tabs of the "More like this" section: Closest when it has titles, then the variations with their hint lines. */
export function similarTabs(closest: number, facts: VariationFacts, kids: boolean, locale: string, now: Date = new Date()): { id: VariationTab, hint: Phrase | null }[] {
  const variations = availableVariations(facts, kids, locale, now)
  if (!showsSimilar(closest, variations.length)) return []
  return [
    ...(closest > 0 ? [{ id: 'closest' as const, hint: null }] : []),
    ...variations.map((id) => ({ id, hint: variationHint(id, facts, now) })),
  ]
}
