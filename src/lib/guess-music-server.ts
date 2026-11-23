// The puzzles of "Guess the film from its music" (/guess/music): which film and which track of its
// soundtrack a day gets, locked in the database the first time someone asks (a past day never
// changes), and the clues in the player's language. The films come from Guess the film's pools
// (lib/guess-server), walked in the same order; a film without a soundtrack album on Deezer, or
// without a track worth playing, is passed over for the next one. Everything is shared (no viewer):
// /api/guess/music/[day] answers are cached by the CDN.
import 'server-only'
import clientPromise from '@/src/lib/mongodb'
import { tmdbFetchSafe } from '@/src/lib/tmdb'
import { getAlbumTracks } from '@/src/lib/deezer'
import { resolveSoundtrack, soundtrackFacts } from '@/src/lib/soundtrack'
import { decadeOf, maskTitle, pickIndex, storyLine, wrapAnswer, type GuessLanguage, type GuessPool, type Segment } from '@/src/lib/guess'
import { poolFilms, type Person } from '@/src/lib/guess-server'
import { musicDayNumber, musicNumber, pickTrack } from '@/src/lib/guess-music'

const WEEK = 7 * 86400
/** Films tried, at most, when a day's puzzle is first chosen (each costs a few Deezer calls). */
const MAX_CANDIDATES = 8
/** And for how long, before giving up until the next request. */
const CHOOSE_BUDGET_MS = 20_000

type MusicPuzzleDoc = { _id: string, pool: GuessPool, day: string, tmdbId: number, albumId: number, trackId: number, createdAt: Date }

let indexReady: Promise<unknown> | null = null
async function puzzles() {
  const collection = (await clientPromise).db().collection<MusicPuzzleDoc>('guessMusicPuzzles')
  indexReady ??= collection.createIndex({ pool: 1 }).catch((error) => {
    indexReady = null
    console.error('guessMusicPuzzles index:', error)
  })
  await indexReady
  return collection
}

/** A film's soundtrack track to play, or null when it has none worth playing. */
async function trackFor(tmdbId: number): Promise<{ albumId: number, trackId: number } | null> {
  const facts = await soundtrackFacts('movie', String(tmdbId))
  if (!facts) return null
  const album = await resolveSoundtrack('movie', String(tmdbId), facts)
  if (!album) return null
  const tracks = await getAlbumTracks(album.albumId)
  const track = tracks ? pickTrack(tracks, [facts.title, facts.originalTitle ?? '']) : null
  return track ? { albumId: album.albumId, trackId: track.id } : null
}

/** The day's film and track: the ones locked in, or else chosen now (the first writer wins). */
export async function musicPuzzleTrack(day: string, pool: GuessPool): Promise<MusicPuzzleDoc | null> {
  const collection = await puzzles()
  const _id = `${pool}:${day}`
  const locked = await collection.findOne({ _id })
  if (locked) return locked

  const films = await poolFilms(pool)
  if (!films.length) return null
  const used = new Set((await collection.find({ pool }, { projection: { tmdbId: 1 } }).toArray()).map((doc) => doc.tmdbId))
  const tried = new Set<number>()
  const started = Date.now()
  for (let attempt = 0; attempt < MAX_CANDIDATES && Date.now() - started < CHOOSE_BUDGET_MS; attempt++) {
    const index = pickIndex(musicDayNumber(day), films.length, (i) => used.has(films[i]) || tried.has(films[i]))
    const tmdbId = films[index]
    if (tmdbId === undefined || tried.has(tmdbId)) break
    tried.add(tmdbId)
    const track = await trackFor(tmdbId).catch(() => null)
    if (!track) continue
    try {
      await collection.updateOne({ _id }, { $setOnInsert: { pool, day, tmdbId, ...track, createdAt: new Date() } }, { upsert: true })
    } catch (error: any) {
      // Two first requests at once: the other one's insert won.
      if (error?.code !== 11000) throw error
    }
    return collection.findOne({ _id })
  }
  return null
}

/** What the page needs to play a day. The answer is wrapped (see wrapAnswer). */
export type MusicPuzzle = {
  day: string
  number: number
  pool: GuessPool
  /** The Deezer track: played through /api/soundtrack/preview/<track>. */
  track: number
  decade: number | null
  year: number | null
  genres: number[]
  composer: Person | null
  cast: Person[]
  line: Segment[] | null
  answer: string
}

const yearOf = (date: unknown) => (typeof date === 'string' && /^\d{4}/.test(date) ? Number(date.slice(0, 4)) : null)
const person = (entry: any): Person => ({ name: String(entry?.name ?? ''), profile_path: entry?.profile_path ?? null })

export async function buildMusicPuzzle(day: string, pool: GuessPool, language: GuessLanguage): Promise<MusicPuzzle | null> {
  const chosen = await musicPuzzleTrack(day, pool)
  if (!chosen) return null
  const id = chosen.tmdbId
  const [film, translated] = await Promise.all([
    tmdbFetchSafe<any>(`movie/${id}`, { append_to_response: 'credits' }, WEEK, { shared: true }),
    language === 'en' ? null : tmdbFetchSafe<any>(`movie/${id}`, { language: language === 'fr' ? 'fr-FR' : 'ar' }, WEEK, { shared: true }),
  ])
  if (!film?.id) return null

  const year = yearOf(film.release_date)
  const title = language === 'fr' ? translated?.title || film.title : film.title
  const overview = (translated?.overview || film.overview || '').trim()
  const titles = [film.title, film.original_title, translated?.title].filter((value): value is string => typeof value === 'string' && !!value)
  const composer = (film.credits?.crew ?? []).find((member: any) => member.job === 'Original Music Composer' || member.job === 'Music')

  return {
    day,
    number: musicNumber(day),
    pool,
    track: chosen.trackId,
    decade: year ? decadeOf(year) : null,
    year,
    genres: (film.genres ?? []).map((genre: any) => genre.id).filter(Number.isInteger),
    composer: composer ? person(composer) : null,
    cast: (film.credits?.cast ?? []).filter((member: any) => member?.name).slice(0, 3).map(person),
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
