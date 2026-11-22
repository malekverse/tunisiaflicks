// Unit tests for lib/taste: the taste match between two people's ratings.
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { agreement, MIN_COMMON, scoreOf, tasteMatch, verdictFor, type Rated } from '@/src/lib/taste'

const rated = (id: number, stars: number, at = id): Rated => ({ key: `movie:${id}`, media_type: 'movie', id: String(id), stars, at })
const same = (n: number, stars = 4) => Array.from({ length: n }, (_, index) => ({ mine: stars, theirs: stars }))

describe('the score', () => {
  test('agreement goes from 1 (same stars) to 0 (four apart)', () => {
    assert.equal(agreement(4, 4), 1)
    assert.equal(agreement(5, 3), 0.5)
    assert.equal(agreement(1, 5), 0)
  })
  test('no score below the minimum overlap', () => {
    assert.equal(scoreOf(same(MIN_COMMON - 1)), null)
    assert.notEqual(scoreOf(same(MIN_COMMON)), null)
  })
  test('the same stars every time: film twins, and surer with more titles', () => {
    const few = scoreOf(same(3))!
    const many = scoreOf(same(20))!
    assert.ok(many > few, `${many} > ${few}`)
    assert.equal(verdictFor(scoreOf(same(8))!), 'twins')
  })
  test('a star apart on average is common ground, two apart are opposites', () => {
    const oneApart = Array.from({ length: 10 }, (_, index) => ({ mine: 4, theirs: index % 2 ? 3 : 5 }))
    const twoApart = Array.from({ length: 10 }, () => ({ mine: 5, theirs: 3 }))
    assert.equal(verdictFor(scoreOf(oneApart)!), 'common')
    assert.equal(verdictFor(scoreOf(twoApart)!), 'opposites')
  })
  test('always between 0 and 100', () => {
    assert.ok(scoreOf(Array.from({ length: 50 }, () => ({ mine: 1, theirs: 5 })))! <= 5)
    assert.ok(scoreOf(same(500))! <= 100)
  })
})

describe('the match', () => {
  const mine = [rated(1, 5), rated(2, 4), rated(3, 1), rated(4, 3), rated(9, 5)]
  const theirs = [rated(1, 5), rated(2, 5), rated(3, 5), rated(4, 3), rated(7, 4, 100), rated(8, 5, 50), rated(6, 2)]
  const match = tasteMatch(mine, theirs)

  test('counts the titles both rated', () => {
    assert.equal(match.common, 4)
    assert.notEqual(match.score, null)
  })
  test('both loved: four stars or more on both sides, best first', () => {
    assert.deepEqual(match.bothLoved.map((pair) => pair.id), ['1', '2'])
  })
  test('disagreements: two stars apart or more', () => {
    assert.deepEqual(match.disagree.map((pair) => [pair.id, pair.mine, pair.theirs]), [['3', 1, 5]])
  })
  test('what they loved that you haven’t rated, five stars first', () => {
    assert.deepEqual(match.theyLoved.map((row) => row.id), ['8', '7'])
  })
  test('your favourites they haven’t rated', () => {
    assert.deepEqual(match.youLoved.map((row) => row.id), ['9'])
  })
  test('nothing in common: no score, still suggestions', () => {
    const apart = tasteMatch([rated(1, 5)], [rated(2, 5)])
    assert.equal(apart.score, null)
    assert.equal(apart.verdict, null)
    assert.equal(apart.theyLoved.length, 1)
  })
})
