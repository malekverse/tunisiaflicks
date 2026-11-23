// Unit tests for lib/plus-rules: TunisiaFlicks+ time and invite rewards.
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  daysLeft, extendUntil, FRIENDS_PER_MONTH, INVITE_MONTHS_MAX, inviteMonths, isAccent, isActive, isNewAccount, isRefCode, limitFor,
  refCodeFrom, towardsNext, cleanFromName, findGiftCode, giftCodeFrom, isGiftCode, isGiftToken,
} from '@/src/lib/plus-rules'
import { findSupportCode } from '@/src/lib/badges/kofi'

const at = new Date('2026-12-01T00:00:00Z')
const DAY = 86_400_000

describe('Plus time', () => {
  test('from now when there is none or it ran out', () => {
    assert.equal(extendUntil(null, 31, at).getTime(), at.getTime() + 31 * DAY)
    assert.equal(extendUntil(new Date(at.getTime() - 5 * DAY), 31, at).getTime(), at.getTime() + 31 * DAY)
  })
  test('adds up on top of the Plus you have', () => {
    const until = new Date(at.getTime() + 10 * DAY)
    assert.equal(extendUntil(until, 31, at).getTime(), at.getTime() + 41 * DAY)
  })
  test('active and days left', () => {
    assert.ok(isActive(new Date(at.getTime() + 1000), at))
    assert.ok(!isActive(at, at))
    assert.ok(!isActive(null, at))
    assert.equal(daysLeft(new Date(at.getTime() + 1.2 * DAY), at), 2)
    assert.equal(daysLeft(new Date(at.getTime() - DAY), at), 0)
  })
})

describe('invite rewards', () => {
  test('a month for every three friends, granted once', () => {
    assert.deepEqual(inviteMonths(2, 0), { earned: 0, due: 0 })
    assert.deepEqual(inviteMonths(3, 0), { earned: 1, due: 1 })
    assert.deepEqual(inviteMonths(7, 1), { earned: 2, due: 1 })
    assert.deepEqual(inviteMonths(6, 2), { earned: 2, due: 0 })
  })
  test('never more than the cap', () => {
    assert.equal(inviteMonths(FRIENDS_PER_MONTH * 100, 0).earned, INVITE_MONTHS_MAX)
  })
  test('progress towards the next month', () => {
    assert.equal(towardsNext(0), 0)
    assert.equal(towardsNext(4), 1)
    assert.equal(towardsNext(FRIENDS_PER_MONTH * INVITE_MONTHS_MAX + 2), FRIENDS_PER_MONTH)
  })
  test('only a new account can take an invite', () => {
    assert.ok(isNewAccount(new Date(at.getTime() - DAY), at))
    assert.ok(!isNewAccount(new Date(at.getTime() - 10 * DAY), at))
  })
  test('codes: eight characters, no look-alikes', () => {
    const code = refCodeFrom(new Uint8Array([0, 1, 2, 3, 250, 251, 252, 253, 9]))
    assert.equal(code.length, 8)
    assert.ok(isRefCode(code))
    assert.ok(!isRefCode('abc0def1'))
    assert.ok(!isRefCode('ABCDEFGH'))
  })
})

describe('perks', () => {
  test('accents and limits', () => {
    assert.ok(isAccent('gold'))
    assert.ok(!isAccent('neon'))
    assert.equal(limitFor('profiles', false), 5)
    assert.equal(limitFor('profiles', true), 8)
    assert.ok(limitFor('lists', true) > limitFor('lists', false))
  })
})

describe('gifts', () => {
  test('a gift code from random bytes, never with look-alikes', () => {
    const code = giftCodeFrom(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 255]))
    assert.ok(isGiftCode(code), code)
    assert.ok(!/[01IOL]/.test(code.slice(5)))
  })
  test('found in a Ko-fi message, however it was typed', () => {
    assert.equal(findGiftCode('For my brother! gift-ab3cd5ef thanks'), 'GIFT-AB3CD5EF')
    assert.equal(findGiftCode('GIFT-AB3CD5EF'), 'GIFT-AB3CD5EF')
    assert.equal(findGiftCode('GIFT-AB3CD5E'), null)          // too short
    assert.equal(findGiftCode('GIFT-AB0CD5EF'), null)         // 0 is never in a code
    assert.equal(findGiftCode(null), null)
  })
  test('a gift code is never taken for a support code', () => {
    assert.equal(findSupportCode('GIFT-AB3CD5EF'), null)
    assert.equal(findGiftCode('TF-AB3CD'), null)
  })
  test('the link’s secret and the giver’s name', () => {
    assert.ok(isGiftToken('kN0k2FDAztmroSOawzf7-Q'))
    assert.ok(!isGiftToken('GIFT-AB3CD5EF'))
    assert.equal(cleanFromName('  Amine‮  B. '), 'Amine B.')
    assert.equal([...cleanFromName('x'.repeat(50))].length, 30)
    assert.equal(cleanFromName(42), '')
  })
})
