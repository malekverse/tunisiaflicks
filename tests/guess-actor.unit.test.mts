// Unit tests for lib/guess-actor: Guess the actor's own rules.
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  actorArchiveDays, actorHeading, actorNumber, birthCountry, FACE, initialsOf, isPlayableActorDay, pickActor, ACTOR_EPOCH,
} from '@/src/lib/guess-actor'

describe('Guess the actor: days', () => {
  test('numbered from its first day', () => {
    assert.equal(actorNumber(ACTOR_EPOCH), 1)
    assert.equal(actorNumber('2026-12-01'), 8)
    assert.equal(actorHeading('2026-11-25'), 'TunisiaFlicks 🎭 #2')
  })
  test('only days from the first one to today', () => {
    assert.ok(isPlayableActorDay(ACTOR_EPOCH, '2026-11-30'))
    assert.ok(!isPlayableActorDay('2026-11-23', '2026-11-30'))
    assert.ok(!isPlayableActorDay('2026-12-01', '2026-11-30'))
    assert.deepEqual(actorArchiveDays('2026-11-26'), ['2026-11-26', '2026-11-25', '2026-11-24'])
  })
})

describe('Guess the actor: the face and the clues', () => {
  test('sharper and wider at every stage, sharp at the end', () => {
    for (let stage = 2; stage <= 6; stage++) {
      const now = FACE[stage as 1], before = FACE[(stage - 1) as 1]
      assert.ok(now.blur < before.blur && now.zoom < before.zoom, `stage ${stage}`)
    }
    assert.equal(FACE[6].blur, 0)
  })
  test('initials', () => {
    assert.equal(initialsOf('Denzel Washington'), 'D. W.')
    assert.equal(initialsOf('Jean-Claude Van Damme'), 'J. C. V.')
    assert.equal(initialsOf('Zendaya'), 'Z.')
    assert.equal(initialsOf('عادل إمام'), 'ع. إ.')
    assert.equal(initialsOf('  '), '')
  })
  test('the country of a place of birth', () => {
    assert.equal(birthCountry('Mount Vernon, New York, USA'), 'USA')
    assert.equal(birthCountry('Tunis, Tunisia'), 'Tunisia')
    assert.equal(birthCountry(null), null)
    assert.equal(birthCountry(''), null)
  })
})

describe('Guess the actor: who a film gives', () => {
  const cast = [
    { id: 3, name: 'Third', profile_path: '/c.jpg', order: 2 },
    { id: 1, name: 'Star', profile_path: '/a.jpg', order: 0 },
    { id: 2, name: 'No face', profile_path: null, order: 1 },
    { id: 4, name: 'Fourth', profile_path: '/d.jpg', order: 3 },
  ]
  test('the first billed with a face', () => {
    assert.equal(pickActor(cast, new Set())?.id, 1)
  })
  test('someone who hasn’t been a puzzle yet, among the first three', () => {
    assert.equal(pickActor(cast, new Set([1]))?.id, 3)
    assert.equal(pickActor(cast, new Set([1, 3])), null)
  })
  test('actors only', () => {
    assert.equal(pickActor([{ id: 9, name: 'Director', profile_path: '/x.jpg', order: 0, known_for_department: 'Directing' }], new Set()), null)
  })
})
