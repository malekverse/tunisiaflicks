// Decide together keeps its table on this phone only (localStorage): the names, the picks and the
// settings survive a reload or a locked screen, and so do the room's saved nights. Nothing is ever
// sent to the server.
import { COUNT_MAX, NAME_MAX, PEOPLE_MAX, PICKS_MAX, cleanName, type Person, type Pick } from '@/src/lib/decide'
import { cleanNights, NIGHTS_MAX, type Night } from '@/src/lib/decide-nights'

export type DecidePerson = Person & { color: number }
export type VoteMode = 'secret' | 'hands'
export type DecideState = {
  people: DecidePerson[]
  picks: Pick[]
  /** Whose pick the next title is (a person's id; null: anyone). */
  owner: string | null
  count: number
  fair: boolean
  voteMode: VoteMode
  /** Who chose last time (a name, so it still counts with a new list of people). */
  lastChooser: string | null
}

export const EMPTY_STATE: DecideState = { people: [], picks: [], owner: null, count: 1, fair: true, voteMode: 'secret', lastChooser: null }

const KEY = 'tf-decide:v1'
/** Ten colours, one per person: their avatar and the badge on their picks. */
export const PERSON_COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#14b8a6', '#f97316', '#84cc16', '#06b6d4']

const isPick = (value: any): value is Pick =>
  value && typeof value.key === 'string' && /^(movie|tv):\d{1,9}$/.test(value.key)
  && (value.media_type === 'movie' || value.media_type === 'tv') && typeof value.id === 'string' && typeof value.title === 'string'

export function loadState(): DecideState {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (!raw || typeof raw !== 'object') return EMPTY_STATE
    const people: DecidePerson[] = (Array.isArray(raw.people) ? raw.people : [])
      .filter((person: any) => person && typeof person.id === 'string' && typeof person.name === 'string' && cleanName(person.name))
      .slice(0, PEOPLE_MAX)
      .map((person: any, index: number) => ({ id: person.id, name: cleanName(person.name).slice(0, NAME_MAX), color: Number.isInteger(person.color) ? person.color % PERSON_COLORS.length : index }))
    const ids = new Set(people.map((person) => person.id))
    const seen = new Set<string>()
    const picks: Pick[] = (Array.isArray(raw.picks) ? raw.picks : [])
      .filter((pick: any) => isPick(pick) && !seen.has(pick.key) && seen.add(pick.key))
      .slice(0, PICKS_MAX)
      .map((pick: Pick) => ({
        key: pick.key, media_type: pick.media_type, id: pick.id, title: pick.title.slice(0, 200),
        poster_path: typeof pick.poster_path === 'string' ? pick.poster_path : null,
        backdrop_path: typeof pick.backdrop_path === 'string' ? pick.backdrop_path : null,
        year: typeof pick.year === 'string' ? pick.year.slice(0, 4) : '',
        by: typeof pick.by === 'string' && ids.has(pick.by) ? pick.by : null,
      }))
    return {
      people,
      picks,
      owner: typeof raw.owner === 'string' && ids.has(raw.owner) ? raw.owner : null,
      count: Number.isInteger(raw.count) ? Math.min(COUNT_MAX, Math.max(1, raw.count)) : 1,
      fair: raw.fair !== false,
      voteMode: raw.voteMode === 'hands' ? 'hands' : 'secret',
      lastChooser: typeof raw.lastChooser === 'string' ? cleanName(raw.lastChooser) || null : null,
    }
  } catch {
    return EMPTY_STATE
  }
}

export function saveState(state: DecideState) {
  try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* private mode: this visit only */ }
}

/** A short random id for a person (only has to be unique on this phone). */
export const newId = () => Math.random().toString(36).slice(2, 10)

// ---- the room's nights (lib/decide-nights) ----

const NIGHTS_KEY = 'tf-decide:nights:v1'

export function loadNights(): Night[] {
  try {
    return cleanNights(JSON.parse(localStorage.getItem(NIGHTS_KEY) ?? '[]'))
  } catch {
    return []
  }
}

export function saveNights(nights: Night[]) {
  try { localStorage.setItem(NIGHTS_KEY, JSON.stringify(nights.slice(0, NIGHTS_MAX))) } catch { /* private mode: this visit only */ }
}
