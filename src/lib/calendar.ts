// "Add to calendar" for upcoming releases: an all-day event on the release date of a movie, or on
// the air date of a show's next episode. Shared by the countdown (client) and the .ics route.

export type ReleaseEvent = {
  kind: 'movie' | 'tv'
  id: string
  /** YYYY-MM-DD (TMDB gives dates, not times). */
  date: string
  title: string
  /** Episode code for TV, e.g. "S2E5". */
  episode?: string
  episodeName?: string
}

const today = () => new Date().toISOString().slice(0, 10)

/** The next release worth counting down to, or null (already out, ended, or no date yet). */
export function upcomingRelease(kind: 'movie' | 'tv', data: any): ReleaseEvent | null {
  const id = String(data?.id ?? '')
  if (!id) return null
  if (kind === 'movie') {
    const date = data.release_date
    return date && date > today() ? { kind, id, date, title: data.title || data.original_title || '' } : null
  }
  const next = data.next_episode_to_air
  if (!next?.air_date || next.air_date < today()) return null
  return {
    kind,
    id,
    date: next.air_date,
    title: data.name || data.original_name || '',
    episode: `S${next.season_number}E${next.episode_number}`,
    episodeName: next.name || undefined,
  }
}

const compact = (date: string) => date.replace(/-/g, '')

function nextDay(date: string) {
  const day = new Date(`${date}T00:00:00Z`)
  day.setUTCDate(day.getUTCDate() + 1)
  return day.toISOString().slice(0, 10)
}

export const eventSummary = (event: ReleaseEvent) =>
  event.kind === 'tv' ? `${event.title} ${event.episode}${event.episodeName ? ` – ${event.episodeName}` : ''}` : event.title

export const eventPageUrl = (event: ReleaseEvent, appUrl: string) => `${appUrl}/${event.kind}/${event.id}`

/** A prefilled Google Calendar "create event" link (all-day). */
export function googleCalendarUrl(event: ReleaseEvent, appUrl: string) {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: eventSummary(event),
    dates: `${compact(event.date)}/${compact(nextDay(event.date))}`,
    details: `${event.kind === 'tv' ? 'New episode' : 'Release'} — ${eventPageUrl(event, appUrl)}`,
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

const escapeIcs = (value: string) => value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')

// RFC 5545: lines longer than 75 octets are folded with CRLF + space. (TextEncoder rather than
// Buffer: this module is also imported by client components.)
const encoder = new TextEncoder()
const octets = (value: string) => encoder.encode(value).length

function fold(line: string) {
  if (octets(line) <= 75) return line
  const parts: string[] = []
  let current = ''
  for (const char of line) {
    if (octets(current + char) > (parts.length ? 74 : 75)) {
      parts.push(current)
      current = char
    } else {
      current += char
    }
  }
  parts.push(current)
  return parts.join('\r\n ')
}

/** An iCalendar file (Apple Calendar, Outlook, Google import) for the release. */
export function buildIcs(event: ReleaseEvent, appUrl: string) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const url = eventPageUrl(event, appUrl)
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TunisiaFlicks//Release reminders//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.kind}-${event.id}-${compact(event.date)}@tunisiaflicks`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${compact(event.date)}`,
    `DTEND;VALUE=DATE:${compact(nextDay(event.date))}`,
    `SUMMARY:${escapeIcs(eventSummary(event))}`,
    `DESCRIPTION:${escapeIcs(`${event.kind === 'tv' ? 'New episode' : 'Release'} on TunisiaFlicks: ${url}`)}`,
    `URL:${url}`,
    'TRANSP:TRANSPARENT',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return lines.map(fold).join('\r\n') + '\r\n'
}
