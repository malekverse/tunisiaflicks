// Screen time for Kids profiles, set from a grown-up profile (Settings > Profiles): a daily limit
// of watching, and a bedtime until the morning. Time counts while the player is open on a page in
// view; once the day's time is used up, or it's bedtime, the player gives way to a friendly
// "that's all for today". Days and hours are the device's own (a family's evening is local).
// Shared by server and client code; pure, so it's unit-tested.

export type ScreenTime = {
  /** Minutes a day, or null for no limit. */
  limit: number | null
  /** "HH:MM" bedtime, or null for none; it lasts until `wake`. */
  bedtime: string | null
  wake: string
}

export const LIMITS = [30, 45, 60, 90, 120, 180] as const
export const BEDTIMES = ['19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00', '22:30'] as const
export const WAKE = '07:00'
/** The heads-up before the end. */
export const SOON_MINUTES = 5
/** Minutes one report may add (a page reports every few minutes). */
export const MAX_REPORT = 10

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/
export const minutesOf = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))

/** A grown-up's settings, checked: null when nothing is limited (or it's not settings at all). */
export function cleanScreenTime(raw: unknown): ScreenTime | null {
  if (!raw || typeof raw !== 'object') return null
  const value = raw as Record<string, unknown>
  const limit = (LIMITS as readonly number[]).includes(value.limit as number) ? value.limit as number : null
  const bedtime = (BEDTIMES as readonly string[]).includes(value.bedtime as string) ? value.bedtime as string : null
  const wake = typeof value.wake === 'string' && HHMM.test(value.wake) ? value.wake : WAKE
  return limit === null && bedtime === null ? null : { limit, bedtime, wake }
}

/** Is `now` (minutes since local midnight) between bedtime and the morning? */
export function inBedtime(screen: ScreenTime | null, now: number): boolean {
  if (!screen?.bedtime) return false
  const from = minutesOf(screen.bedtime)
  const to = minutesOf(screen.wake)
  return from > to ? now >= from || now < to : now >= from && now < to
}

export type ScreenState = {
  /** Watching is over for now: the day's time is used up, or it's bedtime. */
  stop: 'limit' | 'bedtime' | null
  /** Minutes left before it stops (the sooner of the two), or null when nothing limits it. */
  left: number | null
}

export function screenState(screen: ScreenTime | null, used: number, now: number): ScreenState {
  if (!screen) return { stop: null, left: null }
  if (inBedtime(screen, now)) return { stop: 'bedtime', left: 0 }
  if (screen.limit !== null && used >= screen.limit) return { stop: 'limit', left: 0 }
  const toLimit = screen.limit !== null ? screen.limit - used : null
  let toBed: number | null = null
  if (screen.bedtime) {
    const from = minutesOf(screen.bedtime)
    toBed = from > now ? from - now : from + 1440 - now
  }
  const candidates = [toLimit, toBed].filter((value): value is number => value !== null)
  return { stop: null, left: candidates.length ? Math.min(...candidates) : null }
}

/** The device's day ("2026-11-24") and minutes since its midnight. */
export function localClock(date: Date = new Date()): { day: string, minutes: number } {
  const pad = (value: number) => String(value).padStart(2, '0')
  return {
    day: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    minutes: date.getHours() * 60 + date.getMinutes(),
  }
}

/** A day a device may report: a real date within a day of the server's (time zones). */
export function isReportableDay(day: unknown, now: Date = new Date()): day is string {
  if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return false
  const at = Date.parse(`${day}T12:00:00Z`)
  return Number.isFinite(at) && Math.abs(at - now.getTime()) <= 36 * 3600_000
}
