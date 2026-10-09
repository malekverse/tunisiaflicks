// Movie nights, the pure rules: ids, limits, time zones, the quick day chips, the vote and its
// tie-break, when a vote closes, when reminders are due, and who sees what. No database, no
// Next.js, no Node-only modules: the server library, the client form and the unit tests
// (tests/movie-night.unit.test.mts) all use these as they are.
import { ramadanOf, toHijri } from '@/src/lib/hijri'

// ---------------------------------------------------------------------------------------------
// Ids and limits

/** No 0/O or 1/I: ids end up in links people read out or copy by hand. */
export const NIGHT_ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const NIGHT_ID_LENGTH = 10
export const isNightId = (value: unknown): value is string => typeof value === 'string' && /^[A-HJ-NP-Z2-9]{10}$/.test(value)

/** A new id, from a uniform random integer source (crypto.randomInt on the server). */
export function newNightId(randomInt: (max: number) => number): string {
  return Array.from({ length: NIGHT_ID_LENGTH }, () => NIGHT_ID_ALPHABET[randomInt(NIGHT_ID_ALPHABET.length)]).join('')
}

export const TITLE_MAX = 60
export const PLACE_MAX = 80
export const NIGHT_NOTE_MAX = 280
export const GUESTS_MAX = 20
/** The host proposes up to three picks; every guest may suggest one; six at most in all. */
export const HOST_PICKS_MAX = 3
export const GUEST_PICKS_MAX = 1
export const CANDIDATES_MAX = 6
/** Planned nights still to come, per host. */
export const UPCOMING_MAX = 10
/** Uses of one invitation link. */
export const INVITE_USES = 20

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** A night starts at least 30 minutes from now and at most 60 days out. */
export const MIN_LEAD_MS = 30 * MINUTE
export const MAX_AHEAD_MS = 60 * DAY
/** How long a night lasts (the calendar event). */
export const NIGHT_LENGTH_MS = 3 * HOUR
/** Nights are kept for two weeks after they end (TTL), then they go. */
export const KEEP_AFTER_MS = 14 * DAY
/** The vote closes two hours before the start unless the host says otherwise. */
export const VOTE_LEAD_MS = 2 * HOUR
/** 'Watch now' shows from 30 minutes before the start to 4 hours after. */
export const WATCH_BEFORE_MS = 30 * MINUTE
export const WATCH_AFTER_MS = 4 * HOUR

export const DEFAULT_TZ = 'Africa/Tunis'

export type GuestStatus = 'invited' | 'requested' | 'going' | 'cant'
export type ChosenBy = 'host' | 'swipe' | 'vote'

/** "movie:550" or "tv:1396": a candidate's key (and a swipe card's). */
export const isCandidateKey = (value: unknown): value is string => typeof value === 'string' && /^(movie|tv):[0-9]{1,9}$/.test(value)
export const parseCandidateKey = (key: string) => {
  const [media_type, id] = key.split(':') as ['movie' | 'tv', string]
  return { media_type, id }
}

/** Profile ids are 24 hex characters; anything else never becomes a field path (votes.<id>). */
export const isProfileKey = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value)

// ---------------------------------------------------------------------------------------------
// Time zones (Intl only: no library, the same answer on the server and in the browser)

/** A real IANA zone this runtime knows ('Africa/Tunis', 'Europe/Paris'). */
export function isTimeZone(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 64 || !/^[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+){0,2}$/.test(value)) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value })
    return true
  } catch {
    return false
  }
}

const partsFormatters = new Map<string, Intl.DateTimeFormat>()

function partsFormatter(tz: string) {
  let format = partsFormatters.get(tz)
  if (!format) {
    format = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
    partsFormatters.set(tz, format)
  }
  return format
}

/** The wall clock in `tz` at `date`. */
export function zonedParts(date: Date | number, tz: string) {
  const parts = Object.fromEntries(partsFormatter(tz).formatToParts(new Date(date)).map((part) => [part.type, part.value]))
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    // Some runtimes still say 24 for midnight in h23.
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    second: Number(parts.second),
  }
}

const pad = (value: number) => String(value).padStart(2, '0')

/** 'YYYY-MM-DD' in `tz`. */
export function zonedDay(date: Date | number, tz: string): string {
  const p = zonedParts(date, tz)
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`
}

/** 'HH:MM' (24-hour) in `tz`. */
export function zonedTime(date: Date | number, tz: string): string {
  const p = zonedParts(date, tz)
  return `${pad(p.hour)}:${pad(p.minute)}`
}

/** How far `tz` is ahead of UTC at that instant, in ms. */
export function tzOffsetMs(at: number, tz: string): number {
  const p = zonedParts(at, tz)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return asUtc - Math.floor(at / 1000) * 1000
}

/** A real calendar day, 'YYYY-MM-DD' (not 2026-02-30). */
export const isDay = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
export const isClockTime = (value: unknown): value is string => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)

/**
 * The instant a wall-clock time happens in `tz` ('2026-03-29', '02:30', 'Europe/Paris'), across
 * daylight-saving changes. A time that doesn't exist (the hour skipped in spring) moves forward by
 * the gap; a time that happens twice (autumn) is one of its two moments. Null for malformed input.
 */
export function zonedToUtc(day: string, time: string, tz: string): Date | null {
  if (!isDay(day) || !isClockTime(time) || !isTimeZone(tz)) return null
  const [y, m, d] = day.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  // Read the wall time as if it were UTC, then correct by the zone's offset at the answer.
  const guess = Date.UTC(y, m - 1, d, hh, mm)
  const first = tzOffsetMs(guess, tz)
  const t1 = guess - first
  const second = tzOffsetMs(t1, tz)
  if (second === first) return new Date(t1)
  const t2 = guess - second
  if (tzOffsetMs(t2, tz) === second) return new Date(t2)
  // A spring-forward gap: neither reading exists. The later one is the wall time pushed past it.
  return new Date(Math.max(t1, t2))
}

export const addDays = (day: string, days: number) => new Date(Date.parse(`${day}T12:00:00Z`) + days * DAY).toISOString().slice(0, 10)
/** 0 = Sunday … 6 = Saturday, of a calendar day. */
export const weekdayOf = (day: string) => new Date(`${day}T12:00:00Z`).getUTCDay()

// ---------------------------------------------------------------------------------------------
// The "When" chips and the default time

export type QuickDayId = 'tonight' | 'tomorrow' | 'friday' | 'saturday'
export type QuickDay = { id: QuickDayId; day: string }

/** Tonight is offered until 20:30 (a night has to start at least 30 minutes from now). */
export const TONIGHT_UNTIL = '20:30'

/**
 * Tonight (before 20:30 there), tomorrow, the coming Friday and the coming Saturday, in date
 * order and without repeats (a Friday that is tomorrow is just 'Tomorrow').
 */
export function quickDays(now: Date | number, tz: string): QuickDay[] {
  const today = zonedDay(now, tz)
  const chips: QuickDay[] = []
  if (zonedTime(now, tz) < TONIGHT_UNTIL) chips.push({ id: 'tonight', day: today })
  chips.push({ id: 'tomorrow', day: addDays(today, 1) })
  for (const [id, weekday] of [['friday', 5], ['saturday', 6]] as const) {
    const ahead = ((weekday - weekdayOf(today) + 7) % 7) || 7
    const day = addDays(today, ahead)
    if (!chips.some((chip) => chip.day === day)) chips.push({ id, day })
  }
  return chips.sort((a, b) => a.day.localeCompare(b.day))
}

/** Whether a calendar day falls in Ramadan (the site's own Hijri calendar, lib/hijri.ts). */
export function isRamadanDay(day: string): boolean {
  if (!isDay(day)) return false
  const period = ramadanOf(toHijri(day).year)
  return day >= period.start && day <= period.end
}

/** 21:00, or 22:00 during Ramadan (after iftar and the evening prayers). */
export const defaultTime = (day: string) => (isRamadanDay(day) ? '22:00' : '21:00')

export type StartProblem = 'past' | 'too_soon' | 'too_far'

/** At least 30 minutes ahead, at most 60 days out. */
export function checkStart(startsAt: Date | number, now: Date | number): StartProblem | null {
  const lead = new Date(startsAt).getTime() - new Date(now).getTime()
  if (Number.isNaN(lead)) return 'past'
  if (lead <= 0) return 'past'
  if (lead < MIN_LEAD_MS) return 'too_soon'
  if (lead > MAX_AHEAD_MS) return 'too_far'
  return null
}

// ---------------------------------------------------------------------------------------------
// The vote

/**
 * When the vote closes by default: two hours before the start, but never before 30 minutes
 * from now (a night planned for in an hour still gets a vote) and never after the start.
 */
export function defaultVoteClose(startsAt: Date | number, now: Date | number): Date {
  const start = new Date(startsAt).getTime()
  const soonest = Math.min(new Date(now).getTime() + 30 * MINUTE, start)
  return new Date(Math.max(start - VOTE_LEAD_MS, soonest))
}

/** A close time the host picked: between 5 minutes from now and the start. Null when it isn't. */
export function checkVoteClose(closesAt: Date | number, startsAt: Date | number, now: Date | number): Date | null {
  const close = new Date(closesAt).getTime()
  if (Number.isNaN(close)) return null
  if (close > new Date(startsAt).getTime()) return null
  if (close < new Date(now).getTime() + 5 * MINUTE) return null
  return new Date(close)
}

type VoteNight = {
  status: 'planned' | 'cancelled'
  chosen: unknown | null
  candidates: { key: string }[]
  vote_closes_at: Date | string | number
  vote_closed_at?: Date | string | number | null
}

/** Votes can be cast (or changed) right now. */
export function voteIsOpen(night: VoteNight, now: Date | number): boolean {
  return night.status === 'planned' && !night.chosen && !night.vote_closed_at && new Date(now).getTime() < new Date(night.vote_closes_at).getTime()
}

/** The vote is over and nobody has set the film yet: resolve it (lazily, on read or by the cron). */
export function resolveDue(night: VoteNight, now: Date | number): boolean {
  if (night.status !== 'planned' || night.chosen || night.candidates.length === 0) return false
  return !!night.vote_closed_at || new Date(now).getTime() >= new Date(night.vote_closes_at).getTime()
}

export type Tally = {
  /** Votes per candidate key (every candidate present, zeros included). */
  counts: Record<string, number>
  /** The candidates in final order, the winner first. */
  order: string[]
  winner: string | null
}

/**
 * Counts the votes. Most votes wins. A tie goes to the candidate that reached its count first
 * (its latest vote is the earliest), then to the host's own vote, then to candidate order.
 * Votes for something that is no longer a candidate don't count.
 */
export function tally(
  candidates: { key: string }[],
  votes: Record<string, string>,
  voteAt: Record<string, Date | string | number>,
  hostProfileId?: string | null,
): Tally {
  const keys = candidates.map((candidate) => candidate.key)
  const counts: Record<string, number> = Object.fromEntries(keys.map((key) => [key, 0]))
  const reachedAt: Record<string, number> = Object.fromEntries(keys.map((key) => [key, Infinity]))
  for (const [voter, key] of Object.entries(votes ?? {})) {
    if (!(key in counts)) continue
    counts[key] += 1
    const at = new Date(voteAt?.[voter] ?? 0).getTime()
    const when = Number.isNaN(at) ? 0 : at
    reachedAt[key] = reachedAt[key] === Infinity ? when : Math.max(reachedAt[key], when)
  }
  const hostPick = hostProfileId ? votes?.[hostProfileId] : undefined
  const order = [...keys].sort((a, b) =>
    counts[b] - counts[a]
    || reachedAt[a] - reachedAt[b]
    || Number(b === hostPick) - Number(a === hostPick)
    || keys.indexOf(a) - keys.indexOf(b))
  return { counts, order, winner: order[0] ?? null }
}

/** Who may vote: the host, and guests who are going or still invited. */
export const mayVote = (role: GuestStatus | 'host' | null) => role === 'host' || role === 'going' || role === 'invited'

/** How many picks someone may still add: the host up to three, each guest one, six in all. */
export function picksLeft(candidates: { added_by: string | null }[], profileId: string, isHost: boolean): number {
  const mine = candidates.filter((candidate) => candidate.added_by === profileId).length
  const room = CANDIDATES_MAX - candidates.length
  return Math.max(0, Math.min(room, (isHost ? HOST_PICKS_MAX : GUEST_PICKS_MAX) - mine))
}

// ---------------------------------------------------------------------------------------------
// Reminders

type ReminderNight = {
  status: 'planned' | 'cancelled'
  starts_at: Date | string | number
  created_at: Date | string | number
  reminded?: { day?: boolean; hour?: boolean } | null
}

/**
 * Which reminder a night needs now, if any. The hour one in the last hour before the start. The
 * day one in the 24 hours before (until 2 hours before), and only for nights planned more than a
 * day ahead (someone who planned tonight's film at lunch doesn't need a "tomorrow" reminder).
 */
export function reminderDue(night: ReminderNight, now: Date | number): 'day' | 'hour' | null {
  if (night.status !== 'planned') return null
  const start = new Date(night.starts_at).getTime()
  const lead = start - new Date(now).getTime()
  if (lead <= 0) return null
  if (!night.reminded?.hour && lead <= HOUR) return 'hour'
  const plannedEarly = start - new Date(night.created_at).getTime() > DAY
  if (!night.reminded?.day && plannedEarly && lead <= DAY && lead > 2 * HOUR) return 'day'
  return null
}

// ---------------------------------------------------------------------------------------------
// Who sees what

export type NightRole = 'host' | GuestStatus | null

/** Someone's place in a night: the host, a guest (by status), or nobody. */
export function roleOf(night: { host: { profileId: string }; guests: { ref: { profileId: string }; status: GuestStatus }[] }, profileId: string | null | undefined): NightRole {
  if (!profileId) return null
  if (night.host.profileId === profileId) return 'host'
  return night.guests.find((guest) => guest.ref.profileId === profileId)?.status ?? null
}

/**
 * What a viewer gets: the whole night (host, invited, going, can't), a preview (someone waiting
 * for approval, or holding a working invitation link: the date, the host's first name and the
 * posters, never the guests, the place or the note), or nothing (a 404).
 */
export function accessFor(role: NightRole, tokenWorks: boolean): 'member' | 'preview' | 'none' {
  if (role === 'host' || role === 'invited' || role === 'going' || role === 'cant') return 'member'
  if (role === 'requested' || tokenWorks) return 'preview'
  return 'none'
}

/** A link join waits for the host's approval when the night has a place or a note (private details). */
export const joinNeedsApproval = (night: { place?: string | null; note?: string | null }) => !!(night.place?.trim() || night.note?.trim())

/** 'Watch now' shows from 30 minutes before the start until 4 hours after. */
export function watchWindow(startsAt: Date | number | string, now: Date | number): 'before' | 'now' | 'after' {
  const start = new Date(startsAt).getTime()
  const at = new Date(now).getTime()
  if (at < start - WATCH_BEFORE_MS) return 'before'
  if (at > start + WATCH_AFTER_MS) return 'after'
  return 'now'
}

/** How often the night page asks for news: every 15 seconds, every minute once it has started. */
export const pollInterval = (startsAt: Date | number | string, now: Date | number) =>
  new Date(now).getTime() >= new Date(startsAt).getTime() ? 60_000 : 15_000

/** The first name of a display name ('Sami Ben Ali' -> 'Sami'), for previews. */
export const firstName = (name: string) => (name.trim().split(/\s+/)[0] ?? '').slice(0, 24)
