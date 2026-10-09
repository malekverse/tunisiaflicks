// From words to TMDB ids, and from ids back to the words people see.
// - resolveRaw: a meaning (RawPlan) becomes a SearchPlan; keyword terms, people and the "like"
//   title are looked up on TMDB, codes are checked against TMDB's own lists. What can't be found
//   becomes a notice in the person's own words (the span), never in the model's.
// - checkPlan + chipsFor: a plan sent back by a browser is re-checked (every code and id must exist)
//   and its labels are rebuilt from the ids, so nothing typed elsewhere ends up on screen.
import 'server-only'
import { TmdbError, tmdbFetch } from '@/src/lib/tmdb'
import { catalogueLanguage } from '@/src/lib/tmdb-locale'
import { genreNames } from '@/src/lib/genres'
import { createTranslator, isArabicScript, type Locale, type TKey } from '@/src/lib/i18n'
import { languageName, regionName } from '@/src/lib/i18n/format'
import { chipIds, emptyPlan } from './plan-codec'
import { CAPS, KEYWORD_LABELS, genreLabelId, isRegionKey, yearBounds, type GenreKey, type RegionKey } from './vocab'
import { normalizeQuery } from './normalize'
import type { AskChip, AskNotice, Kind, RawPlan, SearchPlan } from './types'

/** A plan sent by a browser that doesn't hold up (unknown code or id). */
export class InvalidPlanError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidPlanError'
  }
}

const WEEK = 7 * 24 * 3600

/** Names found for ids while resolving, so chips need no second lookup. */
export type Names = { keywords: Map<number, string>, people: Map<number, string>, like: string | null }
const noNames = (): Names => ({ keywords: new Map(), people: new Map(), like: null })

// ---------------------------------------------------------------------------------------------
// TMDB's country and language lists

let codes: Promise<{ countries: Set<string>, languages: Set<string> } | null> | null = null

/** TMDB's ISO 3166-1 and ISO 639-1 lists (a week in the data cache). Null when unreachable. */
async function tmdbCodes() {
  codes ??= Promise.all([
    tmdbFetch<{ iso_3166_1: string }[]>('configuration/countries', {}, WEEK),
    tmdbFetch<{ iso_639_1: string }[]>('configuration/languages', {}, WEEK),
  ]).then(([countries, languages]) => ({
    countries: new Set(countries.map((entry) => entry.iso_3166_1?.toUpperCase()).filter(Boolean)),
    languages: new Set(languages.map((entry) => entry.iso_639_1?.toLowerCase()).filter(Boolean)),
  })).catch((error) => {
    console.error('TMDB configuration lists:', error)
    codes = null
    return null
  })
  return codes
}

/** Whether TMDB knows a country (the browser's own list when TMDB can't be reached). */
async function knownCountry(code: string): Promise<boolean> {
  if (!/^[A-Z]{2}$/.test(code)) return false
  const lists = await tmdbCodes()
  return lists ? lists.countries.has(code) : !!regionName(code, 'en')
}

async function knownLanguage(code: string): Promise<boolean> {
  if (!/^[a-z]{2}$/.test(code)) return false
  const lists = await tmdbCodes()
  return lists ? lists.languages.has(code) : !!languageName(code, 'en')
}

// ---------------------------------------------------------------------------------------------
// Lookups by words

/** A TMDB keyword for a term: the exact name, else the closest of the first results. */
async function findKeyword(term: string): Promise<{ id: number, name: string } | null> {
  try {
    const data = await tmdbFetch('search/keyword', { query: term }, WEEK)
    const results: { id: number, name: string }[] = data?.results ?? []
    const wanted = normalizeQuery(term)
    const exact = results.find((result) => normalizeQuery(result.name) === wanted)
    if (exact) return { id: exact.id, name: exact.name }
    const close = results.slice(0, 5).find((result) => {
      const name = normalizeQuery(result.name)
      return name.startsWith(`${wanted} `) || name.startsWith(wanted) || wanted.startsWith(name)
    })
    return close ? { id: close.id, name: close.name } : null
  } catch {
    return null
  }
}

/** The best-known person by that name. */
async function findPerson(name: string): Promise<{ id: number, name: string } | null> {
  try {
    const data = await tmdbFetch('search/person', { query: name, include_adult: false }, WEEK)
    const person = (data?.results ?? []).find((result: any) => result?.id && result.name)
    return person ? { id: person.id, name: person.name } : null
  } catch {
    return null
  }
}

/** The film or series a request compares to (its year, when given, wins among the first results). */
async function findTitle(title: string, year: number | null, kind: RawPlan['kind'], locale: Locale): Promise<{ type: Kind, id: number, title: string } | null> {
  try {
    const data = await tmdbFetch('search/multi', { query: title, include_adult: false, language: catalogueLanguage(locale) }, WEEK)
    const candidates = (data?.results ?? []).filter((result: any) =>
      (result.media_type === 'movie' || result.media_type === 'tv') && (kind === 'any' || result.media_type === kind))
    const dated = year ? candidates.slice(0, 6).find((result: any) => (result.release_date || result.first_air_date || '').startsWith(String(year))) : null
    const best = dated ?? candidates[0]
    return best ? { type: best.media_type, id: best.id, title: best.title || best.name } : null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------------------------
// Lookups by id (a browser's plan)

async function byId<T>(path: string, params: Record<string, string | undefined> = {}): Promise<T> {
  try {
    return await tmdbFetch<T>(path, params, WEEK)
  } catch (error) {
    if (error instanceof TmdbError && (error.status === 404 || error.status === 400)) throw new InvalidPlanError(`unknown ${path}`)
    throw error
  }
}

/**
 * Checks a browser's plan against TMDB (every code and id must exist) and gets the names its
 * chips need. Throws InvalidPlanError for a plan that doesn't hold up; other errors mean TMDB is
 * unreachable.
 */
export async function checkPlan(plan: SearchPlan, locale: Locale): Promise<Names> {
  const [countriesOk, languagesOk] = await Promise.all([
    Promise.all(plan.countries.map(knownCountry)),
    Promise.all(plan.languages.map(knownLanguage)),
  ])
  if (countriesOk.includes(false) || languagesOk.includes(false)) throw new InvalidPlanError('unknown code')
  const names = noNames()
  await Promise.all([
    ...[...plan.keywords, ...plan.places].map(async (id) => {
      const keyword = await byId<{ id: number, name: string }>(`keyword/${id}`)
      if (!keyword?.name) throw new InvalidPlanError('unknown keyword')
      names.keywords.set(id, keyword.name)
    }),
    ...plan.people.map(async (id) => {
      const person = await byId<{ name: string }>(`person/${id}`)
      if (!person?.name) throw new InvalidPlanError('unknown person')
      names.people.set(id, person.name)
    }),
    (async () => {
      if (!plan.like) return
      const record = await byId<{ title?: string, name?: string }>(`${plan.like.type}/${plan.like.id}`, { language: catalogueLanguage(locale) })
      const title = record?.title || record?.name
      if (!title) throw new InvalidPlanError('unknown title')
      names.like = title
    })(),
  ])
  return names
}

// ---------------------------------------------------------------------------------------------
// A meaning becomes a plan

const NOT_WORTH_A_NOTICE = new Set('a an the and or of to in for with me i some something film films movie movies series show shows un une des le la les de du et ou فيلم افلام مسلسل و في من على'.split(' ').map(normalizeQuery))

/** Turns a meaning into a plan (TMDB lookups in parallel), with notices for what couldn't be used. */
export async function resolveRaw(raw: RawPlan, locale: Locale): Promise<{ plan: SearchPlan, names: Names, notices: AskNotice[] }> {
  const plan = emptyPlan()
  const names = noNames()
  const unmatched: string[] = [...raw.unmatched]

  plan.kind = raw.kind
  plan.genres = raw.genres.map((genre) => genre.id)
  plan.without = raw.without.map((genre) => genre.id).filter((genre) => !plan.genres.includes(genre))
  plan.sort = raw.sort
  plan.minRating = raw.minRating?.value ?? null
  plan.years = raw.years ? { from: raw.years.from, to: raw.years.to } : null
  plan.runtime = raw.runtime ? { min: raw.runtime.min, max: raw.runtime.max } : null

  const [countries, languages, keywords, places, people, like] = await Promise.all([
    Promise.all(raw.countries.map(async (entry) => (isRegionKey(entry.code) ? entry.code : (await knownCountry(entry.code)) ? entry.code : null))),
    Promise.all(raw.languages.map(async (entry) => ((await knownLanguage(entry.code)) ? entry.code : null))),
    Promise.all(raw.keywords.map((entry) => findKeyword(entry.term))),
    Promise.all(raw.places.map((entry) => findKeyword(entry.name))),
    Promise.all(raw.people.map((entry) => findPerson(entry.name))),
    raw.like ? findTitle(raw.like.title, raw.like.year, raw.kind, locale) : Promise.resolve(null),
  ])

  for (const code of countries) {
    if (!code) continue
    if (isRegionKey(code)) {
      if (!plan.regions.includes(code) && plan.regions.length < CAPS.regions) plan.regions.push(code as RegionKey)
    } else if (!plan.countries.includes(code) && plan.countries.length < CAPS.countries) {
      plan.countries.push(code)
    }
  }
  plan.languages = Array.from(new Set(languages.filter((code): code is string => !!code))).slice(0, CAPS.languages)

  keywords.forEach((keyword, index) => {
    if (!keyword) return unmatched.push(raw.keywords[index].span)
    if (!plan.keywords.includes(keyword.id) && plan.keywords.length < CAPS.keywords) plan.keywords.push(keyword.id)
    names.keywords.set(keyword.id, keyword.name)
  })
  places.forEach((place, index) => {
    if (!place) return unmatched.push(raw.places[index].span)
    if (!plan.places.includes(place.id) && !plan.keywords.includes(place.id) && plan.places.length < CAPS.places) plan.places.push(place.id)
    names.keywords.set(place.id, place.name)
  })
  people.forEach((person, index) => {
    if (!person) return unmatched.push(raw.people[index].span)
    if (!plan.people.includes(person.id) && plan.people.length < CAPS.people) plan.people.push(person.id)
    names.people.set(person.id, person.name)
  })

  const notices: AskNotice[] = []
  if (raw.like) {
    if (like) {
      plan.like = { type: like.type, id: like.id }
      names.like = like.title
    } else {
      notices.push({ code: 'likeNotFound', title: raw.like.span })
    }
  }

  const words = Array.from(new Set(unmatched.map((word) => word.trim()).filter((word) => {
    const normalized = normalizeQuery(word)
    return normalized.length > 2 && !NOT_WORTH_A_NOTICE.has(normalized)
  }))).slice(0, 3)
  if (words.length) notices.push({ code: 'unmatched', words })
  return { plan, names, notices }
}

// ---------------------------------------------------------------------------------------------
// Chips

const DECADES = new Set([1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020])

/** The genre's name in the viewer's language (lowercase inside a sentence in Latin scripts). */
function genreName(key: GenreKey, locale: Locale, inSentence = false): string {
  const name = genreNames([genreLabelId(key)], locale, 1)[0] ?? key
  return inSentence && !isArabicScript(locale) ? name.toLowerCase() : name
}

/** A keyword's name: our translation for the common ones, else TMDB's (capitalized). */
function keywordLabel(name: string, locale: Locale): string {
  const known = KEYWORD_LABELS[name.toLowerCase()]
  if (known && locale === 'fr') return known.fr
  if (known && isArabicScript(locale)) return known.ar
  const clean = name.replace(/\s*\(.*?\)\s*/g, ' ').replace(/,.*$/, '').trim() || name
  return clean.charAt(0).toUpperCase() + clean.slice(1)
}

const ratingText = (value: number, locale: Locale) => new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', { maximumFractionDigits: 1 }).format(value)

/** The chips of a plan, in its order, labelled in the viewer's language from ids only. */
export function chipsFor(plan: SearchPlan, names: Names, locale: Locale): AskChip[] {
  const t = createTranslator(locale)
  const label = (id: string): string => {
    const colon = id.indexOf(':')
    const key = colon < 0 ? id : id.slice(0, colon)
    const value = colon < 0 ? '' : id.slice(colon + 1)
    switch (key) {
      case 'k': return t(plan.kind === 'tv' ? 'ai.chip.tv' : 'ai.chip.movie')
      case 'g': return genreName(value as GenreKey, locale)
      case 'x': return t('ai.chip.without', { genre: genreName(value as GenreKey, locale, true) })
      case 'kw':
      case 'pl': return keywordLabel(names.keywords.get(Number(value)) ?? value, locale)
      case 'p': return names.people.get(Number(value)) ?? value
      case 'c': return regionName(value, locale) ?? value
      case 'rg': return t(`ai.region.${value}` as TKey)
      case 'lg': {
        const name = languageName(value, locale) ?? value
        return t('ai.chip.language', { language: locale === 'fr' ? name.toLowerCase() : name })
      }
      case 'lk': return t('ai.chip.like', { title: names.like ?? '' })
      case 'y': {
        const { from, to } = plan.years!
        if (from != null && to != null && from === to) return String(from)
        if (from != null && to != null && DECADES.has(from) && (to === from + 9 || (from + 9 > yearBounds().max && to === yearBounds().max))) return t(`ai.decade.${from}` as TKey)
        if (from != null && to != null) return t('ai.chip.years', { from, to })
        return from != null ? t('ai.chip.from', { year: from }) : t('ai.chip.until', { year: to! })
      }
      case 'rt': {
        const { min, max } = plan.runtime!
        if (min != null && max != null) return t('ai.chip.runtime', { min, max })
        return max != null ? t('ai.chip.shorter', { minutes: max }) : t('ai.chip.longer', { minutes: min! })
      }
      case 'mr': return t('ai.chip.rating', { rating: ratingText(plan.minRating!, locale) })
      case 's': return t(plan.sort === 'top' ? 'ai.chip.top' : plan.sort === 'pop' ? 'ai.chip.popular' : plan.sort === 'new' ? 'ai.chip.new' : 'ai.chip.old')
      default: return id
    }
  }
  return chipIds(plan).map((id) => ({ id, label: label(id) }))
}
