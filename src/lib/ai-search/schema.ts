// What a plan may contain, checked twice:
// - a model's answer (sanitizeRawPlan): kept part by part, anything invalid or invented is dropped
//   (a span that isn't in the request, a range out of bounds, a code of the wrong shape);
// - a plan sent back by a browser (parsePlan, searchPlanSchema v1): all or nothing, a crafted
//   plan is refused.
// Country and language codes are also checked against TMDB's own lists by the route (resolve.ts).
import { z } from 'zod'
import { CAPS, GENRE_KEYS, MODEL_SORTS, RATING_BOUNDS, REGION_KEYS, RUNTIME_BOUNDS, SORTS, isRegionKey, isSortKey, yearBounds, type GenreKey, type SortKey } from './vocab'
import { decodePlan } from './plan-codec'
import { isOwnSpan } from './normalize'
import type { RawPlan, SearchPlan } from './types'

export const SCHEMA_VERSION = 1

const genreKey = z.enum(GENRE_KEYS as [GenreKey, ...GenreKey[]])
const id = z.number().int().positive().max(999_999_999)
const country = z.string().regex(/^[A-Z]{2}$/)
const language = z.string().regex(/^[a-z]{2}$/)

/** searchPlanSchema v1: a resolved plan (ids only), with its limits and ranges. */
export function searchPlanSchema(now = new Date()) {
  const years = yearBounds(now)
  const year = z.number().int().min(years.min).max(years.max)
  const minutes = z.number().int().min(RUNTIME_BOUNDS.min).max(RUNTIME_BOUNDS.max)
  const unique = <T>(values: T[]) => new Set(values).size === values.length
  return z.object({
    kind: z.enum(['movie', 'tv', 'any']),
    genres: z.array(genreKey).max(CAPS.genres).refine(unique),
    without: z.array(genreKey).max(CAPS.without).refine(unique),
    keywords: z.array(id).max(CAPS.keywords).refine(unique),
    places: z.array(id).max(CAPS.places).refine(unique),
    countries: z.array(country).max(CAPS.countries).refine(unique),
    regions: z.array(z.enum(REGION_KEYS as [string, ...string[]])).max(CAPS.regions).refine(unique),
    languages: z.array(language).max(CAPS.languages).refine(unique),
    people: z.array(id).max(CAPS.people).refine(unique),
    like: z.object({ type: z.enum(['movie', 'tv']), id }).strict().nullable(),
    years: z.object({ from: year.nullable(), to: year.nullable() }).strict().nullable()
      .refine((value) => !value || ((value.from != null || value.to != null) && (value.from == null || value.to == null || value.from <= value.to))),
    runtime: z.object({ min: minutes.nullable(), max: minutes.nullable() }).strict().nullable()
      .refine((value) => !value || ((value.min != null || value.max != null) && (value.min == null || value.max == null || value.min <= value.max))),
    minRating: z.number().min(RATING_BOUNDS.min).max(RATING_BOUNDS.max).nullable(),
    sort: z.enum(SORTS),
  }).strict()
    // A genre can't be both wanted and excluded.
    .refine((plan) => !plan.genres.some((genre) => plan.without.includes(genre)))
}

/** A plan string from a browser, fully checked; null when it isn't a valid v1 plan. */
export function parsePlan(p: unknown, now = new Date()): SearchPlan | null {
  const decoded = decodePlan(p)
  if (!decoded) return null
  const result = searchPlanSchema(now).safeParse(decoded)
  return result.success ? (result.data as SearchPlan) : null
}

// ---------------------------------------------------------------------------------------------
// The model's answer (and the simple parser's): sanitized part by part.

const text = (max: number) => z.string().trim().min(1).max(max)
const spanned = <T extends z.ZodRawShape>(shape: T) => z.object({ ...shape, span: text(80) })

const entry = {
  genre: spanned({ id: genreKey }),
  keyword: spanned({ term: text(40).regex(/^[\p{L}\p{N} '&().,-]+$/u) }),
  place: spanned({ name: text(40).regex(/^[\p{L}\p{N} '&().,-]+$/u) }),
  country: spanned({ code: z.string().trim() }),
  language: spanned({ code: z.string().trim().toLowerCase().pipe(language) }),
  person: spanned({ name: text(60).regex(/^[\p{L}\p{M} '.-]+$/u) }),
}

const optionalNumber = z.union([z.number(), z.null()]).catch(null)

/**
 * The model's (or the parser's) plan for `query`, keeping only what is valid and really asked:
 * every span must appear in the request, lists are cut to their limits, out-of-range values are
 * dropped. Null when `input` isn't a plan at all.
 */
export function sanitizeRawPlan(input: unknown, query: string, now = new Date()): RawPlan | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null
  const raw = input as Record<string, unknown>
  const own = (span: string) => isOwnSpan(query, span)

  // zod infers optional fields here (strictNullChecks is off): the parsed entries are cast to the
  // plan's types, which the schemas guarantee.
  const list = <S extends z.ZodTypeAny>(value: unknown, schema: S, cap: number, keep: (item: z.infer<S>) => boolean = () => true): z.infer<S>[] => {
    if (!Array.isArray(value)) return []
    const seen = new Set<string>()
    const out: z.infer<S>[] = []
    for (const candidate of value.slice(0, 24)) {
      const parsed = schema.safeParse(candidate)
      if (!parsed.success || !own(parsed.data.span) || !keep(parsed.data)) continue
      const key = JSON.stringify({ ...parsed.data, span: undefined })
      if (seen.has(key)) continue
      seen.add(key)
      out.push(parsed.data)
      if (out.length >= cap) break
    }
    return out
  }

  const bounds = yearBounds(now)
  const inYears = (value: number | null) => value == null || (Number.isInteger(value) && value >= bounds.min && value <= bounds.max)
  const inMinutes = (value: number | null) => value == null || (Number.isInteger(value) && value >= RUNTIME_BOUNDS.min && value <= RUNTIME_BOUNDS.max)

  const genres = list(raw.genres, entry.genre, CAPS.genres) as RawPlan['genres']
  const without = list(raw.without, entry.genre, CAPS.without, (item) => !genres.some((genre) => genre.id === item.id)) as RawPlan['without']

  // Countries: an ISO 3166-1 code (uppercase) or a region key.
  const countries = (list(raw.countries, entry.country, CAPS.countries + CAPS.regions, (item) => /^[A-Za-z]{2}$/.test(item.code) || isRegionKey(item.code)) as RawPlan['countries'])
    .map((item) => ({ ...item, code: isRegionKey(item.code) ? item.code : item.code.toUpperCase() }))

  let like: RawPlan['like'] = null
  const likeParsed = spanned({ title: text(80), year: optionalNumber }).safeParse(raw.like)
  if (likeParsed.success && own(likeParsed.data.span)) {
    const year = likeParsed.data.year
    like = { title: likeParsed.data.title, year: inYears(year) ? year : null, span: likeParsed.data.span }
  }

  let years: RawPlan['years'] = null
  const yearsParsed = spanned({ from: optionalNumber, to: optionalNumber }).safeParse(raw.years)
  if (yearsParsed.success && own(yearsParsed.data.span)) {
    const { from, to, span } = yearsParsed.data
    if ((from != null || to != null) && inYears(from) && inYears(to) && (from == null || to == null || from <= to)) years = { from, to, span }
  }

  let runtime: RawPlan['runtime'] = null
  const runtimeParsed = spanned({ min: optionalNumber, max: optionalNumber }).safeParse(raw.runtime)
  if (runtimeParsed.success && own(runtimeParsed.data.span)) {
    const { min, max, span } = runtimeParsed.data
    if ((min != null || max != null) && inMinutes(min) && inMinutes(max) && (min == null || max == null || min <= max)) runtime = { min, max, span }
  }

  let minRating: RawPlan['minRating'] = null
  const ratingParsed = spanned({ value: z.number() }).safeParse(raw.minRating)
  if (ratingParsed.success && own(ratingParsed.data.span)) {
    const value = Math.round(ratingParsed.data.value * 2) / 2
    if (value >= RATING_BOUNDS.min && value <= RATING_BOUNDS.max) minRating = { value, span: ratingParsed.data.span }
  }

  const sortName = typeof raw.sort === 'string' ? raw.sort : 'relevance'
  const sort: SortKey = (MODEL_SORTS as Record<string, SortKey>)[sortName] ?? (isSortKey(sortName) ? sortName : 'rel')

  const intent = raw.intent === 'title' || raw.intent === 'person' || raw.intent === 'unclear' ? raw.intent : 'discover'
  const title = typeof raw.title === 'string' && raw.title.trim() && own(raw.title) ? raw.title.trim().slice(0, 80) : null
  const kind = raw.kind === 'movie' || raw.kind === 'tv' ? raw.kind : 'any'
  const unmatched = Array.isArray(raw.unmatched)
    ? raw.unmatched.filter((word): word is string => typeof word === 'string' && word.trim().length > 0 && word.length <= 60 && own(word)).map((word) => word.trim()).slice(0, 4)
    : []

  return {
    intent,
    title,
    kind,
    genres,
    without,
    keywords: list(raw.keywords, entry.keyword, CAPS.keywords) as RawPlan['keywords'],
    places: list(raw.places, entry.place, CAPS.places) as RawPlan['places'],
    countries,
    languages: list(raw.languages, entry.language, CAPS.languages) as RawPlan['languages'],
    people: list(raw.people, entry.person, CAPS.people) as RawPlan['people'],
    like,
    years,
    runtime,
    minRating,
    sort,
    unmatched,
  }
}

/** Whether a raw plan asks for anything a search can use. */
export function rawHasFacets(plan: RawPlan): boolean {
  return plan.kind !== 'any' || plan.genres.length > 0 || plan.without.length > 0 || plan.keywords.length > 0 || plan.places.length > 0
    || plan.countries.length > 0 || plan.languages.length > 0 || plan.people.length > 0 || !!plan.like || !!plan.years || !!plan.runtime
    || plan.minRating != null || plan.sort !== 'rel'
}

