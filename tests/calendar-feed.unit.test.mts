// Unit tests for the release calendar subscription (lib/calendar buildFeed, lib/calendar-feed).
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { buildFeed, feedUid, type ReleaseEvent } from '@/src/lib/calendar'
import { episodeEvents, feedUrls, isFeedToken } from '@/src/lib/calendar-feed-rules'

const labels = { name: 'TunisiaFlicks: your releases', movie: 'In cinemas', episode: 'New episode' }
const movie: ReleaseEvent = { kind: 'movie', id: '550', date: '2026-12-20', title: 'Dune: Part Three' }
const episode: ReleaseEvent = { kind: 'tv', id: '1399', date: '2026-12-10', title: 'Severance', episode: 'S3E1', episodeName: 'Hello, Ms. Cobel' }

describe('the calendar', () => {
  const ics = buildFeed([movie, episode, episode], 'https://tunisiaflicks.app', labels, new Date('2026-12-01T10:00:00Z'))
  test('one calendar, named, that refreshes itself', () => {
    assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'))
    assert.ok(ics.endsWith('END:VCALENDAR\r\n'))
    assert.match(ics, /X-WR-CALNAME:TunisiaFlicks: your releases/)
    assert.match(ics, /REFRESH-INTERVAL;VALUE=DURATION:PT12H/)
  })
  test('one all-day event per release, soonest first, never twice', () => {
    assert.equal(ics.match(/BEGIN:VEVENT/g)?.length, 2)
    assert.ok(ics.indexOf('Severance') < ics.indexOf('Dune'))
    assert.match(ics, /DTSTART;VALUE=DATE:20261210\r\nDTEND;VALUE=DATE:20261211/)
  })
  test('text is escaped and lines are folded', () => {
    assert.match(ics, /Hello\\, Ms. Cobel/)
    assert.ok(ics.split('\r\n').every((line) => new TextEncoder().encode(line).length <= 75))
  })
  test('a release keeps its id when its date moves', () => {
    assert.equal(feedUid(movie), feedUid({ ...movie, date: '2027-01-05' }))
    assert.notEqual(feedUid(episode), feedUid({ ...episode, episode: 'S3E2' }))
  })
})

describe('episodes', () => {
  const today = '2026-12-01'
  const season = {
    season_number: 3,
    episodes: [
      { episode_number: 1, air_date: '2026-11-10', name: 'Old' },
      { episode_number: 2, air_date: '2026-11-25', name: 'Recent' },
      { episode_number: 3, air_date: '2026-12-08', name: 'Next' },
      { episode_number: 4, air_date: null, name: 'Undated' },
      { episode_number: 5, air_date: '2027-09-01', name: 'Too far' },
    ],
  }
  test('the last two weeks and the next six months, dated ones only', () => {
    const events = episodeEvents({ id: 1, name: 'Show' }, season, today)
    assert.deepEqual(events.map((event) => event.episode), ['S3E2', 'S3E3'])
    assert.equal(events[1].episodeName, 'Next')
  })
})

describe('the link', () => {
  test('tokens', () => {
    assert.ok(isFeedToken('a'.repeat(32)))
    assert.ok(!isFeedToken('short'))
    assert.ok(!isFeedToken('a'.repeat(31) + '/'))
  })
  test('the ways to add it', () => {
    const urls = feedUrls('https://tunisiaflicks.app', 'b'.repeat(32))
    assert.equal(urls.https, `https://tunisiaflicks.app/api/calendar/feed/${'b'.repeat(32)}.ics`)
    assert.equal(urls.webcal, `webcal://tunisiaflicks.app/api/calendar/feed/${'b'.repeat(32)}.ics`)
    assert.ok(urls.google.startsWith('https://calendar.google.com/calendar/r?cid='))
    assert.ok(urls.google.includes(encodeURIComponent(urls.webcal)))
  })
})
