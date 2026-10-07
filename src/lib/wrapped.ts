// "Your year on TunisiaFlicks": a Spotify-Wrapped style recap built from the watch history and
// favorites we already store, enriched with TMDB details (runtimes, genres, episode counts).
//
// History keeps one entry per title (its latest watch), so time watched is an *estimate*: a movie
// counts its runtime; a show counts every episode up to the last one recorded (assumes the viewer
// started at S1E1) times the episode length. The UI labels these numbers as estimates.
import { randomBytes } from 'crypto'
import clientPromise from '@/src/lib/mongodb'
import { tmdbFetchSafe } from '@/src/lib/tmdb'

const MAX_TITLES = 80 // TMDB lookups per recap (cached for a day)
const DEFAULT_MOVIE_MINUTES = 105
const DEFAULT_EPISODE_MINUTES = 42
const MAX_FALLBACK_EPISODE_MINUTES = 60

type Pick = { id: string, title: string, poster_path: string | null }

export type WrappedStats = {
  year: number
  name: string
  titles: number
  movies: number
  shows: number
  minutes: number
  episodes: number
  topGenres: { name: string, minutes: number }[]
  personality: { title: string, blurb: string }
  topShow: (Pick & { episodes: number }) | null
  topMovie: (Pick & { rating: number }) | null
  firstWatch: (Pick & { media_type: 'movie' | 'tv', date: string }) | null
  favorites: number
  posters: string[]
}

// Genre (TMDB movie + TV names) -> viewer personality.
const PERSONALITIES: [string[], string, string][] = [
  [['Action', 'Adventure', 'Action & Adventure', 'War', 'War & Politics', 'Western'], 'The Adrenaline Junkie', 'Explosions, chases, last-second escapes: you watch with your heart rate up.'],
  [['Comedy', 'Family', 'Animation', 'Kids'], 'The Good-Vibes Seeker', 'You come for the laughs and stay for the feel-good endings.'],
  [['Drama', 'Soap', 'Romance'], 'The Deep Feeler', 'Big emotions, complicated people, stories that stay with you.'],
  [['Horror', 'Thriller'], 'The Night Owl', 'Lights off, volume up. You live for the tension.'],
  [['Crime', 'Mystery'], 'The Detective', 'You were solving the case before the second act.'],
  [['Science Fiction', 'Fantasy', 'Sci-Fi & Fantasy'], 'The World Traveler', 'Other planets, other worlds, other rules: reality is too small for you.'],
  [['Documentary', 'History', 'News', 'Talk', 'Reality'], 'The Curious Mind', 'True stories over everything. You watch to learn.'],
  [['Music'], 'The Rhythm Lover', 'If it has a soundtrack worth replaying, you are in.'],
]

function personalityFor(genre: string | undefined) {
  const match = PERSONALITIES.find(([genres]) => genre && genres.includes(genre))
  return match
    ? { title: match[1], blurb: match[2] }
    : { title: 'The Explorer', blurb: 'A bit of everything: your taste refuses to be put in a box.' }
}

const inYear = (value: unknown, year: number) => {
  const date = value ? new Date(value as string) : null
  return !!date && !Number.isNaN(date.getTime()) && date.getFullYear() === year
}

/** Episodes up to (season, episode), counting full earlier seasons (specials excluded). */
function episodesUpTo(show: any, season = 1, episode = 1) {
  const earlier = (show.seasons ?? [])
    .filter((s: any) => s.season_number >= 1 && s.season_number < season)
    .reduce((total: number, s: any) => total + (s.episode_count ?? 0), 0)
  return earlier + Math.max(1, episode)
}

export async function computeWrapped(userId: string, year: number, displayName: string): Promise<WrappedStats> {
  const client = await clientPromise
  const lists = await client.db().collection('userContent')
    .find({ userId, type: { $in: ['history', 'favorites'] } })
    .toArray()
  const history: any[] = lists.find((list) => list.type === 'history')?.items ?? []
  const favorites: any[] = lists.find((list) => list.type === 'favorites')?.items ?? []

  const watched = history
    .filter((item) => (item.media_type === 'movie' || item.media_type === 'tv') && inYear(item.watched_at ?? item.added_at, year))
    .slice(0, MAX_TITLES)

  const details = await Promise.all(watched.map((item) => tmdbFetchSafe(`${item.media_type}/${item.id}`, {}, 86400)))

  let minutes = 0
  let episodes = 0
  const genreMinutes = new Map<string, number>()
  let topShow: WrappedStats['topShow'] = null
  let topMovie: WrappedStats['topMovie'] = null

  watched.forEach((item, index) => {
    const info = details[index]
    let itemMinutes: number
    if (item.media_type === 'movie') {
      itemMinutes = info?.runtime || DEFAULT_MOVIE_MINUTES
      const rating = info?.vote_count > 50 ? Math.round(info.vote_average * 10) / 10 : 0
      if (rating && (!topMovie || rating > topMovie.rating)) {
        topMovie = { id: String(item.id), title: item.title, poster_path: item.poster_path ?? info?.poster_path ?? null, rating }
      }
    } else {
      const count = info ? episodesUpTo(info, item.season, item.episode) : Math.max(1, item.episode ?? 1)
      // TMDB's standard episode length when it has one; otherwise the latest episode's runtime,
      // capped because finales run long (e.g. 80 min) and would inflate every episode.
      const perEpisode = info?.episode_run_time?.[0]
        || Math.min(info?.last_episode_to_air?.runtime || DEFAULT_EPISODE_MINUTES, MAX_FALLBACK_EPISODE_MINUTES)
      itemMinutes = count * perEpisode
      episodes += count
      if (!topShow || count > topShow.episodes) {
        topShow = { id: String(item.id), title: item.title, poster_path: item.poster_path ?? info?.poster_path ?? null, episodes: count }
      }
    }
    minutes += itemMinutes
    for (const genre of info?.genres ?? []) {
      genreMinutes.set(genre.name, (genreMinutes.get(genre.name) ?? 0) + itemMinutes)
    }
  })

  const topGenres = Array.from(genreMinutes, ([name, total]) => ({ name, minutes: total }))
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, 3)

  const earliest = [...watched].sort((a, b) =>
    new Date(a.watched_at ?? a.added_at).getTime() - new Date(b.watched_at ?? b.added_at).getTime())[0]

  return {
    year,
    name: displayName,
    titles: watched.length,
    movies: watched.filter((item) => item.media_type === 'movie').length,
    shows: watched.filter((item) => item.media_type === 'tv').length,
    minutes,
    episodes,
    topGenres,
    personality: personalityFor(topGenres[0]?.name),
    topShow,
    topMovie,
    firstWatch: earliest
      ? { id: String(earliest.id), title: earliest.title, poster_path: earliest.poster_path ?? null, media_type: earliest.media_type, date: new Date(earliest.watched_at ?? earliest.added_at).toISOString() }
      : null,
    favorites: favorites.filter((item) => inYear(item.added_at, year)).length,
    posters: watched.map((item) => item.poster_path).filter(Boolean).slice(0, 12),
  }
}

/** First name only: share pages are public, so keep them light on personal data. */
export const firstName = (name?: string | null) => (name ?? '').trim().split(/\s+/)[0]?.slice(0, 30) || 'A TunisiaFlicks fan'

export const yearFromParam = (value: string | undefined) => {
  const current = new Date().getFullYear()
  const year = Number(value)
  return Number.isInteger(year) && year >= 2020 && year <= current ? year : current
}

// ---- Public share snapshots ------------------------------------------------------------------

export type WrappedShare = { token: string, userId: string, year: number, stats: WrappedStats, createdAt: Date, updatedAt: Date }

let indexesReady: Promise<unknown> | null = null

export async function sharesCollection() {
  const client = await clientPromise
  const collection = client.db().collection<WrappedShare>('wrappedShares')
  indexesReady ??= Promise.all([
    collection.createIndex({ token: 1 }, { unique: true }),
    collection.createIndex({ userId: 1, year: 1 }, { unique: true }),
  ]).catch(() => { indexesReady = null })
  await indexesReady
  return collection
}

export const isShareToken = (value: string) => /^[A-Za-z0-9_-]{10,32}$/.test(value)

export const newShareToken = () => randomBytes(9).toString('base64url')

export async function getShare(token: string): Promise<WrappedShare | null> {
  if (!isShareToken(token)) return null
  try {
    return await (await sharesCollection()).findOne({ token })
  } catch (error) {
    console.error('Error loading wrapped share:', error)
    return null
  }
}

export const formatHours = (minutes: number) => {
  const hours = minutes / 60
  return hours >= 10 ? Math.round(hours).toLocaleString('en-US') : hours.toFixed(1)
}
