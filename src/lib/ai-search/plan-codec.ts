// A resolved plan as a short, readable URL value (`/search?mode=ask&q=…&p=…`):
//
//   k:m~g:comedy~y:1990-1999~s:top
//
// Parts are `key:value`, joined by '~'; lists use '.'. In this order (k always, the rest only when
// set): k kind (m films, t series, a both), g genres, x without genres, kw keyword ids, pl place
// keyword ids, c countries, rg regions, lg languages, p people ids, lk like (m550, t1396),
// y years (1990-1999, 1990-, -1999), rt runtime in minutes (90-120, -100, 140-), mr minimum
// rating, s sort (top, pop, new, old; relevance is the default).
//
// decodePlan only reads the shape; schema.ts (parsePlan) also checks limits and ranges, and the
// route checks codes and ids against TMDB. Client-safe.
import { isGenreKey, isRegionKey, isSortKey, type GenreKey, type RegionKey } from './vocab'
import type { PlanKind, SearchPlan } from './types'

export const MAX_PLAN_LENGTH = 400

export function emptyPlan(): SearchPlan {
  return {
    kind: 'any', genres: [], without: [], keywords: [], places: [], countries: [], regions: [], languages: [], people: [],
    like: null, years: null, runtime: null, minRating: null, sort: 'rel',
  }
}

const KINDS: Record<string, PlanKind> = { m: 'movie', t: 'tv', a: 'any' }
const KIND_CODES: Record<PlanKind, string> = { movie: 'm', tv: 't', any: 'a' }
const ORDER = ['k', 'g', 'x', 'kw', 'pl', 'c', 'rg', 'lg', 'p', 'lk', 'y', 'rt', 'mr', 's'] as const

const range = (from: number | null, to: number | null) => `${from ?? ''}-${to ?? ''}`
const formatRating = (value: number) => String(Math.round(value * 10) / 10)

/** The canonical string of a plan (the same plan always gives the same string). */
export function encodePlan(plan: SearchPlan): string {
  const parts: string[] = [`k:${KIND_CODES[plan.kind] ?? 'a'}`]
  const list = (key: string, values: (string | number)[]) => { if (values.length) parts.push(`${key}:${values.join('.')}`) }
  list('g', plan.genres)
  list('x', plan.without)
  list('kw', plan.keywords)
  list('pl', plan.places)
  list('c', plan.countries)
  list('rg', plan.regions)
  list('lg', plan.languages)
  list('p', plan.people)
  if (plan.like) parts.push(`lk:${plan.like.type === 'tv' ? 't' : 'm'}${plan.like.id}`)
  if (plan.years) parts.push(`y:${range(plan.years.from, plan.years.to)}`)
  if (plan.runtime) parts.push(`rt:${range(plan.runtime.min, plan.runtime.max)}`)
  if (plan.minRating != null) parts.push(`mr:${formatRating(plan.minRating)}`)
  if (plan.sort !== 'rel') parts.push(`s:${plan.sort}`)
  return parts.join('~')
}

const ID = /^[1-9]\d{0,8}$/
const ids = (value: string): number[] | null => {
  const items = value.split('.')
  return items.every((item) => ID.test(item)) ? items.map(Number) : null
}
const keys = <K extends string>(value: string, is: (v: unknown) => v is K): K[] | null => {
  const items = value.split('.')
  return items.every(is) ? (items as K[]) : null
}
const RANGE = /^(\d{1,4})?-(\d{1,4})?$/
const parseRange = (value: string): { from: number | null, to: number | null } | null => {
  const match = RANGE.exec(value)
  if (!match || (match[1] === undefined && match[2] === undefined)) return null
  return { from: match[1] === undefined ? null : Number(match[1]), to: match[2] === undefined ? null : Number(match[2]) }
}
const unique = (values: unknown[]) => new Set(values).size === values.length

/**
 * Reads a plan string; null when it isn't one (unknown or repeated parts, wrong shapes, parts out
 * of order are fine). Limits and ranges are schema.ts's job.
 */
export function decodePlan(p: unknown): SearchPlan | null {
  if (typeof p !== 'string' || !p || p.length > MAX_PLAN_LENGTH) return null
  const plan = emptyPlan()
  const seen = new Set<string>()
  for (const part of p.split('~')) {
    const colon = part.indexOf(':')
    if (colon < 1) return null
    const key = part.slice(0, colon)
    const value = part.slice(colon + 1)
    if (!value || seen.has(key) || !(ORDER as readonly string[]).includes(key)) return null
    seen.add(key)
    switch (key) {
      case 'k': {
        if (!Object.prototype.hasOwnProperty.call(KINDS, value)) return null
        plan.kind = KINDS[value]
        break
      }
      case 'g':
      case 'x': {
        const genres = keys<GenreKey>(value, isGenreKey)
        if (!genres || !unique(genres)) return null
        if (key === 'g') plan.genres = genres
        else plan.without = genres
        break
      }
      case 'kw':
      case 'pl':
      case 'p': {
        const list = ids(value)
        if (!list || !unique(list)) return null
        if (key === 'kw') plan.keywords = list
        else if (key === 'pl') plan.places = list
        else plan.people = list
        break
      }
      case 'c': {
        const codes = value.split('.')
        if (!codes.every((code) => /^[A-Z]{2}$/.test(code)) || !unique(codes)) return null
        plan.countries = codes
        break
      }
      case 'rg': {
        const regions = keys<RegionKey>(value, isRegionKey)
        if (!regions || !unique(regions)) return null
        plan.regions = regions
        break
      }
      case 'lg': {
        const codes = value.split('.')
        if (!codes.every((code) => /^[a-z]{2}$/.test(code)) || !unique(codes)) return null
        plan.languages = codes
        break
      }
      case 'lk': {
        const match = /^([mt])([1-9]\d{0,8})$/.exec(value)
        if (!match) return null
        plan.like = { type: match[1] === 't' ? 'tv' : 'movie', id: Number(match[2]) }
        break
      }
      case 'y':
      case 'rt': {
        const parsed = parseRange(value)
        if (!parsed) return null
        if (key === 'y') plan.years = parsed
        else plan.runtime = { min: parsed.from, max: parsed.to }
        break
      }
      case 'mr': {
        if (!/^\d(?:\.\d)?$/.test(value)) return null
        plan.minRating = Number(value)
        break
      }
      case 's': {
        if (!isSortKey(value) || value === 'rel') return null
        plan.sort = value
        break
      }
    }
  }
  return seen.has('k') ? plan : null
}

/** The chip ids of a plan, in the order chips are shown. */
export function chipIds(plan: SearchPlan): string[] {
  return [
    ...(plan.kind !== 'any' ? ['k'] : []),
    ...plan.genres.map((genre) => `g:${genre}`),
    ...(plan.like ? ['lk'] : []),
    ...plan.people.map((id) => `p:${id}`),
    ...plan.keywords.map((id) => `kw:${id}`),
    ...plan.places.map((id) => `pl:${id}`),
    ...plan.regions.map((region) => `rg:${region}`),
    ...plan.countries.map((code) => `c:${code}`),
    ...plan.languages.map((code) => `lg:${code}`),
    ...(plan.years ? ['y'] : []),
    ...(plan.runtime ? ['rt'] : []),
    ...(plan.minRating != null ? ['mr'] : []),
    ...plan.without.map((genre) => `x:${genre}`),
    ...(plan.sort !== 'rel' ? ['s'] : []),
  ]
}

/** The plan without the part a chip stands for (unchanged for an unknown chip). */
export function removeFacet(plan: SearchPlan, chipId: string): SearchPlan {
  const next: SearchPlan = {
    ...plan,
    genres: [...plan.genres], without: [...plan.without], keywords: [...plan.keywords], places: [...plan.places],
    countries: [...plan.countries], regions: [...plan.regions], languages: [...plan.languages], people: [...plan.people],
  }
  const colon = chipId.indexOf(':')
  const key = colon < 0 ? chipId : chipId.slice(0, colon)
  const value = colon < 0 ? '' : chipId.slice(colon + 1)
  switch (key) {
    case 'k': next.kind = 'any'; break
    case 'g': next.genres = next.genres.filter((genre) => genre !== value); break
    case 'x': next.without = next.without.filter((genre) => genre !== value); break
    case 'kw': next.keywords = next.keywords.filter((id) => String(id) !== value); break
    case 'pl': next.places = next.places.filter((id) => String(id) !== value); break
    case 'p': next.people = next.people.filter((id) => String(id) !== value); break
    case 'c': next.countries = next.countries.filter((code) => code !== value); break
    case 'rg': next.regions = next.regions.filter((region) => region !== value); break
    case 'lg': next.languages = next.languages.filter((code) => code !== value); break
    case 'lk': next.like = null; break
    case 'y': next.years = null; break
    case 'rt': next.runtime = null; break
    case 'mr': next.minRating = null; break
    case 's': next.sort = 'rel'; break
  }
  return next
}

/** Whether a plan asks for anything at all (beyond the defaults). */
export function hasFacets(plan: SearchPlan): boolean {
  return chipIds(plan).length > 0
}
