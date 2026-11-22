// Blind date with a film (/blind-date): like a bookshop's wrapped books, three films come with their
// hints only (the mood, the length, the decade, where they're from, a line of the story with the
// title blacked out). You commit to one, then it's unwrapped. These are the pure rules (tests in
// tests/blind-date.unit.test.mts): the choices and the TMDB discover request they make.

export type Mood = 'any' | 'laugh' | 'thrill' | 'feel' | 'think' | 'escape' | 'scared' | 'cosy' | 'love'
export type Length = 'any' | 'short' | 'long'
export type Era = 'any' | 'classic' | 'modern' | 'recent'
export type Origin = 'any' | 'arab' | 'europe' | 'asia' | 'latin'

export type Wishes = { mood: Mood, length: Length, era: Era, origin: Origin }

export const MOODS: Mood[] = ['any', 'laugh', 'thrill', 'feel', 'think', 'escape', 'cosy', 'love', 'scared']
export const LENGTHS: Length[] = ['any', 'short', 'long']
export const ERAS: Era[] = ['any', 'classic', 'modern', 'recent']
export const ORIGINS: Origin[] = ['any', 'arab', 'europe', 'asia', 'latin']

/** Not for a Kids profile. */
export const GROWN_UP_MOODS = new Set<Mood>(['scared', 'love', 'thrill'])

// TMDB genres: "|" is any of them.
const MOOD_GENRES: Record<Exclude<Mood, 'any'>, string> = {
  laugh: '35',
  thrill: '53|80',
  feel: '18',
  think: '9648|878',
  escape: '12|14',
  cosy: '10751|16',
  love: '10749',
  scared: '27',
}

const ORIGIN_LANGUAGES: Record<Exclude<Origin, 'any'>, string> = {
  arab: 'ar',
  europe: 'fr|es|it|de|sv|da|no|pl|pt|nl',
  asia: 'ko|ja|zh|cn|hi|th|ta|te',
  latin: 'es|pt',
}

export const DEFAULT_WISHES: Wishes = { mood: 'any', length: 'any', era: 'any', origin: 'any' }

const pick = <T extends string>(value: unknown, options: readonly T[], fallback: T): T => (options.includes(value as T) ? value as T : fallback)

/** Wishes as sent by the page, anything unknown back to "any". */
export function cleanWishes(raw: unknown): Wishes {
  const value = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return {
    mood: pick(value.mood, MOODS, 'any'),
    length: pick(value.length, LENGTHS, 'any'),
    era: pick(value.era, ERAS, 'any'),
    origin: pick(value.origin, ORIGINS, 'any'),
  }
}

type Params = Record<string, string | number | boolean>

/**
 * The discover/movie request for these wishes: films people liked (rated 6.8 and up), known enough
 * to be worth a date but not only the blockbusters. Films from smaller cinemas need fewer votes.
 */
export function discoverParams(wishes: Wishes, kids = false): Params {
  const params: Params = {
    include_adult: false,
    sort_by: 'popularity.desc',
    'vote_average.gte': wishes.origin === 'any' ? 6.8 : 6.4,
    'vote_count.gte': wishes.origin === 'any' ? 400 : wishes.origin === 'arab' ? 15 : 80,
    // Not documentaries, not TV films.
    without_genres: '99,10770',
  }
  if (wishes.mood !== 'any' && !(kids && GROWN_UP_MOODS.has(wishes.mood))) params.with_genres = MOOD_GENRES[wishes.mood]
  if (wishes.length === 'short') params['with_runtime.lte'] = 100
  if (wishes.length === 'long') params['with_runtime.gte'] = 140
  else params['with_runtime.gte'] = 70
  if (wishes.era === 'classic') params['primary_release_date.lte'] = '1999-12-31'
  if (wishes.era === 'modern') {
    params['primary_release_date.gte'] = '2000-01-01'
    params['primary_release_date.lte'] = '2015-12-31'
  }
  if (wishes.era === 'recent') params['primary_release_date.gte'] = '2016-01-01'
  if (wishes.origin !== 'any') params.with_original_language = ORIGIN_LANGUAGES[wishes.origin]
  if (wishes.origin === 'latin') params.with_origin_country = 'MX|AR|BR|CO|CL|PE|UY|CU'
  return params
}

/** Which page of results to take: any of the first `limit`, avoiding the ones already used. */
export function pagesToTry(totalPages: number, randomInt: (max: number) => number, limit = 15): number[] {
  const last = Math.max(1, Math.min(totalPages, limit))
  const pages = Array.from({ length: last }, (_, index) => index + 1)
  for (let index = pages.length - 1; index > 0; index--) {
    const other = randomInt(index + 1)
    ;[pages[index], pages[other]] = [pages[other], pages[index]]
  }
  return pages
}

/** "1 h 52" style parts, for the length hint. */
export const runtimeParts = (minutes: number) => ({ hours: Math.floor(minutes / 60), minutes: minutes % 60 })
