// A plan becomes titles. Only allow-listed TMDB discover parameters are ever sent, built from the
// plan's ids and keys. Several queries run (the full plan, then, when it finds little, the plan with
// one part relaxed, the "like" title's recommendations, a person's series), at most 14 calls and 6
// at a time; the candidates are merged and scored:
//
//   score = 10·coverage + 4·like + 3·bayes + 1.5·rank
//
// coverage: the share of the plan's parts a title matches (from the query that found it, and from
// its own data); like: how high it sits in the "like" title's recommendations; bayes: its rating
// weighted by its votes; rank: its best position in any query. Top 40 per page.
import 'server-only'
import { tmdbFetch } from '@/src/lib/tmdb'
import { catalogueLanguage } from '@/src/lib/tmdb-locale'
import type { Locale } from '@/src/lib/i18n/locales'
import { ARAB_REGIONS, GENRES, REGIONS, isArabCountryCode } from './vocab'
import type { AskItem, Kind, SearchPlan } from './types'

export const MAX_CALLS = 14
export const CONCURRENCY = 6
export const TOP = 40

type Facet = 'genres' | 'keywords' | 'places' | 'countries' | 'languages' | 'people' | 'years' | 'runtime' | 'rating'
type Params = Record<string, string | number | boolean | undefined>

/** Every discover parameter Ask may send. Anything else is dropped before the call. */
export const DISCOVER_PARAMS = new Set([
  'include_adult', 'page', 'language', 'sort_by', 'vote_count.gte', 'vote_average.gte', 'with_genres', 'without_genres', 'with_keywords',
  'with_origin_country', 'with_original_language', 'with_people', 'with_runtime.gte', 'with_runtime.lte',
  'primary_release_date.gte', 'primary_release_date.lte', 'first_air_date.gte', 'first_air_date.lte',
])

type Query = {
  kind: Kind
  path: string
  params: Params
  /** The plan parts every result of this query is known to match. */
  enforces: Facet[]
  /** Results resemble the "like" title: their "like" score is their position times this weight. */
  like?: number
  /** Results aren't filtered by TMDB (credits, recommendations): check the vote floor here. */
  raw?: boolean
}

/** The parts a plan asks for (what coverage is measured against). */
export function facetsOf(plan: SearchPlan): Facet[] {
  const facets: Facet[] = []
  if (plan.genres.length) facets.push('genres')
  if (plan.keywords.length) facets.push('keywords')
  if (plan.places.length) facets.push('places')
  if (plan.countries.length || plan.regions.length) facets.push('countries')
  if (plan.languages.length) facets.push('languages')
  if (plan.people.length) facets.push('people')
  if (plan.years) facets.push('years')
  if (plan.runtime) facets.push('runtime')
  if (plan.minRating != null) facets.push('rating')
  return facets
}

/** Arab films have few votes on TMDB: they get a much lower floor. */
export function isArabPlan(plan: SearchPlan): boolean {
  return plan.regions.some((region) => ARAB_REGIONS.includes(region)) || plan.countries.some(isArabCountryCode) || plan.languages.includes('ar')
}

/** The least votes a title needs: 50 for films, 30 for series, 5 for Arab titles (more for "best"). */
export function voteFloor(plan: SearchPlan, kind: Kind): number {
  if (isArabPlan(plan)) return 5
  if (plan.sort === 'top') return kind === 'movie' ? 300 : 150
  return kind === 'movie' ? 50 : 30
}

const originCountries = (plan: SearchPlan) => Array.from(new Set([...plan.countries, ...plan.regions.flatMap((region) => REGIONS[region])]))
const genreIds = (plan: SearchPlan, kind: Kind, keys = plan.genres) => keys.map((key) => GENRES[key][kind]).filter((id): id is number => id != null)
const today = () => new Date().toISOString().slice(0, 10)

/** The discover query for a kind, without the parts in `omit`. Pure (for the tests). */
export function discoverQuery(plan: SearchPlan, kind: Kind, o: {
  page: number
  locale: Locale
  omit?: Facet[]
  keywordsFrom?: 'keywords' | 'places'
  /** The "like" title's genres and keywords, to stay close to it. */
  anchor?: { genres: number[], keywords: number[] }
}): Query {
  const omit = new Set(o.omit ?? [])
  const enforces: Facet[] = []
  const date = kind === 'movie' ? 'primary_release_date' : 'first_air_date'
  const params: Params = {
    include_adult: false,
    page: o.page,
    language: catalogueLanguage(o.locale),
    'vote_count.gte': voteFloor(plan, kind),
  }
  const sorts = { rel: 'popularity.desc', pop: 'popularity.desc', top: 'vote_average.desc', new: `${date}.desc`, old: `${date}.asc` } as const
  params.sort_by = sorts[plan.sort]

  const genres = genreIds(plan, kind)
  if (!omit.has('genres') && genres.length) {
    params.with_genres = genres.join(',')
    if (genres.length === plan.genres.length) enforces.push('genres')
  }
  if (o.anchor?.genres.length) params.with_genres = Array.from(new Set([...(params.with_genres ? String(params.with_genres).split(',').map(Number) : []), ...o.anchor.genres.slice(0, 2)])).join(',')
  const without = genreIds(plan, kind, plan.without)
  if (without.length) params.without_genres = without.join(',')

  // Keywords and places are separate queries (TMDB can't mix AND and OR in one expression).
  const source = o.keywordsFrom ?? (plan.keywords.length ? 'keywords' : 'places')
  const keywordIds = source === 'keywords' ? plan.keywords : plan.places
  if (!omit.has(source) && keywordIds.length) {
    params.with_keywords = keywordIds.join('|')
    enforces.push(source)
  } else if (o.anchor?.keywords.length) {
    params.with_keywords = o.anchor.keywords.slice(0, 5).join('|')
  }
  const countries = originCountries(plan)
  if (!omit.has('countries') && countries.length) {
    params.with_origin_country = countries.join('|')
    enforces.push('countries')
  }
  if (!omit.has('languages') && plan.languages.length) {
    params.with_original_language = plan.languages.join('|')
    enforces.push('languages')
  }
  if (kind === 'movie' && !omit.has('people') && plan.people.length) {
    params.with_people = plan.people.join(',')
    enforces.push('people')
  }
  if (!omit.has('years') && plan.years) {
    if (plan.years.from != null) params[`${date}.gte`] = `${plan.years.from}-01-01`
    if (plan.years.to != null) params[`${date}.lte`] = `${plan.years.to}-12-31`
    enforces.push('years')
  }
  // "Newest first" never lists what isn't out yet.
  if (plan.sort === 'new') {
    const lte = params[`${date}.lte`]
    if (!lte || String(lte) > today()) params[`${date}.lte`] = today()
  }
  if (!omit.has('runtime') && plan.runtime) {
    if (plan.runtime.min != null) params['with_runtime.gte'] = plan.runtime.min
    if (plan.runtime.max != null) params['with_runtime.lte'] = plan.runtime.max
    enforces.push('runtime')
  }
  if (!omit.has('rating') && plan.minRating != null) {
    params['vote_average.gte'] = plan.minRating
    enforces.push('rating')
  }
  for (const name of Object.keys(params)) if (!DISCOVER_PARAMS.has(name)) delete params[name]
  return { kind, path: `discover/${kind}`, params, enforces, ...(o.anchor ? { like: 0.6 } : {}) }
}

type Candidate = { item: any, kind: Kind, proven: Set<Facet>, rank: number, like: number }

const yearOf = (item: any) => Number(String(item.release_date || item.first_air_date || '').slice(0, 4)) || null

/** How well a title matches one part of the plan, from its own data (0 to 1). */
function dataScore(facet: Facet, plan: SearchPlan, candidate: Candidate): number {
  const { item, kind } = candidate
  switch (facet) {
    case 'genres': {
      const ids: number[] = item.genre_ids ?? []
      const wanted = plan.genres.map((key) => GENRES[key][kind])
      return wanted.length ? wanted.filter((id) => id != null && ids.includes(id)).length / wanted.length : 1
    }
    case 'years': {
      const year = yearOf(item)
      if (!year || !plan.years) return 0
      return (plan.years.from == null || year >= plan.years.from) && (plan.years.to == null || year <= plan.years.to) ? 1 : 0
    }
    case 'rating': return (item.vote_average ?? 0) >= (plan.minRating ?? 0) ? 1 : 0
    case 'languages': return plan.languages.includes(item.original_language) ? 1 : 0
    case 'countries': {
      const wanted = new Set(originCountries(plan))
      return (item.origin_country ?? []).some((code: string) => wanted.has(code)) ? 1 : 0
    }
    default: return 0
  }
}

/** Bayesian average on 0..1: a 9 with 12 votes doesn't beat an 8 with 20,000. */
export function bayes(voteAverage: number, voteCount: number, kind: Kind, arab: boolean): number {
  const m = arab ? 10 : kind === 'tv' ? 80 : 150
  const prior = 6.3
  const v = Math.max(0, voteCount || 0)
  const score = (v / (v + m)) * (voteAverage || 0) + (m / (v + m)) * prior
  return Math.min(1, Math.max(0, (score - 5) / 4))
}

/** The score of a candidate (see the top of this file). */
export function scoreOf(coverage: number, like: number, bayesian: number, rank: number): number {
  return 10 * coverage + 4 * like + 3 * bayesian + 1.5 * rank
}

/**
 * Which kinds to search. "Like Inception" alone: films like it, not every popular series too. For
 * "any", a kind none of whose genres TMDB has (horror series) is left out.
 */
export function kindsFor(plan: SearchPlan): Kind[] {
  if (plan.kind !== 'any') return [plan.kind]
  if (plan.like && !facetsOf(plan).length) return [plan.like.type]
  const kinds = (['movie', 'tv'] as Kind[]).filter((kind) => !plan.genres.length || genreIds(plan, kind).length > 0)
  return kinds.length ? kinds : ['movie']
}

/** Runs tasks with at most `limit` at once. */
async function pool<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length)
  let next = 0
  const worker = async () => {
    while (next < tasks.length) {
      const index = next++
      results[index] = await tasks[index]()
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker))
  return results
}

/** TMDB answered none of the queries. */
export class CatalogueUnavailableError extends Error {
  constructor() {
    super('TMDB unavailable')
    this.name = 'CatalogueUnavailableError'
  }
}

const slim = (item: any, kind: Kind): AskItem => ({
  id: item.id,
  media_type: kind,
  ...(kind === 'movie' ? { title: item.title, release_date: item.release_date } : { name: item.name, first_air_date: item.first_air_date }),
  poster_path: item.poster_path ?? null,
  backdrop_path: item.backdrop_path ?? null,
  vote_average: item.vote_average ?? 0,
  genre_ids: item.genre_ids ?? [],
  overview: typeof item.overview === 'string' ? item.overview.slice(0, 240) : undefined,
})

// Talk shows, news and reality rarely mean "their series" when a person is asked for.
const NOT_A_ROLE = new Set([10763, 10764, 10767])

/** The plan's titles, page `page` (1 to 5). */
export async function executePlan(plan: SearchPlan, o: { locale: Locale, page: number }): Promise<{ items: AskItem[], hasMore: boolean, tryWithout: string | null }> {
  const page = Math.min(5, Math.max(1, Math.floor(o.page || 1)))
  const kinds = kindsFor(plan)
  const facets = facetsOf(plan)
  const arab = isArabPlan(plan)
  let calls = 0
  let answered = 0
  let hasMore = false
  const candidates = new Map<string, Candidate>()

  const run = async (queries: Query[], strict: boolean) => {
    const allowed = queries.slice(0, Math.max(0, MAX_CALLS - calls))
    calls += allowed.length
    const answers = await pool(allowed.map((query) => async () => {
      try {
        return { query, data: await tmdbFetch(query.path, query.params, 3600) }
      } catch (error) {
        console.error('ai execute:', query.path, error)
        return { query, data: null }
      }
    }), CONCURRENCY)
    for (const { query, data } of answers) {
      if (!data) continue
      answered += 1
      if (strict && (data.total_pages ?? 1) > page) hasMore = true
      const list: any[] = data.results ?? data.cast ?? []
      list.forEach((item, index) => {
        if (!item?.id || item.adult || !item.poster_path) return
        const kind = query.kind
        if (plan.like && plan.like.type === kind && plan.like.id === item.id) return
        if (query.raw && (item.vote_count ?? 0) < voteFloor(plan, kind)) return
        if (query.path.endsWith('_credits') && (item.genre_ids ?? []).some((id: number) => NOT_A_ROLE.has(id))) return
        const without = genreIds(plan, kind, plan.without)
        if ((item.genre_ids ?? []).some((id: number) => without.includes(id))) return
        const key = `${kind}-${item.id}`
        const rank = Math.max(0, 1 - index / 20)
        const existing = candidates.get(key)
        if (existing) {
          query.enforces.forEach((facet) => existing.proven.add(facet))
          existing.rank = Math.max(existing.rank, rank)
          if (query.like) existing.like = Math.max(existing.like, rank * query.like)
        } else {
          candidates.set(key, { item, kind, proven: new Set(query.enforces), rank, like: query.like ? rank * query.like : 0 })
        }
      })
    }
  }

  // What the "like" title is made of (its genres and keywords) keeps the search close to it.
  let anchor: { genres: number[], keywords: number[] } | null = null
  if (plan.like) {
    calls += 1
    try {
      const record = await tmdbFetch(`${plan.like.type}/${plan.like.id}`, { append_to_response: 'keywords' }, 86400)
      answered += 1
      anchor = {
        genres: (record?.genres ?? []).map((genre: any) => genre.id).filter(Number.isInteger),
        keywords: (record?.keywords?.keywords ?? record?.keywords?.results ?? []).map((keyword: any) => keyword.id).filter(Number.isInteger),
      }
    } catch (error) {
      console.error('ai execute: like title', error)
    }
  }

  // Round 1: the whole plan.
  const strict: Query[] = []
  for (const kind of kinds) {
    if (kind === 'tv' && plan.people.length) {
      // TMDB can't filter series by person: their credits, checked here.
      if (page === 1) for (const id of plan.people) strict.push({ kind, path: `person/${id}/tv_credits`, params: { language: catalogueLanguage(o.locale) }, enforces: ['people'], raw: true })
      continue
    }
    const near = anchor && plan.like?.type === kind ? anchor : undefined
    if (plan.keywords.length && plan.places.length) {
      strict.push(discoverQuery(plan, kind, { page, locale: o.locale, keywordsFrom: 'keywords', anchor: near }))
      strict.push(discoverQuery(plan, kind, { page, locale: o.locale, keywordsFrom: 'places', anchor: near }))
    } else {
      strict.push(discoverQuery(plan, kind, { page, locale: o.locale, anchor: near }))
    }
  }
  if (plan.like) {
    strict.push({ kind: plan.like.type, path: `${plan.like.type}/${plan.like.id}/recommendations`, params: { page, language: catalogueLanguage(o.locale) }, enforces: [], like: 1, raw: true })
  }
  await run(strict, true)

  // Round 2: too few? Relax one part at a time (the most specific first).
  if (candidates.size < 20) {
    const relaxed: Query[] = []
    if (plan.like) {
      relaxed.push({ kind: plan.like.type, path: `${plan.like.type}/${plan.like.id}/similar`, params: { page, language: catalogueLanguage(o.locale) }, enforces: [], like: 0.8, raw: true })
      // The plan without the anchor (its own parts only), when it has any.
      if (anchor && facets.length) relaxed.push(discoverQuery(plan, plan.like.type, { page, locale: o.locale }))
    }
    // Where a title comes from (country, language) is what people mean most: never relaxed.
    const order: Facet[] = ['keywords', 'places', 'years', 'runtime', 'rating', 'genres', 'people']
    // Relaxing the only part would list anything at all: never.
    for (const facet of facets.length > 1 ? order : []) {
      if (!facets.includes(facet)) continue
      for (const kind of kinds) {
        if (kind === 'tv' && plan.people.length && facet !== 'people') continue
        relaxed.push(discoverQuery(plan, kind, { page, locale: o.locale, omit: [facet] }))
      }
    }
    await run(relaxed, false)
  }

  if (calls > 0 && answered === 0) throw new CatalogueUnavailableError()

  const scored = Array.from(candidates.values()).map((candidate) => {
    const parts = facets.map((facet) => Math.max(candidate.proven.has(facet) ? 1 : 0, dataScore(facet, plan, candidate)))
    const coverage = parts.length ? parts.reduce((sum, part) => sum + part, 0) / parts.length : 1
    const score = scoreOf(coverage, candidate.like, bayes(candidate.item.vote_average, candidate.item.vote_count, candidate.kind, arab), candidate.rank)
    return { candidate, coverage, score }
  })
  // A relaxed result never outranks a full match it would push below the fold: coverage first for
  // the date orders, the score for the others.
  const date = (entry: (typeof scored)[number]) => String(entry.candidate.item.release_date || entry.candidate.item.first_air_date || '')
  const bucket = (coverage: number) => Math.round(coverage * 4)
  if (plan.sort === 'new' || plan.sort === 'old') {
    scored.sort((a, b) => bucket(b.coverage) - bucket(a.coverage) || (plan.sort === 'new' ? date(b).localeCompare(date(a)) : date(a).localeCompare(date(b))))
  } else {
    scored.sort((a, b) => b.score - a.score)
  }
  const items = scored.slice(0, TOP).map((entry) => slim(entry.candidate.item, entry.candidate.kind))
  return { items, hasMore: hasMore && items.length > 0, tryWithout: items.length ? null : tryWithout(plan) }
}

/** For an empty answer: the chip whose removal most likely brings titles back. */
export function tryWithout(plan: SearchPlan): string | null {
  if (plan.keywords.length) return `kw:${plan.keywords[0]}`
  if (plan.places.length) return `pl:${plan.places[0]}`
  if (plan.people.length) return `p:${plan.people[0]}`
  if (plan.years) return 'y'
  if (plan.runtime) return 'rt'
  if (plan.minRating != null) return 'mr'
  if (plan.languages.length) return `lg:${plan.languages[0]}`
  if (plan.countries.length) return `c:${plan.countries[0]}`
  if (plan.regions.length) return `rg:${plan.regions[0]}`
  if (plan.genres.length > 1) return `g:${plan.genres[plan.genres.length - 1]}`
  if (plan.like) return 'lk'
  return null
}
