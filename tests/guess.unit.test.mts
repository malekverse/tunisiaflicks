// Unit tests for lib/guess: the rules behind "Guess the film" (/guess).
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  addDays, archiveDays, dayFromNumber, dayNumber, focalPoint, GUESS_EPOCH, hintFor, isDay, isPlayableDay, judge, maskTitle, misses,
  nextPuzzleAt, outcome, pickIndex, puzzleNumber, shareText, stageFor, stats, storyLine, titleWords, tunisDay, unwrapAnswer, wrapAnswer,
  type Answer, type Entry, type Game,
} from '@/src/lib/guess'

const answer: Answer = { id: 278, title: 'The Shawshank Redemption', original_title: 'The Shawshank Redemption', year: 1994, genre_ids: [18, 80], poster_path: '/p.jpg', backdrop_path: '/b.jpg' }
const wrong: Entry = { kind: 'guess', id: 1, title: 'x', year: 2000, poster_path: null, right: false, hint: null }
const right: Entry = { kind: 'guess', id: 278, title: 'x', year: 1994, poster_path: null, right: true, hint: null }
const skip: Entry = { kind: 'skip' }
const game = (day: string, entries: Entry[], finishedOn: string | null = day): Game => ({ day, pool: 'all', entries, finishedOn })

describe('days', () => {
  test('the day in Tunis (UTC+1)', () => {
    assert.equal(tunisDay(new Date('2026-12-01T22:59:00Z')), '2026-12-01')
    assert.equal(tunisDay(new Date('2026-12-01T23:00:00Z')), '2026-12-02')
  })
  test('isDay only takes real calendar days', () => {
    assert.ok(isDay('2026-02-28'))
    assert.ok(!isDay('2026-02-30'))
    assert.ok(!isDay('2026-2-3'))
    assert.ok(!isDay(20260228))
  })
  test('numbers count from the first puzzle', () => {
    assert.equal(dayNumber(GUESS_EPOCH), 0)
    assert.equal(puzzleNumber(GUESS_EPOCH), 1)
    assert.equal(puzzleNumber(addDays(GUESS_EPOCH, 40)), 41)
    assert.equal(dayFromNumber(dayNumber('2027-03-01')), '2027-03-01')
  })
  test('only days from #1 to today are playable', () => {
    assert.ok(isPlayableDay(GUESS_EPOCH, '2026-12-01'))
    assert.ok(isPlayableDay('2026-12-01', '2026-12-01'))
    assert.ok(!isPlayableDay('2026-12-02', '2026-12-01'))
    assert.ok(!isPlayableDay(addDays(GUESS_EPOCH, -1), '2026-12-01'))
  })
  test('the archive goes newest first, back to #1 at most', () => {
    const days = archiveDays(addDays(GUESS_EPOCH, 2))
    assert.deepEqual(days, [addDays(GUESS_EPOCH, 2), addDays(GUESS_EPOCH, 1), GUESS_EPOCH])
    assert.equal(archiveDays(addDays(GUESS_EPOCH, 500)).length, 60)
  })
  test('the next puzzle starts at midnight in Tunis', () => {
    assert.equal(new Date(nextPuzzleAt(new Date('2026-12-01T10:00:00Z'))).toISOString(), '2026-12-01T23:00:00.000Z')
    assert.equal(new Date(nextPuzzleAt(new Date('2026-12-01T23:30:00Z'))).toISOString(), '2026-12-02T23:00:00.000Z')
  })
})

describe('which film', () => {
  test('every film comes once before any comes back', () => {
    const size = 487
    const seen = new Set(Array.from({ length: size }, (_, n) => pickIndex(n, size)))
    assert.equal(seen.size, size)
  })
  test('a film already used is skipped', () => {
    const first = pickIndex(5, 100)
    assert.equal(pickIndex(5, 100, (index) => index === first), (first + 1) % 100)
  })
  test('an empty pool has no film', () => {
    assert.equal(pickIndex(3, 0), -1)
  })
  test('the crop is the same all day, inside the frame', () => {
    assert.deepEqual(focalPoint('2026-12-01'), focalPoint('2026-12-01'))
    for (let n = 0; n < 50; n++) {
      const { x, y } = focalPoint(dayFromNumber(n))
      assert.ok(x >= 28 && x <= 72 && y >= 30 && y <= 70)
    }
  })
})

describe('the clues', () => {
  test('one stage more per miss, everything once it is over', () => {
    assert.equal(stageFor(0, false), 1)
    assert.equal(stageFor(3, false), 4)
    assert.equal(stageFor(9, false), 6)
    assert.equal(stageFor(0, true), 6)
  })
  test('the title words worth hiding', () => {
    assert.deepEqual([...titleWords(['The Lord of the Rings'])].sort(), ['lord', 'rings'])
  })
  test('the title is blacked out of the story, in any form', () => {
    const segments = maskTitle('Marlin searches for Nemo. Nemo’s father never gives up finding him.', ['Finding Nemo'])
    const masked = segments.filter((segment) => segment.masked).map((segment) => segment.text)
    assert.deepEqual(masked, ['Nemo', 'Nemo', 'finding'])
    assert.equal(segments.map((segment) => segment.text).join(''), 'Marlin searches for Nemo. Nemo’s father never gives up finding him.')
  })
  test('accents and case do not save a title word', () => {
    const masked = maskTitle('AMÉLIE vit à Paris.', ['Le Fabuleux Destin d’Amélie Poulain']).filter((segment) => segment.masked)
    assert.equal(masked[0].text, 'AMÉLIE')
  })
  test('a story line stops at a sentence', () => {
    const line = storyLine(`${'A'.repeat(150)}. ${'B'.repeat(150)}.`)
    assert.equal(line, `${'A'.repeat(150)}.`)
    assert.equal(storyLine('Short.'), 'Short.')
  })
})

describe('a guess', () => {
  test('the right film wins', () => {
    const entry = judge({ id: 278, title: 'x', year: 1994, genre_ids: [], poster_path: null }, answer)
    assert.ok(entry.kind === 'guess' && entry.right && entry.hint === null)
  })
  test('a wrong guess says newer or older, and the genres in common', () => {
    assert.deepEqual(hintFor({ year: 2001, genre_ids: [18, 35] }, answer), { year: 'older', genres: [18] })
    assert.deepEqual(hintFor({ year: 1980, genre_ids: [] }, answer), { year: 'newer', genres: [] })
    assert.equal(hintFor({ year: 1994, genre_ids: [] }, answer).year, 'same')
    assert.equal(hintFor({ year: null, genre_ids: [] }, answer).year, null)
  })
  test('the outcome', () => {
    assert.equal(outcome([wrong, skip]), 'playing')
    assert.equal(outcome([wrong, right]), 'won')
    assert.equal(outcome([wrong, wrong, skip, wrong, wrong, skip]), 'lost')
    assert.equal(misses([wrong, skip, right]), 2)
  })
})

describe('stats', () => {
  const today = '2026-12-10'
  test('streak of films found on their own day, up to yesterday while today is open', () => {
    const games = [game('2026-12-07', [right]), game('2026-12-08', [wrong, right]), game('2026-12-09', [right]), game('2026-12-10', [wrong])]
    const result = stats(games, today)
    assert.equal(result.streak, 3)
    assert.equal(result.played, 3)
    assert.deepEqual(result.distribution, [2, 1, 0, 0, 0, 0])
  })
  test('a lost day ends the streak, the best one stays', () => {
    const games = [game('2026-12-07', [right]), game('2026-12-08', [right]), game('2026-12-09', Array(6).fill(wrong)), game('2026-12-10', [right])]
    const result = stats(games, today)
    assert.equal(result.streak, 1)
    assert.equal(result.best, 2)
    assert.equal(result.winRate, 75)
  })
  test('a past day played later counts in the stats but not the streak', () => {
    const result = stats([game('2026-12-09', [right], '2026-12-10')], today)
    assert.equal(result.won, 1)
    assert.equal(result.streak, 0)
  })
})

describe('sharing', () => {
  test('one square per try, no spoilers', () => {
    const text = shareText(GUESS_EPOCH, [wrong, skip, right], 'https://tunisiaflicks.app/guess')
    assert.equal(text, 'TunisiaFlicks #1 3/6\n🟥⬛🟩⬜⬜⬜\nhttps://tunisiaflicks.app/guess')
    assert.ok(shareText(GUESS_EPOCH, Array(6).fill(wrong), 'u').includes('X/6'))
  })
  test('the answer survives the wrapping, and never sits in plain text', () => {
    const arabic = { ...answer, title: 'الخلاص من شاوشانك' }
    const wrapped = wrapAnswer(arabic)
    assert.ok(!wrapped.includes('Shawshank'))
    assert.deepEqual(unwrapAnswer(wrapped), arabic)
    assert.equal(unwrapAnswer('not it'), null)
  })
})
