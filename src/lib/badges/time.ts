// Days, hours and weeks for the badges. A play is filed under the day it happened where the person
// was (their browser's time zone, sent with the play and never stored); weeks are ISO weeks
// (Monday first) and "this week" is the week in Tunis. Pure, safe in unit tests.

export const DEFAULT_TIME_ZONE = 'Africa/Tunis'

const DAY_MS = 86_400_000
const ZONE_RE = /^[A-Za-z][A-Za-z0-9_+\-/]{0,63}$/

const formatters = new Map<string, Intl.DateTimeFormat>()

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
    })
    formatters.set(timeZone, formatter)
  }
  return formatter
}

/** A time zone the runtime knows (an IANA name such as 'Europe/Paris'), else Tunis. */
export function safeTimeZone(value: unknown): string {
  if (typeof value !== 'string' || !ZONE_RE.test(value)) return DEFAULT_TIME_ZONE
  try {
    formatterFor(value)
    return value
  } catch {
    return DEFAULT_TIME_ZONE
  }
}

export type LocalDay = {
  /** 'YYYY-MM-DD' where the person was. */
  day: string
  /** 'YYYY-MM' (the watchActivity document). */
  month: string
  /** Day of the month, 1..31. */
  d: number
  /** 0..23. */
  hour: number
}

/** When `at` happened in `timeZone`. */
export function localDay(at: Date, timeZone: string = DEFAULT_TIME_ZONE): LocalDay {
  const parts: Record<string, string> = {}
  for (const part of formatterFor(safeTimeZone(timeZone)).formatToParts(at)) parts[part.type] = part.value
  const hour = Number(parts.hour) % 24
  return { day: `${parts.year}-${parts.month}-${parts.day}`, month: `${parts.year}-${parts.month}`, d: Number(parts.day), hour }
}

/** The day flags of an hour: n (night, 00:00 to 04:59) and e (early, 05:00 to 08:59). */
export function hourFlags(hour: number): { n?: true; e?: true } {
  if (hour >= 0 && hour <= 4) return { n: true }
  if (hour >= 5 && hour <= 8) return { e: true }
  return {}
}

/** Today in Tunis ('YYYY-MM-DD'). */
export const tunisToday = (now: Date = new Date()) => localDay(now, DEFAULT_TIME_ZONE).day

const dayNumber = (day: string) => Math.floor(Date.parse(`${day}T00:00:00Z`) / DAY_MS)

/** A running number per ISO week (Monday to Sunday): consecutive weeks differ by one. */
export function weekIndex(day: string): number {
  // 1970-01-01 was a Thursday: shifting by 3 days puts every Monday at the start of a week.
  return Math.floor((dayNumber(day) + 3) / 7)
}

/** 'YYYY-MM-DD' of `month` ('YYYY-MM') and day `d`. */
export const dayOf = (month: string, d: number) => `${month}-${String(d).padStart(2, '0')}`

export type Streak = { current: number; best: number; thisWeek: boolean }

/**
 * Consecutive weeks with at least one play. `current` still counts while this week has no play
 * yet (the run ending last week is alive until this week is over); it is 0 once a whole week went
 * by without one. `best` is the longest run in `days`.
 */
export function weeklyStreak(days: Iterable<string>, today: string): Streak {
  const weeks = new Set<number>()
  for (const day of days) if (/^\d{4}-\d{2}-\d{2}$/.test(day)) weeks.add(weekIndex(day))
  const sorted = [...weeks].sort((a, b) => a - b)
  let best = 0
  let run = 0
  let previous: number | null = null
  for (const week of sorted) {
    run = previous !== null && week === previous + 1 ? run + 1 : 1
    best = Math.max(best, run)
    previous = week
  }
  const now = weekIndex(today)
  const thisWeek = weeks.has(now)
  let current = 0
  let cursor = thisWeek ? now : weeks.has(now - 1) ? now - 1 : null
  while (cursor !== null && weeks.has(cursor)) {
    current++
    cursor--
  }
  return { current, best, thisWeek }
}

/** First of the month 13 months after `month` ('YYYY-MM'): when that month's log goes away. */
export function activityExpiry(month: string): Date {
  const [year, monthIndex] = month.split('-').map(Number)
  return new Date(Date.UTC(year, monthIndex - 1 + 13, 1))
}
