// Unit tests for lib/source-rank: which stream source a title starts on.
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { isTitleKey, rankSources, titleStatus, type RankInput } from '@/src/lib/source-rank'

const base = (extra: Partial<RankInput> = {}): RankInput => ({
  names: ['A', 'B', 'C', 'D'],
  overall: {},
  title: {},
  mineHere: null,
  mine: null,
  preferred: new Set(),
  ...extra,
})

describe('a title’s word on a source', () => {
  test('two plays and mostly fine: good; three reports and mostly broken: down', () => {
    assert.equal(titleStatus({ ok: 2, broken: 0 }), 'good')
    assert.equal(titleStatus({ ok: 1, broken: 0 }), 'unknown')
    assert.equal(titleStatus({ ok: 0, broken: 3 }), 'down')
    assert.equal(titleStatus({ ok: 3, broken: 3 }), 'unknown')
  })
})

describe('the order and the start', () => {
  test('nothing known: the curated order, the first one', () => {
    assert.deepEqual(rankSources(base()), { order: ['A', 'B', 'C', 'D'], start: 'A', reason: 'default' })
  })
  test('what worked for this viewer here comes first', () => {
    const result = rankSources(base({ mineHere: 'C' }))
    assert.equal(result.order[0], 'C')
    assert.equal(result.start, 'C')
    assert.equal(result.reason, 'mineHere')
  })
  test('what plays this title for others outranks overall health and habit', () => {
    const result = rankSources(base({ title: { C: { ok: 4, broken: 0 } }, mine: 'B' }))
    assert.equal(result.start, 'C')
    assert.equal(result.reason, 'title')
  })
  test('the best record first among a title’s good ones', () => {
    const result = rankSources(base({ title: { B: { ok: 2, broken: 1 }, D: { ok: 9, broken: 0 } } }))
    assert.deepEqual(result.order.slice(0, 2), ['D', 'B'])
  })
  test('broken here goes last, even if it’s the viewer’s usual one', () => {
    const result = rankSources(base({ title: { A: { ok: 0, broken: 4 } }, mine: 'A' }))
    assert.equal(result.order.at(-1), 'A')
    assert.notEqual(result.start, 'A')
  })
  test('nothing known here: the viewer’s usual source', () => {
    assert.equal(rankSources(base({ mine: 'C' })).start, 'C')
  })
  test('the desktop app’s player stays on top', () => {
    const result = rankSources(base({ names: ['A', 'Local', 'B'], pinned: 'Local', title: { B: { ok: 5, broken: 0 } } }))
    assert.equal(result.order[0], 'Local')
    assert.equal(result.start, 'Local')
  })
  test('sources without pop-up ads before the others, down ones last', () => {
    const result = rankSources(base({ preferred: new Set(['C']), overall: { A: 'down' } }))
    assert.deepEqual(result.order, ['C', 'B', 'D', 'A'])
  })
})

describe('title keys', () => {
  test('a film or a show', () => {
    assert.ok(isTitleKey('movie:550'))
    assert.ok(isTitleKey('tv:1399'))
    assert.ok(!isTitleKey('tv:1399:1:2'))
    assert.ok(!isTitleKey('anime:1'))
  })
})
