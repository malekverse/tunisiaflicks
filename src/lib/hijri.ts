// The Islamic (Hijri) calendar, computed rather than looked up: Ramadan, the Eids and the Hijri new
// year move about eleven days earlier every year, and a hand-kept table of dates runs out. Node's
// ICU knows the Umm al-Qura calendar (valid 1882 to 2174, arithmetic beyond), which matched every
// Ramadan of the old table. In Tunisia the real dates follow the moon sighting and can be a day
// apart, which is why the UI says "around".

export type HijriDate = { year: number, month: number, day: number }

/** Hijri months the site cares about. */
export const MUHARRAM = 1
export const RAMADAN = 9
export const SHAWWAL = 10
export const DHU_AL_HIJJAH = 12

const DAY = 86400000

const formatter = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { timeZone: 'UTC', year: 'numeric', month: 'numeric', day: 'numeric' })

/** A Gregorian day (YYYY-MM-DD) in the Hijri calendar. */
export function toHijri(date: string): HijriDate {
  const parts = Object.fromEntries(formatter.formatToParts(new Date(`${date}T12:00:00Z`)).map((part) => [part.type, part.value]))
  return { year: Number(String(parts.year).replace(/\D/g, '')), month: Number(parts.month), day: Number(parts.day) }
}

export const addDays = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10)
export const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY)

const cache = new Map<string, string>()

/** The Gregorian day (YYYY-MM-DD) of a Hijri date. */
export function fromHijri(year: number, month: number, day = 1): string {
  const key = `${year}-${month}-${day}`
  const known = cache.get(key)
  if (known) return known
  // The arithmetic (civil) calendar lands within a day or two of Umm al-Qura; then walk to it.
  const months = (year - 1) * 12 + (month - 1)
  const epoch = Date.UTC(622, 6, 16) // 1 Muharram 1 AH
  let guess = new Date(epoch + (months * 29.530588 + day - 1) * DAY).toISOString().slice(0, 10)
  for (let step = 0; step < 40; step++) {
    const current = toHijri(guess)
    const diff = (current.year - year) * 354 + (current.month - month) * 29.5 + (current.day - day)
    if (Math.abs(diff) < 0.5) break
    guess = addDays(guess, diff > 0 ? -Math.max(1, Math.floor(Math.abs(diff))) : Math.max(1, Math.floor(Math.abs(diff))))
  }
  cache.set(key, guess)
  return guess
}

/** Today in Tunisia (YYYY-MM-DD). */
export const tunisDate = (now = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Tunis' }).format(now)

export type HijriPeriod = { hijriYear: number, start: string, end: string }

/** A span of Hijri days (inclusive), e.g. Ramadan or the days of Eid al-Adha. */
export function hijriPeriod(hijriYear: number, month: number, firstDay: number, days: number): HijriPeriod {
  const start = fromHijri(hijriYear, month, firstDay)
  return { hijriYear, start, end: addDays(start, days - 1) }
}

/** Ramadan of a Hijri year: from 1 Ramadan to the day before Eid al-Fitr. */
export function ramadanOf(hijriYear: number): HijriPeriod {
  const start = fromHijri(hijriYear, RAMADAN, 1)
  return { hijriYear, start, end: addDays(fromHijri(hijriYear, SHAWWAL, 1), -1) }
}

/**
 * The next (or current) occurrence of a yearly Hijri period, seen from `today`. Returns the one
 * running now, or else the next one to start.
 */
export function nextHijriPeriod(today: string, make: (hijriYear: number) => HijriPeriod): HijriPeriod {
  const { year } = toHijri(today)
  for (const candidate of [year - 1, year, year + 1].map(make)) {
    if (candidate.end >= today) return candidate
  }
  return make(year + 2)
}
