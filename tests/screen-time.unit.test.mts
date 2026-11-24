// Unit tests for lib/screen-time: Kids profiles' daily limit and bedtime.
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { cleanScreenTime, inBedtime, isReportableDay, localClock, screenState } from '@/src/lib/screen-time'

const at = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3))

describe('Screen time settings', () => {
  test('only the offered choices', () => {
    assert.deepEqual(cleanScreenTime({ limit: 60, bedtime: '20:30' }), { limit: 60, bedtime: '20:30', wake: '07:00' })
    assert.deepEqual(cleanScreenTime({ limit: 61, bedtime: '20:30', wake: '06:30' }), { limit: null, bedtime: '20:30', wake: '06:30' })
    assert.equal(cleanScreenTime({ limit: null, bedtime: null }), null)
    assert.equal(cleanScreenTime({ limit: 'all', bedtime: '25:00' }), null)
    assert.equal(cleanScreenTime(null), null)
  })
})

describe('Bedtime', () => {
  const screen = cleanScreenTime({ bedtime: '20:30' })
  test('from bedtime to the morning, across midnight', () => {
    assert.ok(!inBedtime(screen, at('20:29')))
    assert.ok(inBedtime(screen, at('20:30')))
    assert.ok(inBedtime(screen, at('02:00')))
    assert.ok(inBedtime(screen, at('06:59')))
    assert.ok(!inBedtime(screen, at('07:00')))
    assert.ok(!inBedtime(null, at('23:00')))
  })
})

describe('What a Kids profile may still watch', () => {
  const screen = cleanScreenTime({ limit: 60, bedtime: '21:00' })
  test('time left: the sooner of the limit and bedtime', () => {
    assert.deepEqual(screenState(screen, 10, at('17:00')), { stop: null, left: 50 })
    assert.deepEqual(screenState(screen, 10, at('20:40')), { stop: null, left: 20 })
  })
  test('stops when the day’s time is used, or at bedtime', () => {
    assert.deepEqual(screenState(screen, 60, at('17:00')), { stop: 'limit', left: 0 })
    assert.deepEqual(screenState(screen, 0, at('21:00')), { stop: 'bedtime', left: 0 })
  })
  test('nothing set, nothing stops', () => {
    assert.deepEqual(screenState(null, 500, at('23:00')), { stop: null, left: null })
    assert.deepEqual(screenState(cleanScreenTime({ bedtime: '21:00' }), 500, at('08:00')).stop, null)
  })
})

describe('Days', () => {
  test('the device’s day and time', () => {
    const clock = localClock(new Date(2026, 10, 24, 20, 5))
    assert.deepEqual(clock, { day: '2026-11-24', minutes: 20 * 60 + 5 })
  })
  test('a device reports a day within a day of the server’s', () => {
    const now = new Date('2026-11-24T23:30:00Z')
    assert.ok(isReportableDay('2026-11-25', now))
    assert.ok(isReportableDay('2026-11-24', now))
    assert.ok(!isReportableDay('2026-11-20', now))
    assert.ok(!isReportableDay('2026-13-01', now))
    assert.ok(!isReportableDay('x', now))
  })
})
