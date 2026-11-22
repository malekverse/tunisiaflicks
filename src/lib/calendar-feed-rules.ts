// The release calendar subscription's pure rules (tests/calendar-feed.unit.test.mts): what a
// feed link looks like, the ways to add it, and which episodes of a season go in.
import type { ReleaseEvent } from '@/src/lib/calendar'

/** A feed link's secret: 32 to 64 URL-safe characters. */
export const isFeedToken = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{32,64}$/.test(value)

/** The feed's address, as a link, for Apple / Outlook (webcal:), and for Google Calendar. */
export function feedUrls(appUrl: string, token: string) {
  const https = `${appUrl.replace(/\/+$/, '')}/api/calendar/feed/${token}.ics`
  const webcal = https.replace(/^https?:\/\//, 'webcal://')
  return { https, webcal, google: `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}` }
}

const DAY = 86_400_000
const addDays = (day: string, days: number) => new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10)

/** How far the calendar looks back (so a just-aired episode stays) and ahead. */
export const PAST_DAYS = 14
export const AHEAD_DAYS = 183

/** A season's episodes worth a calendar entry: aired in the last two weeks, or dated in the next six months. */
export function episodeEvents(show: { id: number | string, name?: string, original_name?: string }, season: { season_number?: number, episodes?: any[] }, today: string): ReleaseEvent[] {
  const from = addDays(today, -PAST_DAYS)
  const until = addDays(today, AHEAD_DAYS)
  const title = show.name || show.original_name || ''
  return (season.episodes ?? []).flatMap((episode): ReleaseEvent[] => {
    const date = typeof episode?.air_date === 'string' ? episode.air_date : null
    if (!date || date < from || date > until || !Number.isInteger(episode.episode_number)) return []
    return [{
      kind: 'tv',
      id: String(show.id),
      date,
      title,
      episode: `S${season.season_number ?? episode.season_number}E${episode.episode_number}`,
      ...(episode.name ? { episodeName: String(episode.name) } : {}),
    }]
  })
}

/** Is a movie's date in the calendar's window? */
export const inWindow = (date: string | null | undefined, today: string) => !!date && date >= addDays(today, -PAST_DAYS) && date <= addDays(today, 365)
