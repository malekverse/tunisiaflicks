// Pure helpers of the social pages (safe on the server and the client, unit-tested in
// tests/social-pages.unit.test.mjs): the feed's day groups and wording, and the room light's colour.
import type { TKey } from '@/src/lib/i18n'
import type { Translate } from '@/src/lib/i18n/translate'

export type DayGroup = 'today' | 'yesterday' | 'week' | 'earlier'

const TUNIS_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Tunis', year: 'numeric', month: '2-digit', day: '2-digit' })

/** Today in Africa/Tunis, YYYY-MM-DD: the calendar the feed's days are written in. */
export const tunisToday = (now: Date | number = Date.now()) => TUNIS_DAY.format(new Date(now))

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/

/** Days since the epoch for a YYYY-MM-DD string (NaN when malformed). */
function dayNumber(day: string) {
  const match = DAY_RE.exec(day)
  if (!match) return Number.NaN
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 86400000
}

/**
 * Which heading a day goes under: Today, Yesterday, This week (the five days before), Earlier.
 * Never a time: friends only ever see the day.
 */
export function dayGroup(day: string, today: string): DayGroup {
  const diff = dayNumber(today) - dayNumber(day)
  if (!Number.isFinite(diff) || diff <= 0) return 'today'
  if (diff === 1) return 'yesterday'
  if (diff < 7) return 'week'
  return 'earlier'
}

/** Items (newest first) cut into consecutive day groups, in order; a group appears once. */
export function groupByDay<T extends { day: string }>(items: T[], today: string): { group: DayGroup; items: T[] }[] {
  const groups: { group: DayGroup; items: T[] }[] = []
  for (const item of items) {
    const group = dayGroup(item.day, today)
    const existing = groups.find((entry) => entry.group === group)
    if (existing) existing.items.push(item)
    else groups.push({ group, items: [item] })
  }
  const order: DayGroup[] = ['today', 'yesterday', 'week', 'earlier']
  return groups.sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group))
}

/** '#E50914' -> '229 9 20' (the room light's "r g b"); null for anything else. */
export function rgbTriplet(hex: string | null | undefined): string | null {
  const match = typeof hex === 'string' ? /^#?([0-9a-f]{6})$/i.exec(hex.trim()) : null
  if (!match) return null
  const value = parseInt(match[1], 16)
  return `${(value >> 16) & 255} ${(value >> 8) & 255} ${value & 255}`
}

/** Adds items after a page of the feed without repeating one already shown. */
export function appendUnique<T extends { id: string }>(current: T[], incoming: T[]): T[] {
  const seen = new Set(current.map((item) => item.id))
  return [...current, ...incoming.filter((item) => !seen.has(item.id))]
}

type Activity = { kind: 'watched' | 'on_episode' | 'season_finale' | 'series_finale' | 'rated'; season?: number; episode?: number; stars?: number }

/** The feed's sentence for each kind of activity (noun forms in Arabic and Derja). */
export const ACTIVITY_SENTENCE: Record<Activity['kind'], TKey> = {
  watched: 'social.feed.watched',
  on_episode: 'social.feed.onEpisode',
  season_finale: 'social.feed.seasonFinale',
  series_finale: 'social.feed.seriesFinale',
  rated: 'social.feed.rated',
}

/** A feed row as one plain sentence (its accessible name), the stars included. */
export function activitySentence(t: Translate, item: Activity & { actor: { name: string }; media: { title: string } }) {
  const sentence = t(ACTIVITY_SENTENCE[item.kind], { name: item.actor.name, title: item.media.title, season: item.season ?? '', episode: item.episode ?? '' })
  return item.kind === 'rated' && item.stars ? `${sentence}. ${t('social.ratings.starsAria', { count: item.stars })}` : sentence
}

/** 'S2:E3', 'S1 finale', 'Series finale'; nothing for a film or a rating. */
export function activityChip(t: Translate, item: Activity): string | null {
  if (item.kind === 'on_episode' && item.season && item.episode) return t('common.seasonEpisode', { season: item.season, episode: item.episode })
  if (item.kind === 'season_finale' && item.season) return t('social.feed.seasonFinaleChip', { season: item.season })
  if (item.kind === 'series_finale') return t('social.feed.seriesFinaleChip')
  return null
}
