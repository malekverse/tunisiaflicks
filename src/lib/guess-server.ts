// The puzzles of "Guess the film" (/guess): which film a day gets, locked in the database the first
// time someone asks (so a past day never changes, whatever TMDB's lists do later), and the clues
// built from TMDB in the player's language. Everything is shared (no viewer): /api/guess/[day]
// answers are cached by the CDN, so a day's puzzle costs one function call per language and pool.
import 'server-only'
import clientPromise from '@/src/lib/mongodb'
import { tmdbFetchSafe } from '@/src/lib/tmdb'
import { kidsDiscoverParams } from '@/src/lib/kids'
import {
  dayNumber, decadeOf, focalPoint, maskTitle, pickIndex, puzzleNumber, storyLine, wrapAnswer,
  type GuessLanguage, type GuessPool, type Segment,
} from '@/src/lib/guess'

const WEEK = 7 * 86400

type Params = Record<string, string | number | boolean | undefined>

// The well-known films (by votes): the ones most people have a chance of naming.
const MOVIE_POOL: Params = { sort_by: 'vote_count.desc', 'vote_count.gte': 2500, include_adult: false, without_genres: '99,10770' }
const POOLS: Record<GuessPool, { pages: number, params: Params }> = {
  all: { pages: 25, params: MOVIE_POOL },
  halal: { pages: 25, params: MOVIE_POOL },
  kids: { pages: 10, params: kidsDiscoverParams('movie', { sort_by: 'vote_count.desc', 'vote_count.gte': 800, without_genres: '27,53,80,10752,99,10770' }) },
}

type PuzzleDoc = { _id: string, pool: GuessPool, day: string, tmdbId: number, createdAt: Date }

let indexReady: Promise<unknown> | null = null
async function puzzles() {
  const collection = (await clientPromise).db().collection<PuzzleDoc>('guessPuzzles')
  indexReady ??= collection.createIndex({ pool: 1 }).catch((error) => {
    indexReady = null
    console.error('guessPuzzles index:', error)
  })
  await indexReady
  return collection
}

/** The pool's films, most voted first (the music game draws from them too). */
export async function poolFilms(pool: GuessPool): Promise<number[]> {
  const { pages, params } = POOLS[pool]
  const results: any[] = []
  for (let start = 1; start <= pages; start += 5) {
    const batch = await Promise.all(Array.from({ length: Math.min(5, pages - start + 1) }, (_, offset) =>
      tmdbFetchSafe<{ results?: any[], total_pages?: number }>('discover/movie', { ...params, page: start + offset }, WEEK, { shared: true })))
    for (const page of batch) results.push(...(page?.results ?? []))
    if (batch.some((page) => (page?.total_pages ?? 0) < start + 4)) break
  }
  let films = results.filter((film) => Number.isInteger(film?.id) && film.poster_path && film.backdrop_path && !film.adult)
  if (pool === 'halal') {
    const { filterHalal } = await import('@/src/lib/halal')
    films = await filterHalal(films, 'movie', { on: true })
  }
  const seen = new Set<number>()
  return films.flatMap((film) => (seen.has(film.id) ? [] : (seen.add(film.id), [film.id as number])))
}

/** The day's film: the one locked in, or else chosen now (the first writer wins). */
export async function puzzleFilm(day: string, pool: GuessPool): Promise<number | null> {
  const collection = await puzzles()
  const _id = `${pool}:${day}`
  const locked = await collection.findOne({ _id })
  if (locked) return locked.tmdbId
  const films = await poolFilms(pool)
  if (!films.length) return null
  const used = new Set((await collection.find({ pool }, { projection: { tmdbId: 1 } }).toArray()).map((doc) => doc.tmdbId))
  const tmdbId = films[pickIndex(dayNumber(day), films.length, (index) => used.has(films[index]))]
  try {
    await collection.updateOne({ _id }, { $setOnInsert: { pool, day, tmdbId, createdAt: new Date() } }, { upsert: true })
  } catch (error: any) {
    // Two first requests at once: the other one's insert won.
    if (error?.code !== 11000) throw error
  }
  return (await collection.findOne({ _id }))?.tmdbId ?? tmdbId
}

export type Person = { name: string, profile_path: string | null }
export type Still = { path: string, x: number, y: number }

/** What the page needs to play a day. The answer is wrapped (see wrapAnswer). */
export type Puzzle = {
  day: string
  number: number
  pool: GuessPool
  stills: [Still, Still]
  decade: number | null
  year: number | null
  genres: number[]
  runtime: number | null
  countries: string[]
  director: Person | null
  cast: Person[]
  line: Segment[] | null
  answer: string
}

const yearOf = (date: unknown) => (typeof date === 'string' && /^\d{4}/.test(date) ? Number(date.slice(0, 4)) : null)
const person = (entry: any): Person => ({ name: String(entry?.name ?? ''), profile_path: entry?.profile_path ?? null })

export async function buildPuzzle(day: string, pool: GuessPool, language: GuessLanguage): Promise<Puzzle | null> {
  const id = await puzzleFilm(day, pool)
  if (!id) return null
  const [film, translated] = await Promise.all([
    tmdbFetchSafe<any>(`movie/${id}`, { append_to_response: 'credits,images', include_image_language: 'null' }, WEEK, { shared: true }),
    language === 'en' ? null : tmdbFetchSafe<any>(`movie/${id}`, { language: language === 'fr' ? 'fr-FR' : 'ar' }, WEEK, { shared: true }),
  ])
  if (!film?.id) return null

  // Stills without any words on them, best first: the first clue is the less famous one.
  const backdrops: string[] = (film.images?.backdrops ?? [])
    .filter((image: any) => !image.iso_639_1 && image.file_path && (image.width ?? 0) >= 1280)
    .sort((a: any, b: any) => (b.vote_average ?? 0) - (a.vote_average ?? 0))
    .map((image: any) => image.file_path as string)
  const paths = Array.from(new Set([...backdrops, film.backdrop_path].filter(Boolean))) as string[]
  if (!paths.length) return null
  const first = paths[1] ?? paths[0]
  const second = paths[0]

  const year = yearOf(film.release_date)
  const title = language === 'fr' ? translated?.title || film.title : film.title
  const overview = (translated?.overview || film.overview || '').trim()
  const titles = [film.title, film.original_title, translated?.title].filter((value): value is string => typeof value === 'string' && !!value)
  const director = (film.credits?.crew ?? []).find((member: any) => member.job === 'Director')
  const cast = (film.credits?.cast ?? []).filter((member: any) => member?.name).slice(0, 3).map(person)

  return {
    day,
    number: puzzleNumber(day),
    pool,
    stills: [{ path: first, ...focalPoint(day, 0) }, { path: second, ...focalPoint(day, 1) }],
    decade: year ? decadeOf(year) : null,
    year,
    genres: (film.genres ?? []).map((genre: any) => genre.id).filter(Number.isInteger),
    runtime: Number.isInteger(film.runtime) && film.runtime > 0 ? film.runtime : null,
    countries: (film.production_countries ?? []).map((country: any) => country.iso_3166_1).filter((code: unknown) => typeof code === 'string').slice(0, 2),
    director: director ? person(director) : null,
    cast,
    line: overview ? maskTitle(storyLine(overview), titles) : null,
    answer: wrapAnswer({
      id: film.id,
      title,
      original_title: film.original_title ?? film.title,
      year,
      genre_ids: (film.genres ?? []).map((genre: any) => genre.id),
      poster_path: (language === 'fr' && translated?.poster_path) || film.poster_path || null,
      backdrop_path: film.backdrop_path ?? null,
    }),
  }
}
