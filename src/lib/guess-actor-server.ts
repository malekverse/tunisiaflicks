// The puzzles of "Guess the actor" (/guess/actor): which actor a day gets, locked in the database
// the first time someone asks (a past day never changes), and the clues in the player's language.
// The actors come from Guess the film's pools (lib/guess-server), walked in the same order: the
// day's film gives one of its first three billed. Cartoons are passed over (a voice has no face to
// guess). Everything is shared (no viewer): /api/guess/actor/[day] answers are cached by the CDN.
import 'server-only'
import clientPromise from '@/src/lib/mongodb'
import { tmdbFetchSafe } from '@/src/lib/tmdb'
import { decadeOf, pickIndex, wrapAnswer, type GuessLanguage, type GuessPool } from '@/src/lib/guess'
import { poolFilms } from '@/src/lib/guess-server'
import { actorDayNumber, actorNumber, birthCountry, initialsOf, pickActor } from '@/src/lib/guess-actor'

const WEEK = 7 * 86400
const ANIMATION = 16
/** Films tried, at most, when a day's actor is first chosen. */
const MAX_CANDIDATES = 8
/**
 * Where in the pool's walk the actors start: far from Guess the film's (and the music's) place,
 * so a day's actor never comes from a film those games just had.
 */
const WALK_OFFSET = 250

type ActorPuzzleDoc = { _id: string, pool: GuessPool, day: string, personId: number, filmId: number, createdAt: Date }

let indexReady: Promise<unknown> | null = null
async function puzzles() {
  const collection = (await clientPromise).db().collection<ActorPuzzleDoc>('guessActorPuzzles')
  indexReady ??= collection.createIndex({ pool: 1 }).catch((error) => {
    indexReady = null
    console.error('guessActorPuzzles index:', error)
  })
  await indexReady
  return collection
}

/** The day's actor: the one locked in, or else chosen now (the first writer wins). */
export async function actorPuzzlePerson(day: string, pool: GuessPool): Promise<ActorPuzzleDoc | null> {
  const collection = await puzzles()
  const _id = `${pool}:${day}`
  const locked = await collection.findOne({ _id })
  if (locked) return locked

  const films = await poolFilms(pool)
  if (!films.length) return null
  const done = await collection.find({ pool }, { projection: { personId: 1, filmId: 1 } }).toArray()
  const usedPeople = new Set(done.map((doc) => doc.personId))
  const usedFilms = new Set(done.map((doc) => doc.filmId))
  const tried = new Set<number>()
  for (let attempt = 0; attempt < MAX_CANDIDATES; attempt++) {
    const index = pickIndex(actorDayNumber(day) + WALK_OFFSET, films.length, (i) => usedFilms.has(films[i]) || tried.has(films[i]))
    const filmId = films[index]
    if (filmId === undefined || tried.has(filmId)) break
    tried.add(filmId)
    const film = await tmdbFetchSafe<any>(`movie/${filmId}`, { append_to_response: 'credits' }, WEEK, { shared: true })
    if (!film?.id || (film.genres ?? []).some((genre: any) => genre.id === ANIMATION)) continue
    const actor = pickActor(film.credits?.cast ?? [], usedPeople)
    if (!actor) continue
    try {
      await collection.updateOne({ _id }, { $setOnInsert: { pool, day, personId: actor.id, filmId, createdAt: new Date() } }, { upsert: true })
    } catch (error: any) {
      // Two first requests at once: the other one's insert won.
      if (error?.code !== 11000) throw error
    }
    return collection.findOne({ _id })
  }
  return null
}

export type ActorFilm = { id: number, title: string, year: number | null, poster_path: string | null }

/** What the page needs to play a day. The answer is wrapped (see wrapAnswer). */
export type ActorPuzzle = {
  day: string
  number: number
  pool: GuessPool
  /** Their face (a TMDB profile picture), blurred by the page. */
  photo: string
  decade: number | null
  born: string | null
  initials: string
  /** A film they're in (the clue before last), and their best-known ones (the last). */
  film: ActorFilm | null
  films: ActorFilm[]
  answer: string
}

const yearOf = (date: unknown) => (typeof date === 'string' && /^\d{4}/.test(date) ? Number(date.slice(0, 4)) : null)

export async function buildActorPuzzle(day: string, pool: GuessPool, language: GuessLanguage): Promise<ActorPuzzle | null> {
  const chosen = await actorPuzzlePerson(day, pool)
  if (!chosen) return null
  const lang = language === 'fr' ? 'fr-FR' : language === 'ar' ? 'ar' : undefined
  const [person, credits] = await Promise.all([
    tmdbFetchSafe<any>(`person/${chosen.personId}`, {}, WEEK, { shared: true }),
    tmdbFetchSafe<any>(`person/${chosen.personId}/movie_credits`, { language: lang }, WEEK, { shared: true }),
  ])
  if (!person?.id || !person.profile_path) return null

  // Their films, best known first; for Kids and Halal, only the films those pools would show.
  let cast: any[] = (credits?.cast ?? []).filter((film: any) => Number.isInteger(film?.id) && film.title && !film.adult && film.poster_path)
  if (pool === 'kids') {
    const { filterKidSafe } = await import('@/src/lib/kids')
    cast = await filterKidSafe(cast, 'movie')
  } else if (pool === 'halal') {
    const { filterHalal } = await import('@/src/lib/halal')
    cast = await filterHalal(cast, 'movie', { on: true })
  }
  const seen = new Set<number>()
  const known = cast
    .sort((a, b) => (b.vote_count ?? 0) - (a.vote_count ?? 0))
    .filter((film) => !seen.has(film.id) && seen.add(film.id))
    .map((film): ActorFilm => ({ id: film.id, title: String(film.title), year: yearOf(film.release_date), poster_path: film.poster_path ?? null }))
  const best = known.slice(0, 2)
  const film = known[2] ?? known.find((entry) => entry.id === chosen.filmId) ?? null

  const year = yearOf(person.birthday)
  return {
    day,
    number: actorNumber(day),
    pool,
    photo: person.profile_path,
    decade: year ? decadeOf(year) : null,
    born: birthCountry(person.place_of_birth),
    initials: initialsOf(person.name),
    film,
    films: best.filter((entry) => entry.id !== film?.id),
    answer: wrapAnswer({
      id: person.id,
      title: String(person.name),
      original_title: String(person.name),
      year,
      genre_ids: [],
      poster_path: person.profile_path,
      backdrop_path: null,
    }),
  }
}
