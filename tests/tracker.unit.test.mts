// Unit tests for lib/tracker: where you are in a series, and which shelf it sits on.
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { airedSeasons, daysUntil, progress, type ShowFacts } from '@/src/lib/tracker'

const NOW = Date.parse('2026-12-10T12:00:00Z')
const show = (extra: Partial<ShowFacts> = {}): ShowFacts => ({
  seasons: [{ season_number: 0, episode_count: 4 }, { season_number: 1, episode_count: 10 }, { season_number: 2, episode_count: 8 }],
  last: { season: 2, episode: 8, air_date: '2026-06-01' },
  next: null,
  status: 'Returning Series',
  ...extra,
})

describe('aired episodes', () => {
  test('specials aside, capped at the latest episode aired', () => {
    const seasons = airedSeasons(show({ last: { season: 2, episode: 3, air_date: '2026-12-05' } }))
    assert.deepEqual(seasons, [{ season_number: 1, episode_count: 10 }, { season_number: 2, episode_count: 3 }])
  })
  test('a season announced but not aired yet counts for nothing', () => {
    const seasons = airedSeasons(show({ seasons: [...show().seasons, { season_number: 3, episode_count: 10 }] }))
    assert.equal(seasons.length, 2)
  })
  test('nothing aired yet', () => {
    assert.deepEqual(airedSeasons(show({ last: null })), [])
  })
})

describe('progress', () => {
  test('mid-season: the next episode, and how many are left', () => {
    const result = progress(show(), { season: 1, episode: 4 }, NOW)
    assert.deepEqual([result.position, result.aired, result.left], [4, 18, 14])
    assert.deepEqual(result.upNext, { season: 1, episode: 5 })
    assert.equal(result.shelf, 'behind')
  })
  test('end of a season: the first episode of the next', () => {
    assert.deepEqual(progress(show(), { season: 1, episode: 10 }, NOW).upNext, { season: 2, episode: 1 })
  })
  test('caught up, the next episode dated: coming soon', () => {
    const result = progress(show({ next: { season: 3, episode: 1, air_date: '2026-12-20' } }), { season: 2, episode: 8 }, NOW)
    assert.equal(result.left, 0)
    assert.equal(result.upNext, null)
    assert.equal(result.shelf, 'soon')
  })
  test('caught up, no date: waiting; ended: finished', () => {
    assert.equal(progress(show(), { season: 2, episode: 8 }, NOW).shelf, 'waiting')
    assert.equal(progress(show({ status: 'Ended' }), { season: 2, episode: 8 }, NOW).shelf, 'finished')
  })
  test('a new episode lately, nearly caught up: fresh', () => {
    const facts = show({ last: { season: 2, episode: 8, air_date: '2026-12-06' } })
    assert.equal(progress(facts, { season: 2, episode: 7 }, NOW).fresh, true)
    assert.equal(progress(facts, { season: 1, episode: 2 }, NOW).fresh, false)
  })
  test('an episode further than TMDB knows, or a special: never negative', () => {
    assert.equal(progress(show(), { season: 5, episode: 1 }, NOW).left, 0)
    assert.equal(progress(show(), { season: 0, episode: 2 }, NOW).position, 0)
  })
})

describe('dates', () => {
  test('days until an air date, by the calendar in Tunis', () => {
    assert.equal(daysUntil('2026-12-10', NOW), 0)
    assert.equal(daysUntil('2026-12-11', NOW), 1)
    assert.equal(daysUntil('2026-12-11', Date.parse('2026-12-10T23:30:00Z')), 0)
  })
})
