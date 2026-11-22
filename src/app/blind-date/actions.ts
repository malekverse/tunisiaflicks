'use server'

import clientPromise from '@/src/lib/mongodb'
import { tmdbFetchSafe } from '@/src/lib/tmdb'
import { kidsDiscoverParams } from '@/src/lib/kids'
import { getActiveProfile, getKidsMode } from '@/src/lib/profiles'
import { getLocale } from '@/src/lib/i18n/server'
import { localizeDetail, translatedRecord } from '@/src/lib/tmdb-locale'
import { cleanWishes, discoverParams, pagesToTry } from '@/src/lib/blind-date'
import { cryptoInt, shuffle } from '@/src/lib/decide'
import { maskTitle, storyLine, type Segment } from '@/src/lib/guess'

/** A wrapped film: its hints, and (for after it's chosen) what it is. */
export type BlindDate = {
  id: number
  title: string
  original_title: string
  year: number | null
  poster_path: string | null
  backdrop_path: string | null
  runtime: number | null
  genres: number[]
  countries: string[]
  language: string
  rating: number
  hint: Segment[] | null
}

const DAY = 86400

/** The films this profile already watched (signed-in only): no date with a film you've seen. */
async function watchedFilms(): Promise<Set<number>> {
  try {
    const active = await getActiveProfile()
    if (!active?.profile) return new Set()
    const db = (await clientPromise).db()
    const doc = await db.collection('userContent').findOne({ userId: active.userId, profileId: active.profile.id, type: 'history' }, { projection: { items: 1 } })
    return new Set(((doc?.items ?? []) as { id?: unknown, media_type?: unknown }[])
      .filter((item) => item.media_type === 'movie')
      .map((item) => Number(item.id))
      .filter(Number.isInteger))
  } catch {
    return new Set()
  }
}

async function wrap(id: number): Promise<BlindDate | null> {
  const locale = getLocale()
  const [film, translated] = await Promise.all([
    tmdbFetchSafe<any>(`movie/${id}`, {}, DAY),
    translatedRecord('movie', String(id), locale, DAY),
  ])
  if (!film?.id) return null
  const shown = localizeDetail(film, translated, locale)
  const titles = [film.title, film.original_title, translated?.title].filter((value): value is string => typeof value === 'string' && !!value)
  // The tagline in the page's language (English, or French when TMDB has one), else the story's first line.
  const tagline = locale === 'en' ? film.tagline : locale === 'fr' ? shown.tagline : ''
  const line = (typeof tagline === 'string' && tagline.trim()) || storyLine(shown.overview || film.overview || '', 170)
  const year = typeof film.release_date === 'string' && /^\d{4}/.test(film.release_date) ? Number(film.release_date.slice(0, 4)) : null
  return {
    id: film.id,
    title: shown.title || film.title,
    original_title: film.original_title || film.title,
    year,
    poster_path: shown.poster_path || film.poster_path || null,
    backdrop_path: film.backdrop_path ?? null,
    runtime: Number.isInteger(film.runtime) && film.runtime > 0 ? film.runtime : null,
    genres: (film.genres ?? []).map((genre: any) => genre.id).filter(Number.isInteger),
    countries: (film.origin_country?.length ? film.origin_country : (film.production_countries ?? []).map((country: any) => country.iso_3166_1)).filter((code: unknown) => typeof code === 'string').slice(0, 2),
    language: typeof film.original_language === 'string' ? film.original_language : '',
    rating: Math.round((film.vote_average ?? 0) * 10) / 10,
    hint: line ? maskTitle(line, titles) : null,
  }
}

/**
 * `count` wrapped films for these wishes: well-liked films (TMDB discover, a random page of the
 * first few), none the profile already watched and none of `exclude` (already on the table).
 * Kids profiles: kid-safe only; Halal mode filters the list in tmdbFetch. An empty list: nothing
 * matches the wishes; null: TMDB didn't answer.
 */
export async function getBlindDates(rawWishes: unknown, rawExclude: unknown, count = 3): Promise<BlindDate[] | null> {
  const wishes = cleanWishes(rawWishes)
  const exclude = new Set((Array.isArray(rawExclude) ? rawExclude : []).slice(0, 300).map(Number).filter(Number.isInteger))
  const want = Math.max(1, Math.min(3, Math.floor(count)))
  const kids = await getKidsMode()
  const base = discoverParams(wishes, kids)
  const params = kids ? kidsDiscoverParams('movie', base) : base
  const [seen, first] = await Promise.all([watchedFilms(), tmdbFetchSafe<{ results?: any[], total_pages?: number }>('discover/movie', { ...params, page: 1 }, DAY)])
  if (!first) return null

  const pool: number[] = []
  const take = (results: any[] | undefined) => {
    for (const film of results ?? []) {
      if (Number.isInteger(film?.id) && film.poster_path && film.overview && !film.adult && !exclude.has(film.id) && !seen.has(film.id) && !pool.includes(film.id)) pool.push(film.id)
    }
  }
  const pages = pagesToTry(first.total_pages ?? 1, cryptoInt)
  for (const page of pages.slice(0, 4)) {
    take(page === 1 ? first.results : (await tmdbFetchSafe<{ results?: any[] }>('discover/movie', { ...params, page }, DAY))?.results)
    if (pool.length >= want * 4) break
  }
  if (!pool.length) return []

  const order = shuffle(pool, cryptoInt)
  const dates = (await Promise.all(order.slice(0, want).map(wrap))).filter((date): date is BlindDate => !!date)
  // One that TMDB lost: the next in line.
  for (const id of order.slice(want)) {
    if (dates.length >= want) break
    const date = await wrap(id)
    if (date) dates.push(date)
  }
  return dates
}
