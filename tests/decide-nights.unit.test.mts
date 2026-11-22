// Unit tests for lib/decide-nights: the memory of Decide together (saved nights and what they say).
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ASK_AFTER_MS, cleanNights, fairChoosers, feelingCounts, nightStats, nightToRate, watchedTogether, type Night,
} from '@/src/lib/decide-nights'

const HOUR = 3600_000
const film = (id: number, by: string | null = null) => ({ key: `movie:${id}`, media_type: 'movie' as const, id: String(id), title: `Film ${id}`, poster_path: null, year: '2020', by })
const night = (id: string, at: number, extra: Partial<Night> = {}): Night => ({ id, at, method: 'wheel', films: [film(1)], people: [], chooser: null, feelings: null, ...extra })

describe('stored nights', () => {
  test('broken entries are left out, the rest comes back newest first', () => {
    const nights = cleanNights([
      night('a', 1),
      { id: 'b', at: 2, method: 'teleport', films: [film(1)] },
      { id: 'c', at: 3, method: 'vote', films: [] },
      { ...night('d', 4), feelings: { Lina: 'up', Sami: 'great' } },
      'nope',
    ])
    assert.deepEqual(nights.map((entry) => entry.id), ['d', 'a'])
    assert.deepEqual(nights[0].feelings, { Lina: 'up' })
  })
  test('a film key that isn’t a title is dropped', () => {
    assert.equal(cleanNights([{ ...night('a', 1), films: [{ key: 'javascript:1', title: 'x' }] }]).length, 0)
  })
})

describe('asking how it was', () => {
  const now = 100 * HOUR
  test('the newest night old enough, not rated, not skipped', () => {
    const nights = [night('new', now - 10 * 60_000), night('ready', now - 2 * HOUR), night('older', now - 5 * HOUR)]
    assert.equal(nightToRate(nights, now)?.id, 'ready')
  })
  test('not a rated or skipped night, nor one long gone', () => {
    assert.equal(nightToRate([night('a', now - 2 * HOUR, { feelings: { '': 'up' } })], now), null)
    assert.equal(nightToRate([night('a', now - 2 * HOUR, { skipped: true })], now), null)
    assert.equal(nightToRate([night('a', now - 20 * 24 * HOUR)], now), null)
    assert.equal(nightToRate([night('a', now - ASK_AFTER_MS)], now)?.id, 'a')
  })
  test('counts the feelings', () => {
    assert.deepEqual(feelingCounts({ feelings: { a: 'up', b: 'up', c: 'down' } }), { up: 2, meh: 0, down: 1 })
  })
})

describe('what the nights say', () => {
  const nights = [
    night('4', 4, { films: [film(4, 'Lina')], method: 'vote', feelings: { Lina: 'up', Sami: 'up' } }),
    night('3', 3, { films: [film(3, 'lina')], method: 'vote', feelings: { Lina: 'up', Sami: 'meh' } }),
    night('2', 2, { films: [film(2, 'Sami')], method: 'wheel', feelings: { Lina: 'down', Sami: 'down' } }),
    night('1', 1, { films: [film(1, 'Sami'), film(5, 'Amine')], method: 'wheel', feelings: { Lina: 'meh', Sami: 'up' }, chooser: 'Sami' }),
  ]
  const stats = nightStats(nights)
  test('nights and films', () => {
    assert.equal(stats.nights, 4)
    assert.equal(stats.films, 5)
  })
  test('whose picks win, names as one person whatever the case', () => {
    assert.equal(stats.topPicker?.wins, 2)
    assert.ok(['Lina', 'Sami'].includes(stats.topPicker!.name))
  })
  test('best taste: the picks the room liked most', () => {
    assert.deepEqual(stats.bestTaste, { name: 'Lina', liked: 75, rated: 2 })
  })
  test('the favourite way to decide (a tie goes to the first seen)', () => {
    assert.equal(stats.method?.nights, 2)
  })
  test('a streak: the same person’s picks, the latest nights in a row', () => {
    assert.deepEqual(stats.streak, { name: 'Lina', nights: 2 })
    assert.equal(nightStats(nights.slice(1)).streak, null)
  })
  test('when each title was watched together', () => {
    const seen = watchedTogether(nights)
    assert.equal(seen.get('movie:4'), 4)
    assert.equal(seen.get('movie:5'), 1)
    assert.equal(seen.has('movie:9'), false)
  })
})

describe('fair turns to choose', () => {
  const people = [{ name: 'Lina' }, { name: 'Sami' }, { name: 'Amine' }]
  test('whoever has chosen least lately', () => {
    const nights = [night('2', 2, { chooser: 'Lina' }), night('1', 1, { chooser: 'Sami' })]
    assert.deepEqual(fairChoosers(people, nights, 'Lina').map((person) => person.name), ['Amine'])
  })
  test('not last time’s chooser while someone else is left', () => {
    assert.deepEqual(fairChoosers(people, [], 'sami').map((person) => person.name), ['Lina', 'Amine'])
  })
  test('one person: always them', () => {
    assert.deepEqual(fairChoosers([{ name: 'Lina' }], [night('1', 1, { chooser: 'Lina' })], 'Lina').map((person) => person.name), ['Lina'])
  })
})
