// Unit tests for lib/sleep-timer: the player's sleep timer.
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  clock, dimFor, episodeTimer, EPISODE_MARGIN_MS, extend, EXTEND_MS, isDue, minutesTimer, readTimer, WARN_MS,
} from '@/src/lib/sleep-timer'

const NOW = 1_800_000_000_000

describe('Sleep timer', () => {
  test('after some minutes', () => {
    const timer = minutesTimer(30, NOW)
    assert.equal(timer.endsAt, NOW + 30 * 60_000)
    assert.ok(!isDue(timer, NOW + 29 * 60_000, 'tv:1:1:2'))
    assert.ok(isDue(timer, NOW + 30 * 60_000, 'tv:1:1:2'))
    // The next episode opening doesn't end a timer in minutes.
    assert.ok(!isDue(timer, NOW + 60_000, 'tv:1:1:3'))
  })
  test('when this episode ends: its running time, or the next episode, whichever first', () => {
    const timer = episodeTimer(42, 'tv:1:1:2', NOW)!
    assert.equal(timer.endsAt, NOW + 42 * 60_000 + EPISODE_MARGIN_MS)
    assert.ok(!isDue(timer, NOW + 60_000, 'tv:1:1:2'))
    assert.ok(!isDue(timer, NOW + 60_000, null))
    assert.ok(isDue(timer, NOW + 60_000, 'tv:1:1:3'))
    assert.equal(episodeTimer(null, 'tv:1:1:2', NOW), null)
    assert.equal(episodeTimer(0, 'tv:1:1:2', NOW), null)
  })
  test('a bit more', () => {
    const timer = minutesTimer(15, NOW)
    assert.equal(extend(timer, NOW).endsAt, timer.endsAt + EXTEND_MS)
    assert.equal(extend(timer, timer.endsAt + 5000).endsAt, timer.endsAt + 5000 + EXTEND_MS)
  })
  test('dims only in the last minute', () => {
    assert.equal(dimFor(WARN_MS + 1), 0)
    assert.equal(dimFor(WARN_MS / 2), 0.35)
    assert.equal(dimFor(0), 0.7)
  })
  test('the time left', () => {
    assert.equal(clock(42_000), '0:42')
    assert.equal(clock(23 * 60_000 + 10_000), '23:10')
    assert.equal(clock(3600_000 + 5 * 60_000 + 9_000), '1:05:09')
    assert.equal(clock(-5), '0:00')
  })
  test('read back from storage, checked', () => {
    assert.deepEqual(readTimer({ kind: 'minutes', endsAt: NOW + 1000 }, NOW), { kind: 'minutes', endsAt: NOW + 1000 })
    assert.equal(readTimer({ kind: 'minutes', endsAt: NOW - 1 }, NOW), null)
    assert.equal(readTimer({ kind: 'minutes', endsAt: NOW + 7 * 3600_000 }, NOW), null)
    assert.equal(readTimer({ kind: 'episode', endsAt: NOW + 1000 }, NOW), null)
    assert.equal(readTimer('x', NOW), null)
  })
})
