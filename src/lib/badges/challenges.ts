// Monthly film challenges (/challenges): three goals a month ("films in 5 languages", "4 Tunisian
// titles during Ramadan"...), the same for everyone, measured from the profile's private play log
// (watchActivity) and the facts about the titles in it, exactly like the badges. Each one finished
// counts towards the Challenges badge (catalogue). Pure: no database, no TMDB.
//
// A month's challenges never change once it has started (past months are counted again by the
// badge), so a month is either written out in CURATED or drawn from ROTATION by its number.
import { canonicalGenres, decadeOf, parsePlayKey, titleKeyOf, type ActivityDay, type TitleFacts } from './metrics'

export type ChallengeKind =
  | 'films' | 'languages' | 'decades' | 'genres' | 'tunisian' | 'arabic'
  | 'classics' | 'episodes' | 'days' | 'newReleases' | 'animation' | 'documentary'

export const CHALLENGE_KINDS: readonly ChallengeKind[] = [
  'films', 'languages', 'decades', 'genres', 'tunisian', 'arabic', 'classics', 'episodes', 'days', 'newReleases', 'animation', 'documentary',
]

export type Challenge = { kind: ChallengeKind, target: number }

/** Months with challenges chosen by hand (the season: Ramadan, the end of the year). */
const CURATED: Record<string, Challenge[]> = {
  '2026-11': [{ kind: 'films', target: 5 }, { kind: 'genres', target: 5 }, { kind: 'tunisian', target: 2 }],
  '2026-12': [{ kind: 'languages', target: 5 }, { kind: 'decades', target: 4 }, { kind: 'days', target: 12 }],
  '2027-01': [{ kind: 'films', target: 8 }, { kind: 'classics', target: 3 }, { kind: 'arabic', target: 4 }],
  // Ramadan 1448 begins around 8 February 2027.
  '2027-02': [{ kind: 'tunisian', target: 4 }, { kind: 'episodes', target: 30 }, { kind: 'days', target: 15 }],
  '2027-03': [{ kind: 'arabic', target: 5 }, { kind: 'documentary', target: 2 }, { kind: 'genres', target: 6 }],
}

/** Every other month: three of these, a different three each month. */
const ROTATION: Challenge[] = [
  { kind: 'films', target: 6 },
  { kind: 'languages', target: 4 },
  { kind: 'decades', target: 3 },
  { kind: 'tunisian', target: 2 },
  { kind: 'episodes', target: 20 },
  { kind: 'classics', target: 2 },
  { kind: 'genres', target: 6 },
  { kind: 'arabic', target: 4 },
  { kind: 'days', target: 10 },
  { kind: 'newReleases', target: 4 },
  { kind: 'animation', target: 3 },
  { kind: 'documentary', target: 2 },
]

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/
export const isMonth = (value: unknown): value is string => typeof value === 'string' && MONTH_RE.test(value)

/** The first month with challenges. */
export const FIRST_MONTH = '2026-11'

/** The month a Tunis day falls in. */
export const monthOf = (day: string) => day.slice(0, 7)

export function previousMonth(month: string): string {
  const year = Number(month.slice(0, 4))
  const m = Number(month.slice(5, 7))
  return m === 1 ? `${year - 1}-12` : `${year}-${String(m - 1).padStart(2, '0')}`
}

/** Days in the month, and how many are left after `today` (0 on its last day). */
export function daysLeft(month: string, today: string): number {
  const year = Number(month.slice(0, 4))
  const m = Number(month.slice(5, 7))
  const length = new Date(Date.UTC(year, m, 0)).getUTCDate()
  if (monthOf(today) !== month) return monthOf(today) < month ? length : 0
  return length - Number(today.slice(8, 10))
}

/** The month's three challenges (none before FIRST_MONTH). */
export function challengesFor(month: string): Challenge[] {
  if (!isMonth(month) || month < FIRST_MONTH) return []
  if (CURATED[month]) return CURATED[month]
  const index = Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1
  // Steps of 5 through 12 kinds: every kind comes round, never twice in one month.
  return [0, 1, 2].map((slot) => ROTATION[(index * 3 + slot * 5) % ROTATION.length])
}

/** How far a month's plays go towards one kind of challenge. */
export function measure(kind: ChallengeKind, days: readonly ActivityDay[], facts: ReadonlyMap<string, TitleFacts>, month: string): number {
  const films = new Set<string>()
  const episodes = new Set<string>()
  const titles = new Set<string>()
  let playedDays = 0
  for (const day of days) {
    if (monthOf(day.day) !== month) continue
    let any = false
    for (const key of day.k) {
      const play = parsePlayKey(key)
      if (!play) continue
      any = true
      titles.add(titleKeyOf(play))
      if (play.media_type === 'movie') films.add(play.id)
      else if (play.season !== undefined) episodes.add(`${play.id}:${play.season}:${play.episode}`)
    }
    if (any) playedDays++
  }
  const known = [...titles].map((title) => [title, facts.get(title)] as const).filter((entry): entry is readonly [string, TitleFacts] => !!entry[1] && !entry[1].missing)
  const count = (test: (facts: TitleFacts, title: string) => boolean) => known.filter(([title, fact]) => test(fact, title)).length
  const year = Number(month.slice(0, 4))
  switch (kind) {
    case 'films': return films.size
    case 'episodes': return episodes.size
    case 'days': return playedDays
    case 'languages': return new Set(known.map(([, fact]) => fact.l).filter((language) => !!language && language !== 'xx')).size
    case 'decades': return new Set(known.map(([, fact]) => decadeOf(fact.y)).filter((decade) => decade !== null)).size
    case 'genres': return canonicalGenres(known.flatMap(([, fact]) => fact.g)).size
    case 'tunisian': return count((fact) => fact.tn)
    case 'arabic': return count((fact) => fact.l === 'ar')
    case 'classics': return count((fact, title) => title.startsWith('movie:') && !!fact.y && fact.y < 1980)
    case 'newReleases': return count((fact) => fact.y === year)
    case 'animation': return count((fact) => fact.g.includes(16))
    case 'documentary': return count((fact) => fact.g.includes(99))
  }
}

export type ChallengeProgress = Challenge & { value: number, done: boolean }

export function monthProgress(month: string, days: readonly ActivityDay[], facts: ReadonlyMap<string, TitleFacts>): ChallengeProgress[] {
  return challengesFor(month).map((challenge) => {
    const value = measure(challenge.kind, days, facts, month)
    return { ...challenge, value, done: value >= challenge.target }
  })
}

/** Every challenge finished in the log's months (the Challenges badge). */
export function challengeWins(days: readonly ActivityDay[], facts: ReadonlyMap<string, TitleFacts>): number {
  const months = new Set(days.map((day) => monthOf(day.day)))
  let wins = 0
  for (const month of months) wins += monthProgress(month, days, facts).filter((challenge) => challenge.done).length
  return wins
}

/** The titles a month's plays mention (their facts are needed to measure it). */
export function monthTitles(days: readonly ActivityDay[], month: string): string[] {
  const titles = new Set<string>()
  for (const day of days) {
    if (monthOf(day.day) !== month) continue
    for (const key of day.k) {
      const play = parsePlayKey(key)
      if (play) titles.add(titleKeyOf(play))
    }
  }
  return [...titles]
}
