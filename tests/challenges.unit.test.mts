// Unit tests for lib/badges/challenges: the monthly film challenges.
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  CHALLENGE_KINDS, challengeWins, challengesFor, daysLeft, isMonth, measure, monthProgress, monthTitles, previousMonth,
} from '@/src/lib/badges/challenges'
import type { ActivityDay, TitleFacts } from '@/src/lib/badges/metrics'

const facts = new Map<string, TitleFacts>([
  ['movie:1', { g: [18], l: 'ar', y: 1975, tn: true }],
  ['movie:2', { g: [16, 35], l: 'fr', y: 2026, tn: false }],
  ['movie:3', { g: [99], l: 'en', y: 1999, tn: false }],
  ['movie:4', { g: [28], l: 'ko', y: 2011, tn: false }],
  ['tv:10', { g: [10766], l: 'ar', y: 2025, tn: true, s: { 1: 30 } }],
  ['movie:5', { g: [], l: null, y: null, tn: false, missing: true }],
])

const days: ActivityDay[] = [
  { day: '2026-11-02', k: ['m1', 't10:1:1', 't10:1:2'] },
  { day: '2026-11-03', k: ['m2', 'm1'] },
  { day: '2026-11-20', k: ['m3', 'm5', 't10:1:2'] },
  { day: '2026-12-01', k: ['m4'] },
  { day: '2026-11-21', k: ['bogus'] },
]

describe('Which challenges a month has', () => {
  test('three, from the first month on', () => {
    assert.deepEqual(challengesFor('2026-10'), [])
    assert.equal(challengesFor('2026-11').length, 3)
    assert.deepEqual(challengesFor('2026-12').map((c) => c.kind), ['languages', 'decades', 'days'])
  })
  test('months after the hand-picked ones: three different kinds, every kind in turn', () => {
    const seen = new Set<string>()
    for (let year = 2027; year <= 2028; year++) {
      for (let m = 4; m <= 12; m++) {
        const month = `${year}-${String(m).padStart(2, '0')}`
        const kinds = challengesFor(month).map((c) => c.kind)
        assert.equal(new Set(kinds).size, 3, month)
        kinds.forEach((kind) => seen.add(kind))
      }
    }
    assert.equal(seen.size, CHALLENGE_KINDS.length)
  })
  test('a month never changes', () => {
    assert.deepEqual(challengesFor('2029-05'), challengesFor('2029-05'))
  })
  test('months and days left', () => {
    assert.ok(isMonth('2026-11'))
    assert.ok(!isMonth('2026-13'))
    assert.equal(previousMonth('2027-01'), '2026-12')
    assert.equal(previousMonth('2026-11'), '2026-10')
    assert.equal(daysLeft('2026-11', '2026-11-23'), 7)
    assert.equal(daysLeft('2026-11', '2026-11-30'), 0)
    assert.equal(daysLeft('2027-02', '2027-02-01'), 27)
  })
})

describe('Measuring a month', () => {
  const nov = (kind: Parameters<typeof measure>[0]) => measure(kind, days, facts, '2026-11')
  test('plays: films, episodes and days (each counted once)', () => {
    assert.equal(nov('films'), 4)        // 1, 2, 3, 5 (5 has no facts but is a film)
    assert.equal(nov('episodes'), 2)     // 1x1, 1x2 (1x2 twice)
    assert.equal(nov('days'), 3)         // the bogus day doesn't count
  })
  test('facts: languages, decades, genres, Tunisian, Arabic', () => {
    assert.equal(nov('languages'), 3)    // ar, fr, en
    assert.equal(nov('decades'), 3)      // 1970s, 2020s, 1990s (2026 and 2025 share one)
    assert.equal(nov('tunisian'), 2)     // movie 1, tv 10
    assert.equal(nov('arabic'), 2)
    assert.ok(nov('genres') >= 4)        // drama, animation, comedy, documentary
  })
  test('classics, this year, animation, documentaries', () => {
    assert.equal(nov('classics'), 1)     // 1975 film (a series wouldn't count)
    assert.equal(nov('newReleases'), 1)  // 2026
    assert.equal(nov('animation'), 1)
    assert.equal(nov('documentary'), 1)
  })
  test('only the month itself', () => {
    assert.equal(measure('films', days, facts, '2026-12'), 1)
    assert.deepEqual(monthTitles(days, '2026-12'), ['movie:4'])
  })
})

describe('Finished challenges', () => {
  test('a month’s progress says what is done', () => {
    // November: 5 films (4), 5 genres, 2 Tunisian titles (2).
    const progress = monthProgress('2026-11', days, facts)
    assert.deepEqual(progress.map((c) => [c.kind, c.done]), [['films', false], ['genres', progress[1].value >= 5], ['tunisian', true]])
  })
  test('the badge counts them across months', () => {
    const wins = challengeWins(days, facts)
    const expected = monthProgress('2026-11', days, facts).filter((c) => c.done).length + monthProgress('2026-12', days, facts).filter((c) => c.done).length
    assert.equal(wins, expected)
    assert.equal(challengeWins([], facts), 0)
  })
})
