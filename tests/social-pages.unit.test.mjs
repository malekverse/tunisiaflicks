// Unit tests for the social pages' pure helpers (no server, no database):
//   npm run test:unit
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  activityChip, activitySentence, appendUnique, dayGroup, digestLine, groupByDay, rgbTriplet, tunisToday, weekRows,
} from '@/src/app/friends/_lib/feed'

/** A stand-in translator: the key and its variables, so the tests see what was asked for. */
const t = (key, vars = {}) => `${key}${Object.keys(vars).length ? ` ${JSON.stringify(vars)}` : ''}`

test('dayGroup: Today, Yesterday, this week, Earlier (by calendar day, never by time)', () => {
  const today = '2026-10-09'
  assert.equal(dayGroup('2026-10-09', today), 'today')
  assert.equal(dayGroup('2026-10-08', today), 'yesterday')
  assert.equal(dayGroup('2026-10-07', today), 'week')
  assert.equal(dayGroup('2026-10-03', today), 'week', 'six days ago is still this week')
  assert.equal(dayGroup('2026-10-02', today), 'earlier', 'seven days ago is earlier')
  assert.equal(dayGroup('2026-09-30', '2026-10-01'), 'yesterday', 'across a month')
  assert.equal(dayGroup('2025-12-31', '2026-01-01'), 'yesterday', 'across a year')
  assert.equal(dayGroup('2026-10-10', today), 'today', 'a day ahead (clock skew) reads as today')
  assert.equal(dayGroup('not a day', today), 'today')
})

test('groupByDay: consecutive groups in order, each once, items kept in order', () => {
  const items = [
    { id: 'a', day: '2026-10-09' },
    { id: 'b', day: '2026-10-09' },
    { id: 'c', day: '2026-10-08' },
    { id: 'd', day: '2026-10-05' },
    { id: 'e', day: '2026-09-01' },
    { id: 'f', day: '2026-10-06' },
  ]
  const groups = groupByDay(items, '2026-10-09')
  assert.deepEqual(groups.map((group) => group.group), ['today', 'yesterday', 'week', 'earlier'])
  assert.deepEqual(groups.map((group) => group.items.map((item) => item.id)), [['a', 'b'], ['c'], ['d', 'f'], ['e']])
  assert.deepEqual(groupByDay([], '2026-10-09'), [])
})

test('tunisToday: the date in Africa/Tunis, whatever the machine zone', () => {
  // 23:30 UTC on 8 October is 00:30 on 9 October in Tunis (UTC+1).
  assert.equal(tunisToday(Date.parse('2026-10-08T23:30:00Z')), '2026-10-09')
  assert.equal(tunisToday(Date.parse('2026-10-08T22:30:00Z')), '2026-10-08')
  assert.match(tunisToday(), /^\d{4}-\d{2}-\d{2}$/)
})

test('rgbTriplet: profile colours become the room light\'s "r g b"', () => {
  assert.equal(rgbTriplet('#E50914'), '229 9 20')
  assert.equal(rgbTriplet('#dc2626'), '220 38 38')
  assert.equal(rgbTriplet('0ea5e9'), '14 165 233')
  assert.equal(rgbTriplet('#fff'), null)
  assert.equal(rgbTriplet('red'), null)
  assert.equal(rgbTriplet(null), null)
})

test('appendUnique: a later page never repeats a row', () => {
  const merged = appendUnique([{ id: '1' }, { id: '2' }], [{ id: '2' }, { id: '3' }])
  assert.deepEqual(merged.map((item) => item.id), ['1', '2', '3'])
})

test('activityChip: an episode, a season finale, a series finale; nothing for films and ratings', () => {
  assert.equal(activityChip(t, { kind: 'on_episode', season: 2, episode: 3 }), 'common.seasonEpisode {"season":2,"episode":3}')
  assert.equal(activityChip(t, { kind: 'season_finale', season: 1 }), 'social.feed.seasonFinaleChip {"season":1}')
  assert.equal(activityChip(t, { kind: 'series_finale' }), 'social.feed.seriesFinaleChip')
  assert.equal(activityChip(t, { kind: 'watched' }), null)
  assert.equal(activityChip(t, { kind: 'rated', stars: 4 }), null)
})

test('activitySentence: one sentence per row, the stars read out for a rating', () => {
  const base = { actor: { name: 'Amine' }, media: { title: 'Dune' } }
  assert.match(activitySentence(t, { ...base, kind: 'watched' }), /^social\.feed\.watched /)
  const rated = activitySentence(t, { ...base, kind: 'rated', stars: 5 })
  assert.match(rated, /^social\.feed\.rated .*\. social\.ratings\.starsAria \{"count":5\}$/)
  assert.match(activitySentence(t, { ...base, kind: 'on_episode', season: 2, episode: 3 }), /"season":2,"episode":3/)
})

test('weekRows: the digest week only, one row per title, at most five', () => {
  const item = (day, id, kind = 'watched') => ({ day, kind, media: { media_type: 'movie', id } })
  const items = [
    item('2026-10-10', '1'), // after the week
    item('2026-10-09', '2'),
    item('2026-10-08', '2', 'rated'), // the same title again (older): skipped
    item('2026-10-07', '3'),
    item('2026-10-05', '4'),
    item('2026-10-04', '5'),
    item('2026-10-03', '6'),
    item('2026-10-03', '7'),
    item('2026-09-20', '8'), // before the week
  ]
  const rows = weekRows(items, '2026-10-03', '2026-10-09')
  assert.deepEqual(rows.map((row) => row.media.id), ['2', '3', '4', '5', '6'])
  assert.equal(weekRows(items, '2026-10-03', '2026-10-09', 2).length, 2)
  assert.deepEqual(weekRows([], '2026-10-03', '2026-10-09'), [])
  // A film and a series with the same TMDB id are two different titles.
  const mixed = weekRows([{ day: '2026-10-05', media: { media_type: 'movie', id: '9' } }, { day: '2026-10-05', media: { media_type: 'tv', id: '9' } }], '2026-10-03', '2026-10-09')
  assert.equal(mixed.length, 2)
})

test('digestLine: who and what, in the noun-form keys', () => {
  const actor = { name: 'Sami' }
  assert.equal(digestLine(t, { kind: 'watched', actor }), 'social.digest.watched {"name":"Sami"}')
  assert.equal(digestLine(t, { kind: 'rated', stars: 4, actor }), 'social.digest.rated {"name":"Sami","stars":4}')
  assert.equal(digestLine(t, { kind: 'season_finale', season: 2, actor }), 'social.digest.seasonFinale {"name":"Sami","season":2}')
  assert.equal(digestLine(t, { kind: 'series_finale', actor }), 'social.digest.seriesFinale {"name":"Sami"}')
  assert.equal(digestLine(t, { kind: 'on_episode', season: 1, episode: 4, actor }), 'social.digest.onEpisode {"name":"Sami","season":1,"episode":4}')
})
