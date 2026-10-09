// The small phrases under Tunisian TV tiles and headers ("Episode 8", "New episodes every
// Thursday", "3 hours ago"). Client-safe: a translator comes in, plain strings go out.
import type { Translate } from '@/src/lib/i18n/translate'
import type { Cadence } from './parse'
import type { TvVideoView } from './view'

/** "Episode 8", "Season 2, episode 30", or null when the upload numbers none. */
export function episodeLabel(t: Translate, video: Pick<TvVideoView, 'episode' | 'season'>): string | null {
  if (video.episode === null || video.episode === undefined) return null
  return video.season ? t('ttv.seasonEpisode', { s: video.season, n: video.episode }) : t('ttv.episode', { n: video.episode })
}

/** Weekday names in the reader's language (0 = Sunday). */
function weekdayName(day: number, dateLocale: string): string {
  // 2026-10-04 was a Sunday.
  return new Date(Date.UTC(2026, 9, 4 + day, 12)).toLocaleDateString(dateLocale, { weekday: 'long', timeZone: 'UTC' })
}

/** "New episodes every day / every weekday / on Monday and Thursday / every Thursday". */
export function cadenceLine(t: Translate, cadence: Cadence | null | undefined, dateLocale: string): string | null {
  if (!cadence) return null
  if (cadence.kind === 'daily') return t('ttv.cadence.daily')
  if (cadence.kind === 'weekdays') return t('ttv.cadence.weekdays')
  if (cadence.kind === 'weekly') return t('ttv.cadence.weekly', { day: weekdayName(cadence.day, dateLocale) })
  // Starting on Monday reads naturally in Tunisia (Sunday last).
  const ordered = [...cadence.days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
  let list: string
  try {
    list = new Intl.ListFormat(dateLocale, { style: 'long', type: 'conjunction' }).format(ordered.map((day) => weekdayName(day, dateLocale)))
  } catch {
    list = ordered.map((day) => weekdayName(day, dateLocale)).join(', ')
  }
  return t('ttv.cadence.days', { days: list })
}

/** "3 hours ago", "yesterday", "2 weeks ago" in the reader's language. */
export function timeAgo(iso: string, dateLocale: string, now = Date.now()): string {
  const seconds = Math.round((Date.parse(iso) - now) / 1000)
  const format = new Intl.RelativeTimeFormat(dateLocale, { numeric: 'auto' })
  const abs = Math.abs(seconds)
  if (abs < 3600) return format.format(Math.round(seconds / 60) || -1, 'minute')
  if (abs < 86400) return format.format(Math.round(seconds / 3600), 'hour')
  if (abs < 7 * 86400) return format.format(Math.round(seconds / 86400), 'day')
  if (abs < 30 * 86400) return format.format(Math.round(seconds / (7 * 86400)), 'week')
  if (abs < 365 * 86400) return format.format(Math.round(seconds / (30 * 86400)), 'month')
  return format.format(Math.round(seconds / (365 * 86400)), 'year')
}

/** A day in the reader's language, Tunis time ("9 October 2026"). */
export function dayLabel(iso: string, dateLocale: string): string {
  return new Date(iso).toLocaleDateString(dateLocale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Tunis' })
}

/** "1.2K" style counts in the reader's language. */
export function compactCount(count: number, dateLocale: string): string {
  return new Intl.NumberFormat(dateLocale, { notation: 'compact', maximumFractionDigits: 1 }).format(count)
}
