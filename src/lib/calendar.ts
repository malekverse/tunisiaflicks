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

// ---------------------------------------------------------------------------------------------
// Timed events (movie nights): a start and an end in UTC, a reminder, and a SEQUENCE so a
// calendar that imported the file replaces the event when it changes (a new time, the film).

export type TimedEvent = {
  /** Stable across versions ('night-ABC@tunisiaflicks'): the calendar updates the same event. */
  uid: string
  /** Goes up with every change people should see; calendars keep the highest one. */
  sequence: number
  start: Date
  end: Date
  summary: string
  description?: string
  location?: string
  url?: string
  /** A reminder this many minutes before the start (VALARM). */
  alarmMinutes?: number
  alarmText?: string
  cancelled?: boolean
  /** DTSTAMP; now by default. */
  stamp?: Date
}

/** 20261009T200000Z */
export const icsUtc = (date: Date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

/** Text for an iCalendar property value (backslash, comma, semicolon and newlines escaped). */
export const escapeIcsText = escapeIcs
/** One iCalendar content line, folded at 75 octets (CRLF + space). */
export const foldIcsLine = fold

/** An iCalendar file for a timed event, with CRLF line ends, folded lines and an optional alarm. */
export function buildTimedIcs(event: TimedEvent, prodId = '-//TunisiaFlicks//Movie nights//EN') {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${prodId}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.uid}`,
    `SEQUENCE:${Math.max(0, Math.floor(event.sequence))}`,
    `DTSTAMP:${icsUtc(event.stamp ?? new Date())}`,
    `DTSTART:${icsUtc(event.start)}`,
    `DTEND:${icsUtc(event.end)}`,
    `SUMMARY:${escapeIcs(event.summary)}`,
    ...(event.description ? [`DESCRIPTION:${escapeIcs(event.description)}`] : []),
    ...(event.location ? [`LOCATION:${escapeIcs(event.location)}`] : []),
    ...(event.url ? [`URL:${event.url}`] : []),
    `STATUS:${event.cancelled ? 'CANCELLED' : 'CONFIRMED'}`,
    ...(event.alarmMinutes && !event.cancelled
      ? ['BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escapeIcs(event.alarmText ?? event.summary)}`, `TRIGGER:-PT${Math.round(event.alarmMinutes)}M`, 'END:VALARM']
      : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return lines.map(fold).join('\r\n') + '\r\n'
}

/** Google Calendar's "create event" link for a timed event. */
export function googleTimedUrl(event: Pick<TimedEvent, 'start' | 'end' | 'summary' | 'description' | 'location'>) {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.summary,
    dates: `${icsUtc(event.start)}/${icsUtc(event.end)}`,
    ...(event.description ? { details: event.description } : {}),
    ...(event.location ? { location: event.location } : {}),
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

/** Outlook on the web's "new event" link for a timed event. */
export function outlookTimedUrl(event: Pick<TimedEvent, 'start' | 'end' | 'summary' | 'description' | 'location'>) {
  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: event.summary,
    startdt: event.start.toISOString(),
    enddt: event.end.toISOString(),
    ...(event.description ? { body: event.description } : {}),
    ...(event.location ? { location: event.location } : {}),
  })
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`
}
