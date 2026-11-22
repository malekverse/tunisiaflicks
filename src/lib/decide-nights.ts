// Decide together's memory (/decide): the nights the room saved (what won, how, whose pick it was),
// what everyone thought of the film afterwards, and what that says: films watched together, whose
// picks win, who has the best taste, how the room likes to decide, and whose turn it really is to
// choose. Pure rules (tests/decide-nights.unit.test.mts); the nights live on the phone only.
import { METHODS, sameName, type Method, type Pick as Choice } from '@/src/lib/decide'

export const NIGHTS_MAX = 200
/** After this long, a saved night asks how the film was (it had time to be watched). */
export const ASK_AFTER_MS = 90 * 60 * 1000
/** After this long, it stops asking. */
export const ASK_UNTIL_MS = 14 * 24 * 60 * 60 * 1000

export type Feeling = 'up' | 'meh' | 'down'
export const FEELINGS: Feeling[] = ['up', 'meh', 'down']

/** A film of a night. `by`: the person's name (names outlive the list of people on the phone). */
export type NightFilm = Omit<Choice, 'by' | 'backdrop_path'> & { by: string | null }

export type Night = {
  id: string
  at: number
  method: Method
  films: NightFilm[]
  /** Who was in the room (names). */
  people: string[]
  /** Who got to choose ("Who chooses?"). */
  chooser: string | null
  /** What everyone thought: by name, or '' for the whole room when there were no names. */
  feelings: Record<string, Feeling> | null
  /** "Not now" on the question: it won't ask again (it can still be rated from the list). */
  skipped?: boolean
}

const isFeeling = (value: unknown): value is Feeling => value === 'up' || value === 'meh' || value === 'down'
const str = (value: unknown, max: number) => (typeof value === 'string' ? value.slice(0, max) : '')

/** The nights as stored, checked field by field (anything broken is left out). */
export function cleanNights(raw: unknown): Night[] {
  if (!Array.isArray(raw)) return []
  const nights = raw.flatMap((night: any): Night[] => {
    if (!night || typeof night.id !== 'string' || !Number.isFinite(night.at) || !METHODS.includes(night.method)) return []
    const films: NightFilm[] = (Array.isArray(night.films) ? night.films : []).flatMap((film: any): NightFilm[] => {
      if (!film || typeof film.key !== 'string' || !/^(movie|tv):\d{1,9}$/.test(film.key) || typeof film.title !== 'string') return []
      const [media_type, id] = film.key.split(':') as ['movie' | 'tv', string]
      return [{
        key: film.key, media_type, id, title: film.title.slice(0, 200),
        poster_path: typeof film.poster_path === 'string' ? film.poster_path : null,
        year: str(film.year, 4), by: typeof film.by === 'string' && film.by ? film.by.slice(0, 40) : null,
      }]
    }).slice(0, 3)
    if (!films.length) return []
    const feelings = night.feelings && typeof night.feelings === 'object'
      ? Object.fromEntries(Object.entries(night.feelings).filter(([, value]) => isFeeling(value)).slice(0, 12)) as Record<string, Feeling>
      : null
    return [{
      id: night.id.slice(0, 40),
      at: night.at,
      method: night.method,
      films,
      people: (Array.isArray(night.people) ? night.people : []).filter((name: unknown) => typeof name === 'string' && name).slice(0, 10).map((name: string) => name.slice(0, 40)),
      chooser: typeof night.chooser === 'string' && night.chooser ? night.chooser.slice(0, 40) : null,
      feelings: feelings && Object.keys(feelings).length ? feelings : null,
      ...(night.skipped === true ? { skipped: true } : {}),
    }]
  })
  return nights.sort((a, b) => b.at - a.at).slice(0, NIGHTS_MAX)
}

/** The night that should ask how it was: the newest one old enough, not rated, not skipped. */
export function nightToRate(nights: readonly Night[], now: number): Night | null {
  return nights.find((night) => !night.feelings && !night.skipped && now - night.at >= ASK_AFTER_MS && now - night.at <= ASK_UNTIL_MS) ?? null
}

export function feelingCounts(night: Pick<Night, 'feelings'>): Record<Feeling, number> {
  const counts: Record<Feeling, number> = { up: 0, meh: 0, down: 0 }
  for (const feeling of Object.values(night.feelings ?? {})) counts[feeling]++
  return counts
}

/** When each title was last watched together (by key). */
export function watchedTogether(nights: readonly Night[]): Map<string, number> {
  const seen = new Map<string, number>()
  for (const night of nights) {
    for (const film of night.films) seen.set(film.key, Math.max(seen.get(film.key) ?? 0, night.at))
  }
  return seen
}

export type NightStats = {
  nights: number
  films: number
  /** Whose picks won the most nights. */
  topPicker: { name: string, wins: number } | null
  /** Whose picks the room liked best (at least two rated nights). */
  bestTaste: { name: string, liked: number, rated: number } | null
  /** The way the room decides most often (at least two nights). */
  method: { method: Method, nights: number } | null
  /** The same person's picks winning the latest nights in a row (two or more). */
  streak: { name: string, nights: number } | null
}

/** Names as one person, whatever the case or accents: the first spelling seen wins. */
function tally() {
  const counts: { name: string, value: number }[] = []
  return {
    add(name: string, value = 1) {
      const found = counts.find((entry) => sameName(entry.name, name))
      if (found) found.value += value
      else counts.push({ name, value })
    },
    get: (name: string) => counts.find((entry) => sameName(entry.name, name))?.value ?? 0,
    best: () => counts.slice().sort((a, b) => b.value - a.value)[0] ?? null,
    all: () => counts,
  }
}

const ownersOf = (night: Night) => {
  const names: string[] = []
  for (const film of night.films) if (film.by && !names.some((name) => sameName(name, film.by!))) names.push(film.by)
  return names
}

export function nightStats(nights: readonly Night[]): NightStats {
  const wins = tally()
  const liked = tally()
  const rated = tally()
  const methods = new Map<Method, number>()
  for (const night of nights) {
    methods.set(night.method, (methods.get(night.method) ?? 0) + 1)
    const owners = ownersOf(night)
    for (const name of owners) wins.add(name)
    if (night.feelings) {
      const counts = feelingCounts(night)
      const total = counts.up + counts.meh + counts.down
      if (total) {
        for (const name of owners) {
          rated.add(name)
          liked.add(name, counts.up / total)
        }
      }
    }
  }

  const top = wins.best()
  const taste = rated.all()
    .filter((entry) => entry.value >= 2)
    .map((entry) => ({ name: entry.name, liked: liked.get(entry.name) / entry.value, rated: entry.value }))
    .sort((a, b) => b.liked - a.liked || b.rated - a.rated)[0] ?? null
  const favourite = [...methods.entries()].sort((a, b) => b[1] - a[1])[0]

  // nights are newest first.
  let streak: NightStats['streak'] = null
  const first = nights[0] ? ownersOf(nights[0]) : []
  if (first.length === 1) {
    let count = 0
    for (const night of nights) {
      const owners = ownersOf(night)
      if (owners.length === 1 && sameName(owners[0], first[0])) count++
      else break
    }
    if (count >= 2) streak = { name: first[0], nights: count }
  }

  return {
    nights: nights.length,
    films: nights.reduce((sum, night) => sum + night.films.length, 0),
    topPicker: top && top.value >= 1 ? { name: top.name, wins: top.value } : null,
    bestTaste: taste ? { name: taste.name, liked: Math.round(taste.liked * 100), rated: taste.rated } : null,
    method: favourite && favourite[1] >= 2 ? { method: favourite[0], nights: favourite[1] } : null,
    streak,
  }
}

/** How many of the latest `recent` nights each name chose ("Who chooses?"). */
export function chooserTurns(nights: readonly Night[], recent = 12): (name: string) => number {
  const turns = tally()
  for (const night of nights.slice(0, recent)) if (night.chooser) turns.add(night.chooser)
  return turns.get
}

/**
 * Who may be drawn to choose, fairly: whoever has chosen least lately (the saved nights), and not
 * whoever chose last time as long as someone else is left.
 */
export function fairChoosers<P extends { name: string }>(people: readonly P[], nights: readonly Night[], lastChooser: string | null): P[] {
  if (people.length <= 1) return people.slice()
  const turns = chooserTurns(nights)
  const fewest = Math.min(...people.map((person) => turns(person.name)))
  let pool = people.filter((person) => turns(person.name) === fewest)
  if (lastChooser && pool.length > 1) pool = pool.filter((person) => !sameName(person.name, lastChooser))
  if (!pool.length) pool = people.filter((person) => !lastChooser || !sameName(person.name, lastChooser))
  return pool.length ? pool : people.slice()
}
