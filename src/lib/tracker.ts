// My shows (/shows): where you are in each series you watch. The history keeps the last episode
// played per show; TMDB says how many episodes have aired, what comes next and when. These are the
// pure rules (tests/tracker.unit.test.mts): how far along you are, the episode after yours, and
// which shelf a show sits on (catching up, a date for the next one, waiting for news, finished).

export type Episode = { season: number, episode: number }
export type SeasonCount = { season_number: number, episode_count: number }
export type Aired = Episode & { air_date: string | null }

/** What TMDB says about a show (tv/{id}). */
export type ShowFacts = {
  seasons: SeasonCount[]
  /** The latest episode aired (last_episode_to_air). */
  last: Aired | null
  /** The next one scheduled (next_episode_to_air). */
  next: (Aired & { name?: string | null }) | null
  /** 'Returning Series', 'Ended', 'Canceled', 'In Production', 'Planned'... */
  status: string
}

export type Shelf = 'behind' | 'soon' | 'waiting' | 'finished'

export type Progress = {
  /** Episodes up to and including yours. */
  position: number
  /** Episodes aired so far (regular seasons, specials aside). */
  aired: number
  left: number
  /** The episode after yours, when it has aired. */
  upNext: Episode | null
  shelf: Shelf
  /** Nearly caught up and a new episode came out lately: worth a "New" badge. */
  fresh: boolean
}

const DAY = 86_400_000
const FRESH_DAYS = 10
const ENDED = new Set(['Ended', 'Canceled'])

/** Episodes aired in each regular season, in order (capped at the latest aired episode). */
export function airedSeasons(facts: Pick<ShowFacts, 'seasons' | 'last'>): SeasonCount[] {
  const regular = facts.seasons
    .filter((season) => season.season_number > 0 && season.episode_count > 0)
    .sort((a, b) => a.season_number - b.season_number)
  if (!facts.last) return []
  const last = facts.last
  return regular.flatMap((season) => {
    if (season.season_number < last.season) return [season]
    if (season.season_number === last.season) return [{ season_number: season.season_number, episode_count: Math.min(season.episode_count, last.episode) || last.episode }]
    return []
  })
}

const daysBetween = (from: string, now: number) => (now - Date.parse(`${from}T12:00:00Z`)) / DAY

export function progress(facts: ShowFacts, watched: Episode, now: number = Date.now()): Progress {
  const seasons = airedSeasons(facts)
  const aired = seasons.reduce((sum, season) => sum + season.episode_count, 0)
  let position = 0
  if (watched.season > 0) {
    for (const season of seasons) {
      if (season.season_number < watched.season) position += season.episode_count
      else if (season.season_number === watched.season) position += Math.min(watched.episode, season.episode_count)
    }
  }
  position = Math.min(position, aired)
  const left = Math.max(0, aired - position)

  let upNext: Episode | null = null
  if (left > 0) {
    const current = seasons.find((season) => season.season_number === watched.season)
    if (current && watched.episode < current.episode_count) upNext = { season: watched.season, episode: watched.episode + 1 }
    else {
      const following = seasons.find((season) => season.season_number > watched.season)
      upNext = following ? { season: following.season_number, episode: 1 } : null
    }
  }

  const shelf: Shelf = left > 0 && upNext
    ? 'behind'
    : facts.next?.air_date
      ? 'soon'
      : ENDED.has(facts.status) ? 'finished' : 'waiting'
  const fresh = shelf === 'behind' && left <= 3 && !!facts.last?.air_date && daysBetween(facts.last.air_date, now) <= FRESH_DAYS

  return { position, aired, left, upNext, shelf, fresh }
}

/** Days until an air date (0 today, 1 tomorrow), by the calendar in Tunis. */
export function daysUntil(airDate: string, now: number = Date.now()): number {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Tunis', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now))
  return Math.round((Date.parse(`${airDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY)
}

/** The order on each shelf: catching up by what you watched last, dates soonest first. */
export function shelfOrder(a: { shelf: Shelf, watchedAt: number, nextAir: string | null }, b: typeof a): number {
  if (a.shelf === 'soon' && b.shelf === 'soon') return (a.nextAir ?? '').localeCompare(b.nextAir ?? '')
  return b.watchedAt - a.watchedAt
}
