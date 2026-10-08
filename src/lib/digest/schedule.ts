// When the weekly digest goes out. One edition per week, named after its Friday (Tunis date): it
// opens that Friday at 17:00 Tunis time (21:30 during Ramadan, after iftar and the evening's
// shows) and stays open three days, while the cron sends it a slice at a time. Pure date maths
// (no database), shared by the cron, the settings ("Next one: Friday...") and the tests.
import { addDays, nextHijriPeriod, ramadanOf, tunisDate } from '@/src/lib/hijri'

const DAY = 86400000
export const WINDOW_DAYS = 3
export const OPENS_AT = { hour: 17, minute: 0 }
export const OPENS_AT_RAMADAN = { hour: 21, minute: 30 }

export type Edition = {
  /** The Friday it is named after (YYYY-MM-DD, Tunis). */
  id: string
  opensAt: Date
  closesAt: Date
  inRamadan: boolean
}

const wallClock = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Africa/Tunis', hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric',
})

/** Tunis time minus UTC at `at`, in minutes (Tunisia is UTC+1 without summer time, but don't assume). */
function tunisOffsetMinutes(at: Date): number {
  const parts = Object.fromEntries(wallClock.formatToParts(at).map((part) => [part.type, Number(part.value)]))
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
  return Math.round((asUtc - Math.floor(at.getTime() / 1000) * 1000) / 60000)
}

/** The instant of a wall-clock time in Tunis on `date` (YYYY-MM-DD). */
export function tunisInstant(date: string, hour: number, minute: number): Date {
  const [year, month, day] = date.split('-').map(Number)
  const naive = Date.UTC(year, month - 1, day, hour, minute)
  return new Date(naive - tunisOffsetMinutes(new Date(naive)) * 60000)
}

/** Whether a day (YYYY-MM-DD) falls in Ramadan (Umm al-Qura dates, as everywhere on the site). */
export function isRamadanDay(date: string): boolean {
  const period = nextHijriPeriod(date, ramadanOf)
  return period.start <= date && date <= period.end
}

/** The edition named after `friday`. */
export function editionOn(friday: string): Edition {
  const inRamadan = isRamadanDay(friday)
  const time = inRamadan ? OPENS_AT_RAMADAN : OPENS_AT
  const opensAt = tunisInstant(friday, time.hour, time.minute)
  return { id: friday, opensAt, closesAt: new Date(opensAt.getTime() + WINDOW_DAYS * DAY), inRamadan }
}

/** The last Friday on or before `now`'s date in Tunis. */
function fridayOnOrBefore(now: Date): string {
  const today = tunisDate(now)
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay() // 5 = Friday
  return addDays(today, -((weekday - 5 + 7) % 7))
}

/** The latest edition that has opened by `now` (its window may already be over). */
export function editionFor(now: Date = new Date()): Edition {
  const edition = editionOn(fridayOnOrBefore(now))
  return now < edition.opensAt ? editionOn(addDays(edition.id, -7)) : edition
}

/** The next edition to open after `now`. */
export function nextEdition(now: Date = new Date()): Edition {
  const edition = editionOn(fridayOnOrBefore(now))
  return now < edition.opensAt ? edition : editionOn(addDays(edition.id, 7))
}

export const isOpen = (edition: Edition, now: Date = new Date()) => now >= edition.opensAt && now < edition.closesAt

/** The week an edition looks back on: the seven days before it opens. */
export const editionWeek = (edition: Edition) => ({ since: new Date(edition.opensAt.getTime() - 7 * DAY), until: edition.opensAt })
