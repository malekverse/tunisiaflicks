// Ramadan hub: countdown, and the series that aired during each Ramadan (the big TV season in
// Tunisia and the Arab world). Dates are the expected first and last day of fasting in Tunisia;
// the real start depends on the moon sighting, so the UI always says "around".
import { tmdbFetchSafe, tmdbLanguage } from '@/src/lib/tmdb'
import { filterKidSafe } from '@/src/lib/kids'
import type { Locale } from '@/src/lib/i18n'

export const RAMADAN: Record<number, { start: string, end: string }> = {
  2020: { start: '2020-04-24', end: '2020-05-23' },
  2021: { start: '2021-04-13', end: '2021-05-12' },
  2022: { start: '2022-04-02', end: '2022-05-01' },
  2023: { start: '2023-03-23', end: '2023-04-20' },
  2024: { start: '2024-03-11', end: '2024-04-09' },
  2025: { start: '2025-03-01', end: '2025-03-29' },
  2026: { start: '2026-02-18', end: '2026-03-19' },
  2027: { start: '2027-02-08', end: '2027-03-09' },
  2028: { start: '2028-01-28', end: '2028-02-26' },
  2029: { start: '2029-01-16', end: '2029-02-14' },
}

/** Days before Ramadan from which the home page shows the seasonal banner. */
export const BANNER_DAYS_BEFORE = 45

const tunisDate = (now: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Tunis' }).format(now)
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000)
const shift = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10)

export type RamadanStatus =
  | { phase: 'during', year: number, start: string, end: string, day: number }
  | { phase: 'before', year: number, start: string, end: string, daysUntil: number }

/** Where we are relative to Ramadan (Tunis time). Null past the end of the table. */
export function ramadanStatus(now = new Date()): RamadanStatus | null {
  const today = tunisDate(now)
  for (const [year, { start, end }] of Object.entries(RAMADAN).map(([y, v]) => [Number(y), v] as const)) {
    if (today >= start && today <= end) return { phase: 'during', year, start, end, day: daysBetween(start, today) + 1 }
    if (today < start) return { phase: 'before', year, start, end, daysUntil: daysBetween(today, start) }
  }
  return null
}

/** Past Ramadans (most recent first), plus the current one while it's running. */
export function ramadanSeasons(now = new Date()) {
  const today = tunisDate(now)
  return Object.entries(RAMADAN)
    .map(([year, dates]) => ({ year: Number(year), ...dates }))
    .filter((season) => season.start <= today)
    .reverse()
}

const withPosters = (items: any[] | undefined) => (items ?? []).filter((item) => item.poster_path).map((item) => ({ ...item, media_type: 'tv' }))

/** Tunisian series on air during that Ramadan. */
export async function tunisianRamadanSeries(year: number, locale: Locale, kids: boolean) {
  const season = RAMADAN[year]
  const data = await tmdbFetchSafe<{ results: any[] }>('discover/tv', {
    with_origin_country: 'TN',
    'air_date.gte': shift(season.start, -3),
    'air_date.lte': shift(season.end, 3),
    sort_by: 'popularity.desc',
    language: tmdbLanguage(locale),
  }, 86400)
  const items = withPosters(data?.results)
  return kids ? filterKidSafe(items) : items
}

/** Arabic-language series that premiered at the start of that Ramadan (the "Ramadan race"). */
export async function arabRamadanSeries(year: number, locale: Locale, kids: boolean) {
  const season = RAMADAN[year]
  const data = await tmdbFetchSafe<{ results: any[] }>('discover/tv', {
    with_original_language: 'ar',
    'first_air_date.gte': shift(season.start, -7),
    'first_air_date.lte': shift(season.start, 10),
    sort_by: 'popularity.desc',
    without_genres: '10763,10767',
    language: tmdbLanguage(locale),
  }, 86400)
  const items = withPosters(data?.results)
  return kids ? filterKidSafe(items) : items
}
