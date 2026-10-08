// Ramadan hub: countdown, and the series that aired during each Ramadan (the big TV season in
// Tunisia and the Arab world). The dates come from the Hijri calendar (lib/hijri), so the hub keeps
// working every year without anyone updating it; the real start depends on the moon sighting, so
// the UI always says "around".
import { tmdbFetchSafe, tmdbLanguage } from '@/src/lib/tmdb'
import { filterKidSafe } from '@/src/lib/kids'
import { addDays, daysBetween, nextHijriPeriod, ramadanOf, toHijri, tunisDate, type HijriPeriod } from '@/src/lib/hijri'
import type { Locale } from '@/src/lib/i18n'

/** Days before Ramadan from which the home page shows the seasonal banner. */
export const BANNER_DAYS_BEFORE = 45

/**
 * One Ramadan. `year` is the Gregorian year it starts in (for labels and TMDB queries); two
 * Ramadans can start in the same Gregorian year (2030), so lists are keyed by `hijriYear`.
 */
export type RamadanSeason = HijriPeriod & { year: number }

const season = (hijriYear: number): RamadanSeason => {
  const period = ramadanOf(hijriYear)
  return { ...period, year: Number(period.start.slice(0, 4)) }
}

export type RamadanStatus =
  | (RamadanSeason & { phase: 'during', day: number })
  | (RamadanSeason & { phase: 'before', daysUntil: number })

/** Where we are relative to Ramadan (Tunis time): during it, or counting down to the next one. */
export function ramadanStatus(now = new Date()): RamadanStatus {
  const today = tunisDate(now)
  const current = season(nextHijriPeriod(today, ramadanOf).hijriYear)
  return current.start <= today
    ? { ...current, phase: 'during', day: daysBetween(current.start, today) + 1 }
    : { ...current, phase: 'before', daysUntil: daysBetween(today, current.start) }
}

/** Ramadans that have begun, the current one first. */
export function ramadanSeasons(now = new Date(), count = 5): RamadanSeason[] {
  const today = tunisDate(now)
  const { year } = toHijri(today)
  return Array.from({ length: count + 1 }, (_, index) => season(year - index))
    .filter((item) => item.start <= today)
    .slice(0, count)
}

const withPosters = (items: any[] | undefined) => (items ?? []).filter((item) => item.poster_path).map((item) => ({ ...item, media_type: 'tv' }))

/** Tunisian series on air during that Ramadan. */
export async function tunisianRamadanSeries(ramadan: HijriPeriod, locale: Locale, kids: boolean) {
  const data = await tmdbFetchSafe<{ results: any[] }>('discover/tv', {
    with_origin_country: 'TN',
    'air_date.gte': addDays(ramadan.start, -3),
    'air_date.lte': addDays(ramadan.end, 3),
    sort_by: 'popularity.desc',
    language: tmdbLanguage(locale),
  }, 86400)
  const items = withPosters(data?.results)
  return kids ? filterKidSafe(items) : items
}

/** Arabic-language series that premiered at the start of that Ramadan (the "Ramadan race"). */
export async function arabRamadanSeries(ramadan: HijriPeriod, locale: Locale, kids: boolean) {
  const data = await tmdbFetchSafe<{ results: any[] }>('discover/tv', {
    with_original_language: 'ar',
    'first_air_date.gte': addDays(ramadan.start, -7),
    'first_air_date.lte': addDays(ramadan.start, 10),
    sort_by: 'popularity.desc',
    without_genres: '10763,10767',
    language: tmdbLanguage(locale),
  }, 86400)
  const items = withPosters(data?.results)
  return kids ? filterKidSafe(items) : items
}
