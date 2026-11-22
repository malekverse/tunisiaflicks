// Unit tests for lib/decide: the rules behind "Decide together" (/decide).
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  champion, chooseDuel, cleanName, currentDuel, drawChooser, duelProgress, fairnessMatters, knockoutTurn, landingRotation,
  sameName, shuffle, spinIndex, startBracket, tallyBallots, tallyHands, voteResult, wheelWeights, type Pick, type RandomInt,
} from '@/src/lib/decide'

const pick = (key: string, by: string | null = null): Pick => ({
  key, media_type: 'movie', id: key.replace(/\D/g, '') || '1', title: key, poster_path: null, backdrop_path: null, year: '', by,
})
/** Always the same answer: the first option, or a fixed fraction of the range. */
const first: RandomInt = () => 0
const at = (fraction: number): RandomInt => (max) => Math.min(max - 1, Math.floor(max * fraction))
const close = (a: number, b: number) => Math.abs(a - b) < 1e-9

describe('names', () => {
  test('cleanName keeps one tidy line of at most 20 characters', () => {
    assert.equal(cleanName('  Sami \n  Ben   Ali '), 'Sami Ben Ali')
    assert.equal(cleanName('x'.repeat(40)).length, 20)
    assert.equal(cleanName('\u0000\u0007'), '')
  })
  test('sameName ignores case and accents', () => {
    assert.ok(sameName('Hélène', 'helene '))
    assert.ok(sameName('سامي', 'سامي'))
    assert.ok(!sameName('Sami', 'Samir'))
  })
})

describe('the wheel', () => {
  test('equal slices when fairness is off', () => {
    const weights = wheelWeights([pick('a', 'x'), pick('b', 'x'), pick('c', 'y')], false)
    weights.forEach((weight) => assert.ok(close(weight, 1 / 3)))
  })
  test('fair: each person gets the same share, whatever they threw in', () => {
    const weights = wheelWeights([pick('a', 'x'), pick('b', 'x'), pick('c', 'x'), pick('d', 'y')], true)
    assert.ok(close(weights[3], 0.5), 'one film for y: half the wheel')
    assert.ok(close(weights[0], 1 / 6))
    assert.ok(close(weights.reduce((sum, weight) => sum + weight, 0), 1))
  })
  test('fair: films nobody claimed count as one more person', () => {
    const weights = wheelWeights([pick('a', 'x'), pick('b'), pick('c')], true)
    assert.ok(close(weights[0], 0.5))
    assert.ok(close(weights[1], 0.25))
  })
  test('fairnessMatters only when someone threw in more', () => {
    assert.ok(!fairnessMatters([pick('a', 'x'), pick('b', 'y')]))
    assert.ok(fairnessMatters([pick('a', 'x'), pick('b', 'x'), pick('c', 'y')]))
  })
  test('spinIndex follows the weights', () => {
    const weights = [0.5, 0.25, 0.25]
    assert.equal(spinIndex(weights, at(0.1)), 0)
    assert.equal(spinIndex(weights, at(0.6)), 1)
    assert.equal(spinIndex(weights, at(0.9)), 2)
  })
  test('landingRotation puts the chosen slice under the pointer, always turning forward', () => {
    const weights = [0.25, 0.25, 0.5]
    for (const index of [0, 1, 2]) {
      for (const current of [0, 1234.5, -90]) {
        const rotation = landingRotation(weights, index, current, at(0.5))
        assert.ok(rotation > current + 360, 'a few full turns forward')
        // The point under the pointer (top) is at angle (360 - rotation) on the wheel.
        const under = (((360 - rotation) % 360) + 360) % 360
        const start = weights.slice(0, index).reduce((sum, weight) => sum + weight, 0) * 360
        assert.ok(under > start && under < start + weights[index] * 360, `slice ${index} from ${current}: ${under}`)
      }
    }
  })
})

describe('the vote', () => {
  const keys = ['a', 'b', 'c']
  test('a yes is a point, a favourite one more, and a favourite is a yes', () => {
    const tally = tallyBallots(keys, [
      { yes: ['a', 'b'], star: 'b' },
      { yes: ['a'], star: null },
      { yes: [], star: 'c' },
    ])
    // Same points: the favourites first, then the order they were added in.
    assert.deepEqual(tally.map((row) => [row.key, row.points, row.yes, row.stars]), [['b', 2, 1, 1], ['c', 2, 1, 1], ['a', 2, 2, 0]])
  })
  test('unknown films and double yeses are ignored', () => {
    const tally = tallyBallots(keys, [{ yes: ['a', 'a', 'z'], star: 'z' }])
    assert.equal(tally.find((row) => row.key === 'a')!.points, 1)
  })
  test('a clear winner', () => {
    const result = voteResult(tallyHands(keys, { a: 1, b: 4, c: 2 }), 1)
    assert.deepEqual(result, { winners: ['b'], tied: [], open: 0 })
  })
  test('a tie at the top goes to a tie-break, never to list order', () => {
    const result = voteResult(tallyHands(keys, { a: 3, b: 3, c: 1 }), 1)
    assert.deepEqual(result, { winners: [], tied: ['a', 'b'], open: 1 })
  })
  test('favourites break a tie on points', () => {
    const result = voteResult(tallyBallots(keys, [{ yes: ['a'], star: 'b' }, { yes: ['a', 'b'], star: null }]), 1)
    assert.deepEqual(result.winners, ['b'])
  })
  test('a double feature: one film in, a tie for the second place', () => {
    const result = voteResult(tallyHands(['a', 'b', 'c', 'd'], { a: 5, b: 2, c: 2, d: 0 }), 2)
    assert.deepEqual(result, { winners: ['a'], tied: ['b', 'c'], open: 1 })
  })
  test('a tie that fits in the places left is no tie', () => {
    const result = voteResult(tallyHands(['a', 'b', 'c'], { a: 2, b: 2, c: 0 }), 2)
    assert.deepEqual(result, { winners: ['a', 'b'], tied: [], open: 0 })
  })
  test('nobody raised a hand: everyone is tied', () => {
    assert.deepEqual(voteResult(tallyHands(keys, {}), 1), { winners: [], tied: keys, open: 1 })
  })
})

describe('the knockout', () => {
  test('people take turns, around and around', () => {
    assert.equal(knockoutTurn(['x', 'y'], 0), 'x')
    assert.equal(knockoutTurn(['x', 'y'], 3), 'y')
    assert.equal(knockoutTurn([], 2), null)
  })
})

describe('the duels', () => {
  const play = (keys: string[], pickWinner: (a: string, b: string) => string) => {
    let bracket = startBracket(keys, first)
    let duels = 0
    for (let duel = currentDuel(bracket); duel; duel = currentDuel(bracket)) {
      bracket = chooseDuel(bracket, pickWinner(duel[0], duel[1]))
      duels++
    }
    return { winner: champion(bracket), duels }
  }
  for (const size of [2, 3, 4, 5, 7, 8, 16]) {
    test(`${size} films: one champion after ${size - 1} duels, the best one wins`, () => {
      const keys = Array.from({ length: size }, (_, index) => `f${index}`)
      const { winner, duels } = play(keys, (a, b) => (Number(a.slice(1)) > Number(b.slice(1)) ? a : b))
      assert.equal(winner, `f${size - 1}`)
      assert.equal(duels, size - 1)
    })
  }
  test('a film that got a free pass plays first in the next round', () => {
    let bracket = startBracket(['a', 'b', 'c'], first)
    const [x, y] = currentDuel(bracket)!
    bracket = chooseDuel(bracket, x)
    assert.equal(bracket.round, 2)
    assert.deepEqual(currentDuel(bracket)!.slice().sort(), [x, bracket.contenders.find((key) => key !== x)!].sort())
    assert.notEqual(currentDuel(bracket)![0], x, 'the free-pass film comes first')
    assert.ok(!bracket.contenders.includes(y))
  })
  test('progress counts the duels of the round', () => {
    const bracket = startBracket(['a', 'b', 'c', 'd', 'e'], first)
    assert.deepEqual(duelProgress(bracket), { duel: 1, of: 2 })
  })
  test('choosing a film that is not in the duel changes nothing', () => {
    const bracket = startBracket(['a', 'b'], first)
    assert.equal(chooseDuel(bracket, 'zzz'), bracket)
  })
  test('one film: already the champion', () => {
    assert.equal(champion(startBracket(['a'])), 'a')
  })
})

describe('who chooses', () => {
  const people = [{ id: '1', name: 'Sami' }, { id: '2', name: 'Lina' }, { id: '3', name: 'Omar' }]
  test('fair: whoever chose last time sits this one out', () => {
    for (let index = 0; index < 3; index++) {
      const chosen = drawChooser(people, 'sami', true, () => index % 2)
      assert.notEqual(chosen!.name, 'Sami')
    }
  })
  test('not fair: anyone can be drawn', () => {
    assert.equal(drawChooser(people, 'Sami', false, first)!.name, 'Sami')
  })
  test('alone: the one person chooses, fair or not', () => {
    assert.equal(drawChooser([people[0]], 'Sami', true, first)!.name, 'Sami')
    assert.equal(drawChooser([], null, true), null)
  })
})

test('shuffle keeps every item', () => {
  const items = Array.from({ length: 20 }, (_, index) => index)
  assert.deepEqual(shuffle(items).sort((a, b) => a - b), items)
})
