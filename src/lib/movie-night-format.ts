// How a night's date and time read, in the viewer's language: always in the night's own time zone
// (where it happens), 24-hour clock, plus "your time" when the viewer's zone says otherwise.
// Client-safe (Intl only), so the server render and the browser agree.
import { dateLocale, type Locale } from '@/src/lib/i18n/locales'
import { formatDate } from '@/src/lib/i18n/format'
import { tzOffsetMs, zonedDay, addDays } from './movie-night-rules'

/** "Friday 9 October" (in the night's zone). */
export const nightDay = (at: string | Date, tz: string, locale: Locale, o: { year?: boolean } = {}) =>
  formatDate(at, locale, { weekday: 'long', day: 'numeric', month: 'long', ...(o.year ? { year: 'numeric' } : {}), timeZone: tz }, { headline: true })

/** "Fri 9 Oct" */
export const nightDayShort = (at: string | Date, tz: string, locale: Locale) =>
  formatDate(at, locale, { weekday: 'short', day: 'numeric', month: 'short', timeZone: tz }, { headline: true })

/** "21:00": 24-hour, in `tz`. */
export function nightTime(at: string | Date, tz: string, locale: Locale): string {
  try {
    return new Intl.DateTimeFormat(dateLocale(locale), { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: tz }).format(new Date(at))
  } catch {
    return new Date(at).toISOString().slice(11, 16)
  }
}

/** The calendar leaf: "Oct", "9", "Fri". */
export function leafParts(at: string | Date, tz: string, locale: Locale) {
  const part = (options: Intl.DateTimeFormatOptions) => {
    try {
      return new Intl.DateTimeFormat(dateLocale(locale), { ...options, timeZone: tz }).format(new Date(at))
    } catch {
      return ''
    }
  }
  return {
    month: part({ month: 'short' }).replace(/\.$/, ''),
    day: part({ day: 'numeric' }),
    weekday: part({ weekday: 'short' }).replace(/\.$/, ''),
  }
}

/** 'today' or 'tomorrow' in the night's zone, else null. */
export function relativeDay(at: string | Date, tz: string, now: Date = new Date()): 'today' | 'tomorrow' | null {
  const day = zonedDay(new Date(at), tz)
  const today = zonedDay(now, tz)
  if (day === today) return 'today'
  if (day === addDays(today, 1)) return 'tomorrow'
  return null
}

/** The viewer's own zone (the browser's), or null on the server / when unknown. */
export function viewerZone(): string | null {
  try {
    return typeof window === 'undefined' ? null : Intl.DateTimeFormat().resolvedOptions().timeZone || null
  } catch {
    return null
  }
}

/** Whether the viewer's clock reads a different time than the night's zone at that moment. */
export function differsForViewer(at: string | Date, tz: string, zone: string | null): boolean {
  if (!zone || zone === tz) return false
  const when = new Date(at).getTime()
  try {
    return tzOffsetMs(when, zone) !== tzOffsetMs(when, tz)
  } catch {
    return false
  }
}

/** A zone's readable city ('Africa/Tunis' -> 'Tunis', 'America/New_York' -> 'New York'). */
export const zoneCity = (tz: string) => (tz.split('/').pop() ?? tz).replace(/_/g, ' ')
