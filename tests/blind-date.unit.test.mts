// Unit tests for lib/blind-date: the wishes and the TMDB request they make.
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { cleanWishes, DEFAULT_WISHES, discoverParams, pagesToTry, runtimeParts } from '@/src/lib/blind-date'

describe('wishes', () => {
  test('anything unknown goes back to "any"', () => {
    assert.deepEqual(cleanWishes({ mood: 'laugh', length: 'forever', era: 1999, origin: 'mars' }), { ...DEFAULT_WISHES, mood: 'laugh' })
    assert.deepEqual(cleanWishes(null), DEFAULT_WISHES)
  })
})

describe('the request', () => {
  test('no wishes: well-liked, known films, no documentaries', () => {
    const params = discoverParams(DEFAULT_WISHES)
    assert.equal(params['vote_average.gte'], 6.8)
    assert.equal(params.without_genres, '99,10770')
    assert.equal(params.with_genres, undefined)
    assert.equal(params.include_adult, false)
  })
  test('mood, length, era and origin each narrow it', () => {
    const params = discoverParams({ mood: 'think', length: 'short', era: 'modern', origin: 'asia' })
    assert.equal(params.with_genres, '9648|878')
    assert.equal(params['with_runtime.lte'], 100)
    assert.equal(params['primary_release_date.gte'], '2000-01-01')
    assert.equal(params['primary_release_date.lte'], '2015-12-31')
    assert.match(String(params.with_original_language), /ko/)
  })
  test('smaller cinemas need fewer votes', () => {
    assert.ok(Number(discoverParams({ ...DEFAULT_WISHES, origin: 'arab' })['vote_count.gte']) < Number(discoverParams(DEFAULT_WISHES)['vote_count.gte']))
  })
  test('a Kids profile never gets a grown-up mood', () => {
    assert.equal(discoverParams({ ...DEFAULT_WISHES, mood: 'scared' }, true).with_genres, undefined)
    assert.equal(discoverParams({ ...DEFAULT_WISHES, mood: 'laugh' }, true).with_genres, '35')
  })
  test('long films start at 140 minutes', () => {
    assert.equal(discoverParams({ ...DEFAULT_WISHES, length: 'long' })['with_runtime.gte'], 140)
  })
})

describe('pages and lengths', () => {
  test('every page once, at most the first 15', () => {
    const pages = pagesToTry(40, (max) => max - 1)
    assert.equal(pages.length, 15)
    assert.deepEqual([...pages].sort((a, b) => a - b), Array.from({ length: 15 }, (_, index) => index + 1))
    assert.deepEqual(pagesToTry(0, () => 0), [1])
  })
  test('runtime in hours and minutes', () => {
    assert.deepEqual(runtimeParts(112), { hours: 1, minutes: 52 })
  })
})
