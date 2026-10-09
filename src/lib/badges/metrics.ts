// What each badge measures, from a profile's daily play log and the facts about the titles it
// played (genres, original language, release year, Tunisian or not, episodes per season). Pure:
// the database and TMDB stay in ./compute.ts and ./facts.ts.
import { RAMADAN, toHijri } from '@/src/lib/hijri'
import type { BadgeId } from './catalogue'
import { weeklyStreak, type Streak } from './time'

/** One day of the log: what was played ('m550', 't1399:1:2' or 't1399'), and the night/early flags. */
export type ActivityDay = { day: string; n?: boolean; e?: boolean; k: string[] }

/** A title as the badges know it: 'movie:550' or 'tv:1399'. */
export type TitleKey = `${'movie' | 'tv'}:${string}`

/** What TMDB says about a title (kept 30 days in titleFacts). */
export type TitleFacts = {
  /** TMDB genre ids. */
  g: number[]
  /** Original language (ISO 639-1). */
  l: string | null
  /** Release (or first air) year. */
  y: number | null
  /** Made in Tunisia (production or origin country TN). */
  tn: boolean
  /** TV: episodes per season ({ '1': 10, '2': 8 }), specials left out. */
  s?: Record<string, number>
  /** TMDB doesn't know the title. */
  missing?: true
}

const yearOf = (date: unknown) => {
  const year = typeof date === 'string' ? Number(date.slice(0, 4)) : NaN
  return Number.isInteger(year) && year > 0 ? year : null
}

const countries = (value: unknown): string[] =>
  Array.isArray(value) ? value.map((entry) => (typeof entry === 'string' ? entry : entry?.iso_3166_1)).filter((code): code is string => typeof code === 'string') : []

/** The facts in a TMDB detail answer. */
export function factsFromTmdb(kind: 'movie' | 'tv', data: any): TitleFacts {
  const facts: TitleFacts = {
    g: Array.isArray(data?.genres) ? data.genres.map((genre: any) => Number(genre?.id)).filter(Number.isInteger) : [],
    l: typeof data?.original_language === 'string' ? data.original_language : null,
    y: yearOf(kind === 'movie' ? data?.release_date : data?.first_air_date),
    tn: [...countries(data?.production_countries), ...countries(data?.origin_country)].includes('TN'),
  }
  if (kind === 'tv' && Array.isArray(data?.seasons)) {
    const seasons: Record<string, number> = {}
    for (const season of data.seasons) {
      const number = Number(season?.season_number)
      const count = Number(season?.episode_count)
      if (Number.isInteger(number) && number >= 1 && Number.isInteger(count) && count > 0) seasons[String(number)] = count
    }
    facts.s = seasons
  }
  return facts
}

export type PlayRef = { media_type: 'movie' | 'tv'; id: string; season?: number; episode?: number }

/** How a play is written in the log. */
export function playKey(item: PlayRef): string {
  if (item.media_type === 'movie') return `m${item.id}`
  if (Number.isInteger(item.season) && Number.isInteger(item.episode)) return `t${item.id}:${item.season}:${item.episode}`
  return `t${item.id}`
}

const KEY_RE = /^([mt])(\d{1,9})(?::(\d{1,3}):(\d{1,3}))?$/

export function parsePlayKey(key: string): PlayRef | null {
  const match = KEY_RE.exec(key)
  if (!match) return null
  const [, kind, id, season, episode] = match
  if (kind === 'm') return season === undefined ? { media_type: 'movie', id } : null
  return season === undefined ? { media_type: 'tv', id } : { media_type: 'tv', id, season: Number(season), episode: Number(episode) }
}

export const titleKeyOf = (ref: { media_type: 'movie' | 'tv'; id: string }): TitleKey => `${ref.media_type}:${ref.id}`

// The 18 canonical genres: TMDB's movie genres (TV movie aside). TV genres fold into them
// ('Sci-Fi & Fantasy' counts as both, 'Kids' as Family); News, Reality and Talk don't count.
const CANONICAL: Record<number, string[]> = {
  28: ['action'], 12: ['adventure'], 16: ['animation'], 35: ['comedy'], 80: ['crime'],
  99: ['documentary'], 18: ['drama'], 10751: ['family'], 14: ['fantasy'], 36: ['history'],
  27: ['horror'], 10402: ['music'], 9648: ['mystery'], 10749: ['romance'], 878: ['scifi'],
  53: ['thriller'], 10752: ['war'], 37: ['western'],
  10759: ['action', 'adventure'], 10762: ['family'], 10765: ['scifi', 'fantasy'],
  10768: ['war'], 10766: ['drama'],
}

export const CANONICAL_GENRE_COUNT = 18

/** The canonical genres among TMDB genre ids. */
export function canonicalGenres(ids: Iterable<number>): Set<string> {
  const genres = new Set<string>()
  for (const id of ids) for (const genre of CANONICAL[id] ?? []) genres.add(genre)
  return genres
}

/** 1994 -> 1990. Null for years TMDB can't mean. */
export function decadeOf(year: number | null | undefined): number | null {
  if (typeof year !== 'number' || !Number.isInteger(year) || year < 1870 || year > 2100) return null
  return Math.floor(year / 10) * 10
}

/** The best single day: distinct episodes of one show, or distinct films, whichever is more. */
export function marathonOf(days: ActivityDay[]): number {
  let best = 0
  for (const { k } of days) {
    const films = new Set<string>()
    const shows = new Map<string, Set<string>>()
    for (const key of k) {
      const play = parsePlayKey(key)
      if (!play) continue
      if (play.media_type === 'movie') films.add(play.id)
      else if (play.season !== undefined) {
        const episodes = shows.get(play.id) ?? new Set<string>()
        episodes.add(`${play.season}:${play.episode}`)
        shows.set(play.id, episodes)
      }
    }
    best = Math.max(best, films.size, ...[...shows.values()].map((episodes) => episodes.size))
  }
  return best
}

/** The most days with a play inside one Ramadan (Umm al-Qura, as on the rest of the site). */
export function ramadanDaysOf(days: Iterable<string>): number {
  const perYear = new Map<number, Set<string>>()
  for (const day of days) {
    const hijri = toHijri(day)
    if (hijri.month !== RAMADAN) continue
    const set = perYear.get(hijri.year) ?? new Set<string>()
    set.add(day)
    perYear.set(hijri.year, set)
  }
  return Math.max(0, ...[...perYear.values()].map((set) => set.size))
}

/** Seasons played from the first to the last episode (every episode TMDB lists for it). */
export function finishedSeasons(days: ActivityDay[], facts: Map<string, TitleFacts>): number {
  const watched = new Map<string, Map<number, Set<number>>>()
  for (const { k } of days) {
    for (const key of k) {
      const play = parsePlayKey(key)
      if (!play || play.media_type !== 'tv' || play.season === undefined || play.episode === undefined) continue
      const seasons = watched.get(play.id) ?? new Map<number, Set<number>>()
      const episodes = seasons.get(play.season) ?? new Set<number>()
      episodes.add(play.episode)
      seasons.set(play.season, episodes)
      watched.set(play.id, seasons)
    }
  }
  let finished = 0
  for (const [id, seasons] of watched) {
    const counts = facts.get(`tv:${id}`)?.s
    if (!counts) continue
    for (const [season, episodes] of seasons) {
      const total = counts[String(season)]
      if (season < 1 || !total || total < 1) continue
      let seen = 0
      for (let episode = 1; episode <= total; episode++) if (episodes.has(episode)) seen++
      if (seen >= total) finished++
    }
  }
  return finished
}

/** Every title the log mentions. */
export function titlesInLog(days: ActivityDay[]): TitleKey[] {
  const titles = new Set<TitleKey>()
  for (const { k } of days) {
    for (const key of k) {
      const play = parsePlayKey(key)
      if (play) titles.add(titleKeyOf(play))
    }
  }
  return [...titles]
}

export type MetricsInput = {
  days: ActivityDay[]
  /** Titles from the watch history (the log's own are added here). */
  titles: TitleKey[]
  facts: Map<string, TitleFacts>
  /** Today in Tunis. */
  today: string
  supporter: boolean
  /** The best streak already on record (the log only goes back 13 months). */
  bestStreak?: number
}

export type Metrics = { values: Record<BadgeId, number>; streak: Streak }

export function computeMetrics(input: MetricsInput): Metrics {
  // The log's titles count even when the history lost them.
  const titles = [...new Set([...input.titles, ...titlesInLog(input.days)])]
  const known = titles.map((title) => input.facts.get(title)).filter((facts): facts is TitleFacts => !!facts && !facts.missing)
  const genres = canonicalGenres(known.flatMap((facts) => facts.g))
  const languages = new Set(known.map((facts) => facts.l).filter((language): language is string => !!language && language !== 'xx'))
  const decades = new Set(known.map((facts) => decadeOf(facts.y)).filter((decade): decade is number => decade !== null))
  const streak = weeklyStreak(input.days.map((day) => day.day), input.today)
  streak.best = Math.max(streak.best, input.bestStreak ?? 0)
  const played = titles.length > 0 || input.days.some((day) => day.k.length > 0)
  return {
    values: {
      openingNight: played ? 1 : 0,
      marathon: marathonOf(input.days),
      nightOwl: input.days.filter((day) => day.n).length,
      earlyBird: input.days.filter((day) => day.e).length,
      ramadan: ramadanDaysOf(input.days.map((day) => day.day)),
      tunisian: known.filter((facts) => facts.tn).length,
      genres: genres.size,
      world: languages.size,
      decades: decades.size,
      finisher: finishedSeasons(input.days, input.facts),
      streakWeeks: streak.best,
      supporter: input.supporter ? 1 : 0,
    },
    streak,
  }
}
