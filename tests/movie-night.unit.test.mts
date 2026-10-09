// Unit tests for movie nights' pure rules and the calendar file (no server, no database):
//   npm run test:unit
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  accessFor, checkStart, checkVoteClose, defaultTime, defaultVoteClose, isNightId, isRamadanDay, isTimeZone, joinNeedsApproval,
  mayVote, newNightId, picksLeft, pollInterval, quickDays, reminderDue, resolveDue, roleOf, tally, voteIsOpen, watchWindow,
  zonedDay, zonedTime, zonedToUtc,
} from '@/src/lib/movie-night-rules'
import { buildTimedIcs, googleTimedUrl, outlookTimedUrl } from '@/src/lib/calendar'

const iso = (date: Date | null) => date?.toISOString()

// ---------------------------------------------------------------------------------------------
// Time zones

test('zonedToUtc: Tunis has no daylight saving (UTC+1 all year)', () => {
  assert.equal(iso(zonedToUtc('2026-01-15', '21:00', 'Africa/Tunis')), '2026-01-15T20:00:00.000Z')
  assert.equal(iso(zonedToUtc('2026-07-15', '21:00', 'Africa/Tunis')), '2026-07-15T20:00:00.000Z')
})

test('zonedToUtc: Paris either side of the spring change, and the skipped hour', () => {
  // 29 March 2026: 02:00 CET becomes 03:00 CEST (01:00 UTC).
  assert.equal(iso(zonedToUtc('2026-03-28', '21:00', 'Europe/Paris')), '2026-03-28T20:00:00.000Z')
  assert.equal(iso(zonedToUtc('2026-03-29', '21:00', 'Europe/Paris')), '2026-03-29T19:00:00.000Z')
  assert.equal(iso(zonedToUtc('2026-03-29', '01:30', 'Europe/Paris')), '2026-03-29T00:30:00.000Z')
  assert.equal(iso(zonedToUtc('2026-03-29', '03:30', 'Europe/Paris')), '2026-03-29T01:30:00.000Z')
  // 02:30 doesn't exist that night: pushed past the gap, to 03:30 CEST.
  assert.equal(iso(zonedToUtc('2026-03-29', '02:30', 'Europe/Paris')), '2026-03-29T01:30:00.000Z')
})

test('zonedToUtc: Paris in autumn, and New York both ways', () => {
  // 25 October 2026: 03:00 CEST becomes 02:00 CET.
  assert.equal(iso(zonedToUtc('2026-10-24', '21:00', 'Europe/Paris')), '2026-10-24T19:00:00.000Z')
  assert.equal(iso(zonedToUtc('2026-10-25', '21:00', 'Europe/Paris')), '2026-10-25T20:00:00.000Z')
  const twice = zonedToUtc('2026-10-25', '02:30', 'Europe/Paris')!
  assert.ok(['2026-10-25T00:30:00.000Z', '2026-10-25T01:30:00.000Z'].includes(iso(twice)!), 'one of the two 02:30s')
  assert.equal(zonedTime(twice, 'Europe/Paris'), '02:30')
  // 8 March 2026 in New York: 02:00 EST becomes 03:00 EDT (07:00 UTC).
  assert.equal(iso(zonedToUtc('2026-03-08', '01:30', 'America/New_York')), '2026-03-08T06:30:00.000Z')
  assert.equal(iso(zonedToUtc('2026-03-08', '03:30', 'America/New_York')), '2026-03-08T07:30:00.000Z')
  assert.equal(iso(zonedToUtc('2026-03-08', '02:30', 'America/New_York')), '2026-03-08T07:30:00.000Z')
  assert.equal(iso(zonedToUtc('2026-11-01', '21:00', 'America/New_York')), '2026-11-02T02:00:00.000Z')
})

test('zonedToUtc: round trip, and malformed input', () => {
  for (const tz of ['Africa/Tunis', 'Europe/Paris', 'America/New_York', 'Asia/Tokyo', 'Australia/Adelaide']) {
    for (const day of ['2026-01-01', '2026-06-21', '2026-12-31']) {
      const at = zonedToUtc(day, '21:30', tz)!
      assert.equal(zonedDay(at, tz), day, `${tz} ${day}`)
      assert.equal(zonedTime(at, tz), '21:30', `${tz} ${day}`)
    }
  }
  assert.equal(zonedToUtc('2026-02-30', '21:00', 'Africa/Tunis'), null, 'not a real day')
  assert.equal(zonedToUtc('2026-10-09', '24:00', 'Africa/Tunis'), null)
  assert.equal(zonedToUtc('9 Oct', '21:00', 'Africa/Tunis'), null)
  assert.equal(zonedToUtc('2026-10-09', '21:00', 'Mars/Olympus'), null)
  assert.equal(isTimeZone('Africa/Tunis'), true)
  assert.equal(isTimeZone('../etc'), false)
  assert.equal(isTimeZone(42), false)
})

// ---------------------------------------------------------------------------------------------
// The When chips and the default time

const tunis = (day: string, time: string) => zonedToUtc(day, time, 'Africa/Tunis')!

test('quickDays: tonight only before 20:30', () => {
  // Friday 9 October 2026.
  assert.deepEqual(quickDays(tunis('2026-10-09', '18:00'), 'Africa/Tunis').map((chip) => chip.id), ['tonight', 'tomorrow', 'friday'])
  assert.deepEqual(quickDays(tunis('2026-10-09', '20:29'), 'Africa/Tunis')[0], { id: 'tonight', day: '2026-10-09' })
  const late = quickDays(tunis('2026-10-09', '20:30'), 'Africa/Tunis')
  assert.ok(!late.some((chip) => chip.id === 'tonight'), 'from 20:30 tonight is gone')
  assert.deepEqual(late[0], { id: 'tomorrow', day: '2026-10-10' })
})

test('quickDays: Friday and Saturday ahead, no repeats, in date order', () => {
  // Wednesday 7 October 2026, morning.
  assert.deepEqual(quickDays(tunis('2026-10-07', '09:00'), 'Africa/Tunis'), [
    { id: 'tonight', day: '2026-10-07' },
    { id: 'tomorrow', day: '2026-10-08' },
    { id: 'friday', day: '2026-10-09' },
    { id: 'saturday', day: '2026-10-10' },
  ])
  // Thursday night: tomorrow is Friday, so no separate Friday chip.
  assert.deepEqual(quickDays(tunis('2026-10-08', '22:00'), 'Africa/Tunis'), [
    { id: 'tomorrow', day: '2026-10-09' },
    { id: 'saturday', day: '2026-10-10' },
  ])
  // Saturday morning: the coming Friday is next week's.
  assert.deepEqual(quickDays(tunis('2026-10-10', '10:00'), 'Africa/Tunis').map((chip) => chip.day), ['2026-10-10', '2026-10-11', '2026-10-16', '2026-10-17'])
})

test('quickDays: "tonight" is the viewer\'s own evening (their zone)', () => {
  const now = new Date('2026-10-09T19:00:00Z') // 20:00 in Tunis, 03:00 next day in Tokyo
  assert.equal(quickDays(now, 'Africa/Tunis')[0].day, '2026-10-09')
  assert.equal(quickDays(now, 'Asia/Tokyo')[0].day, '2026-10-10')
})

test('default time: 21:00, 22:00 during Ramadan', () => {
  assert.equal(isRamadanDay('2026-03-01'), true)
  assert.equal(isRamadanDay('2026-10-09'), false)
  assert.equal(defaultTime('2026-03-01'), '22:00')
  assert.equal(defaultTime('2026-10-09'), '21:00')
})

test('checkStart: 30 minutes ahead at least, 60 days at most', () => {
  const now = new Date('2026-10-09T12:00:00Z')
  assert.equal(checkStart(new Date('2026-10-09T11:00:00Z'), now), 'past')
  assert.equal(checkStart(new Date('2026-10-09T12:29:00Z'), now), 'too_soon')
  assert.equal(checkStart(new Date('2026-10-09T12:30:00Z'), now), null)
  assert.equal(checkStart(new Date('2026-12-08T12:00:00Z'), now), null)
  assert.equal(checkStart(new Date('2026-12-08T12:01:00Z'), now), 'too_far')
})

// ---------------------------------------------------------------------------------------------
// The vote

const C = [{ key: 'movie:1' }, { key: 'movie:2' }, { key: 'tv:3' }]
const at = (minute: number) => new Date(Date.UTC(2026, 9, 9, 12, minute))

test('tally: most votes wins', () => {
  const result = tally(C, { a: 'movie:2', b: 'movie:2', c: 'movie:1' }, { a: at(1), b: at(2), c: at(0) }, 'h')
  assert.equal(result.winner, 'movie:2')
  assert.deepEqual(result.counts, { 'movie:1': 1, 'movie:2': 2, 'tv:3': 0 })
  assert.deepEqual(result.order, ['movie:2', 'movie:1', 'tv:3'])
})

test('tally: a tie goes to the first to get there (earliest last vote)', () => {
  // movie:1 reached 2 votes at minute 5; tv:3 reached 2 votes at minute 4.
  const votes = { a: 'movie:1', b: 'movie:1', c: 'tv:3', d: 'tv:3' }
  const result = tally(C, votes, { a: at(1), b: at(5), c: at(2), d: at(4) }, 'h')
  assert.equal(result.winner, 'tv:3')
  // Someone changing their vote late moves that candidate's arrival time.
  const changed = tally(C, votes, { a: at(1), b: at(3), c: at(2), d: at(9) }, 'h')
  assert.equal(changed.winner, 'movie:1')
})

test('tally: then the host\'s own vote, then candidate order', () => {
  const same = at(5)
  assert.equal(tally(C, { h: 'tv:3', b: 'movie:1' }, { h: same, b: same }, 'h').winner, 'tv:3', 'the host breaks an exact tie')
  assert.equal(tally(C, { a: 'tv:3', b: 'movie:2' }, { a: same, b: same }, 'h').winner, 'movie:2', 'then candidate order')
  assert.equal(tally(C, {}, {}, 'h').winner, 'movie:1', 'no votes at all: the first candidate')
  assert.equal(tally([], {}, {}, 'h').winner, null)
})

test('tally: votes for removed candidates and unknown times', () => {
  const result = tally(C, { a: 'movie:9', b: 'tv:3' }, { b: 'not a date' }, null)
  assert.deepEqual(result.counts, { 'movie:1': 0, 'movie:2': 0, 'tv:3': 1 })
  assert.equal(result.winner, 'tv:3')
})

const night = (over: Record<string, unknown> = {}) => ({
  status: 'planned' as const,
  chosen: null,
  candidates: C,
  vote_closes_at: new Date('2026-10-09T18:00:00Z'),
  vote_closed_at: null,
  ...over,
})

test('lazy close: the vote is open until its time, or until the host closes it', () => {
  const before = new Date('2026-10-09T17:59:00Z')
  const after = new Date('2026-10-09T18:00:00Z')
  assert.equal(voteIsOpen(night(), before), true)
  assert.equal(resolveDue(night(), before), false)
  assert.equal(voteIsOpen(night(), after), false)
  assert.equal(resolveDue(night(), after), true, 'past the close time, the first read resolves it')
  assert.equal(voteIsOpen(night({ vote_closed_at: before }), before), false)
  assert.equal(resolveDue(night({ vote_closed_at: before }), before), true, "the host's Close the vote")
})

test('lazy close: never twice, never on a cancelled night or one with nothing to pick', () => {
  const after = new Date('2026-10-10T00:00:00Z')
  assert.equal(resolveDue(night({ chosen: { key: 'movie:1' } }), after), false, 'already chosen (vote, swipe or host): stays')
  assert.equal(resolveDue(night({ status: 'cancelled' }), after), false)
  assert.equal(resolveDue(night({ candidates: [] }), after), false)
  assert.equal(voteIsOpen(night({ chosen: { key: 'movie:1' } }), new Date('2026-10-09T10:00:00Z')), false)
})

test('defaultVoteClose: two hours before, never in the past, never after the start', () => {
  const now = new Date('2026-10-09T12:00:00Z')
  assert.equal(defaultVoteClose(new Date('2026-10-09T20:00:00Z'), now).toISOString(), '2026-10-09T18:00:00.000Z')
  assert.equal(defaultVoteClose(new Date('2026-10-09T13:00:00Z'), now).toISOString(), '2026-10-09T12:30:00.000Z')
  assert.equal(defaultVoteClose(new Date('2026-10-09T12:20:00Z'), now).toISOString(), '2026-10-09T12:20:00.000Z')
  const start = new Date('2026-10-09T20:00:00Z')
  assert.equal(checkVoteClose(new Date('2026-10-09T20:01:00Z'), start, now), null, 'after the start')
  assert.equal(checkVoteClose(new Date('2026-10-09T12:02:00Z'), start, now), null, 'too soon')
  assert.equal(checkVoteClose(start, start, now)?.toISOString(), start.toISOString(), 'at the start is fine')
})

test('who votes, and how many picks are left', () => {
  assert.equal(mayVote('host'), true)
  assert.equal(mayVote('going'), true)
  assert.equal(mayVote('invited'), true)
  assert.equal(mayVote('cant'), false)
  assert.equal(mayVote('requested'), false)
  assert.equal(mayVote(null), false)
  const picks = [{ added_by: 'h' }, { added_by: 'h' }]
  assert.equal(picksLeft(picks, 'h', true), 1)
  assert.equal(picksLeft(picks, 'g', false), 1)
  assert.equal(picksLeft([...picks, { added_by: 'g' }], 'g', false), 0)
  assert.equal(picksLeft([...picks, { added_by: 'h' }, { added_by: 'a' }, { added_by: 'b' }, { added_by: 'c' }], 'd', false), 0, 'six in all')
})

// ---------------------------------------------------------------------------------------------
// Reminders

test('reminderDue: the day one (planned early), then the hour one, each once', () => {
  const starts = new Date('2026-10-10T20:00:00Z')
  const base = { status: 'planned' as const, starts_at: starts, created_at: new Date('2026-10-05T10:00:00Z'), reminded: { day: false, hour: false } }
  assert.equal(reminderDue(base, new Date('2026-10-09T19:59:00Z')), null, 'more than a day away')
  assert.equal(reminderDue(base, new Date('2026-10-09T20:00:00Z')), 'day')
  assert.equal(reminderDue({ ...base, reminded: { day: true, hour: false } }, new Date('2026-10-09T20:00:00Z')), null, 'sent already')
  assert.equal(reminderDue(base, new Date('2026-10-10T18:30:00Z')), null, 'too late for "a day before"')
  assert.equal(reminderDue(base, new Date('2026-10-10T19:00:00Z')), 'hour')
  assert.equal(reminderDue({ ...base, reminded: { day: true, hour: true } }, new Date('2026-10-10T19:30:00Z')), null)
  assert.equal(reminderDue(base, new Date('2026-10-10T20:00:00Z')), null, 'started')
})

test('reminderDue: no day reminder for a night planned less than a day ahead; none when cancelled', () => {
  const starts = new Date('2026-10-10T20:00:00Z')
  const lateNight = { status: 'planned' as const, starts_at: starts, created_at: new Date('2026-10-10T08:00:00Z'), reminded: null }
  assert.equal(reminderDue(lateNight, new Date('2026-10-10T09:00:00Z')), null)
  assert.equal(reminderDue(lateNight, new Date('2026-10-10T19:10:00Z')), 'hour')
  assert.equal(reminderDue({ ...lateNight, status: 'cancelled' as const }, new Date('2026-10-10T19:10:00Z')), null)
})

// ---------------------------------------------------------------------------------------------
// Ids and access

test('night ids: 10 characters, no 0/O/1/I', () => {
  let i = 0
  const id = newNightId((max) => (i++ * 7) % max)
  assert.equal(id.length, 10)
  assert.equal(isNightId(id), true)
  for (const bad of ['ABCDEFGHJ0', 'ABCDEFGHJO', 'ABCDEFGHJ1', 'ABCDEFGHJI', 'abcdefghjk', 'ABCDEFGHJ', 'ABCDEFGHJKL', 42]) assert.equal(isNightId(bad), false, String(bad))
})

test('access: members see it all, requests and link holders a preview, others nothing', () => {
  const doc = { host: { profileId: 'h' }, guests: [{ ref: { profileId: 'g' }, status: 'going' as const }, { ref: { profileId: 'r' }, status: 'requested' as const }] }
  assert.equal(roleOf(doc, 'h'), 'host')
  assert.equal(roleOf(doc, 'g'), 'going')
  assert.equal(roleOf(doc, 'x'), null)
  assert.equal(roleOf(doc, null), null)
  assert.equal(accessFor('host', false), 'member')
  assert.equal(accessFor('cant', false), 'member')
  assert.equal(accessFor('requested', false), 'preview')
  assert.equal(accessFor(null, true), 'preview')
  assert.equal(accessFor(null, false), 'none')
  assert.equal(joinNeedsApproval({ place: '', note: '  ' }), false)
  assert.equal(joinNeedsApproval({ place: 'Chez Sami' }), true)
  assert.equal(joinNeedsApproval({ note: 'Bring snacks' }), true)
})

test('watch window and polling', () => {
  const starts = new Date('2026-10-09T20:00:00Z')
  assert.equal(watchWindow(starts, new Date('2026-10-09T19:29:00Z')), 'before')
  assert.equal(watchWindow(starts, new Date('2026-10-09T19:30:00Z')), 'now')
  assert.equal(watchWindow(starts, new Date('2026-10-10T00:00:00Z')), 'now')
  assert.equal(watchWindow(starts, new Date('2026-10-10T00:01:00Z')), 'after')
  assert.equal(pollInterval(starts, new Date('2026-10-09T19:00:00Z')), 15_000)
  assert.equal(pollInterval(starts, new Date('2026-10-09T20:00:00Z')), 60_000)
})

// ---------------------------------------------------------------------------------------------
// The calendar file

const event = {
  uid: 'night-ABCDEFGHJK@tunisiaflicks',
  sequence: 3,
  start: new Date('2026-10-09T20:00:00Z'),
  end: new Date('2026-10-09T23:00:00Z'),
  summary: 'Movie night: Dune; Part Two, the long one',
  description: 'Line one\nLine two \\ back',
  location: 'Chez Sami, La Marsa',
  url: 'https://tunisiaflicks.vercel.app/movie-night/ABCDEFGHJK',
  alarmMinutes: 60,
  stamp: new Date('2026-10-08T10:00:00Z'),
}

test('ics: CRLF line ends, UTC times, UID, SEQUENCE and a one-hour alarm', () => {
  const ics = buildTimedIcs(event)
  assert.ok(ics.endsWith('\r\n'))
  assert.ok(!/[^\r]\n/.test(ics), 'every line ends with CRLF')
  const lines = ics.split('\r\n')
  assert.equal(lines[0], 'BEGIN:VCALENDAR')
  assert.ok(lines.includes('UID:night-ABCDEFGHJK@tunisiaflicks'))
  assert.ok(lines.includes('SEQUENCE:3'))
  assert.ok(lines.includes('DTSTART:20261009T200000Z'))
  assert.ok(lines.includes('DTEND:20261009T230000Z'))
  assert.ok(lines.includes('DTSTAMP:20261008T100000Z'))
  assert.ok(lines.includes('STATUS:CONFIRMED'))
  const alarm = lines.indexOf('BEGIN:VALARM')
  assert.ok(alarm > 0)
  assert.ok(lines.slice(alarm).includes('TRIGGER:-PT60M'))
  assert.ok(lines.slice(alarm).includes('ACTION:DISPLAY'))
})

test('ics: text is escaped (commas, semicolons, backslashes, newlines)', () => {
  const ics = buildTimedIcs(event)
  assert.ok(ics.includes('SUMMARY:Movie night: Dune\\; Part Two\\, the long one'))
  assert.ok(ics.includes('DESCRIPTION:Line one\\nLine two \\\\ back'))
  assert.ok(ics.includes('LOCATION:Chez Sami\\, La Marsa'))
})

test('ics: long lines fold at 75 octets, Arabic included, and unfold back', () => {
  const long = { ...event, summary: `سهرة فيلم: ${'الفيلم الطويل جداً '.repeat(8)}`, description: 'x'.repeat(200) }
  const ics = buildTimedIcs(long)
  for (const line of ics.split('\r\n')) assert.ok(new TextEncoder().encode(line).length <= 75, `too long: ${line.slice(0, 20)}`)
  const unfolded = ics.replace(/\r\n /g, '')
  assert.ok(unfolded.includes(`SUMMARY:${long.summary}`), 'unfolding gives the text back, no letter split')
  assert.ok(unfolded.includes(`DESCRIPTION:${'x'.repeat(200)}`))
})

test('ics: a cancelled night says so and loses its alarm; a new version bumps SEQUENCE', () => {
  const ics = buildTimedIcs({ ...event, cancelled: true, sequence: 4 })
  assert.ok(ics.includes('STATUS:CANCELLED'))
  assert.ok(ics.includes('SEQUENCE:4'))
  assert.ok(!ics.includes('BEGIN:VALARM'))
  assert.ok(!buildTimedIcs({ ...event, alarmMinutes: undefined }).includes('VALARM'))
})

test('calendar links: Google and Outlook carry the times, the title and the place', () => {
  const google = new URL(googleTimedUrl(event))
  assert.equal(google.hostname, 'calendar.google.com')
  assert.equal(google.searchParams.get('dates'), '20261009T200000Z/20261009T230000Z')
  assert.equal(google.searchParams.get('text'), event.summary)
  assert.equal(google.searchParams.get('location'), event.location)
  const outlook = new URL(outlookTimedUrl(event))
  assert.equal(outlook.hostname, 'outlook.live.com')
  assert.equal(outlook.searchParams.get('startdt'), '2026-10-09T20:00:00.000Z')
  assert.equal(outlook.searchParams.get('subject'), event.summary)
})
