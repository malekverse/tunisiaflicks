// Unit tests for lib/franchise (a film's franchise in watch order) and lib/watch-providers (where a
// title is legally available).
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { franchiseProgress, orderParts, worthShowing } from '@/src/lib/franchise'
import { offersFor, viewerCountry } from '@/src/lib/watch-providers'

const TODAY = '2026-11-24'
const part = (id: number, title: string, release_date: string | undefined) => ({ id, title, release_date, poster_path: `/p${id}.jpg`, vote_average: 7 })

describe('A franchise in order', () => {
  const parts = orderParts([
    part(3, 'Third', '2004-05-31'),
    part(9, 'Next one', '2027-11-01'),
    part(1, 'First', '2001-11-16'),
    part(10, 'Announced', undefined),
    part(2, 'Second', '2002-11-13'),
    { id: 'x', title: 'Broken' },
    { id: 4, title: '' },
  ], TODAY)

  test('the films out by date, then what’s coming, then what has no date', () => {
    assert.deepEqual(parts.map((p) => p.id), ['1', '2', '3', '9', '10'])
    assert.deepEqual(parts.map((p) => p.upcoming), [false, false, false, true, true])
  })
  test('worth a section with two films out', () => {
    assert.ok(worthShowing(parts))
    assert.ok(!worthShowing(orderParts([part(1, 'One', '2001-01-01'), part(2, 'Soon', '2030-01-01')], TODAY)))
  })
  test('how far you’ve got, and what’s next', () => {
    assert.deepEqual(franchiseProgress(parts, []), { total: 3, watched: 0, next: parts[0] })
    const some = franchiseProgress(parts, ['1', '3', '9'])
    assert.equal(some.watched, 2)
    assert.equal(some.next?.id, '2')
    assert.equal(franchiseProgress(parts, ['1', '2', '3']).next, null)
  })
  test('nothing usable, nothing at all', () => {
    assert.deepEqual(orderParts(null, TODAY), [])
  })
})

describe('Where to watch legally', () => {
  const answer = {
    results: {
      TN: {
        link: 'https://www.themoviedb.org/movie/550/watch?locale=TN',
        flatrate: [
          { provider_id: 1796, provider_name: 'Netflix Standard with Ads', logo_path: '/ads.jpg', display_priority: 5 },
          { provider_id: 8, provider_name: 'Netflix', logo_path: '/n.jpg', display_priority: 1 },
          { provider_id: 1715, provider_name: 'Shahid VIP', logo_path: '/s.jpg', display_priority: 3 },
        ],
        rent: [{ provider_id: 2, provider_name: 'Apple TV', logo_path: '/a.jpg', display_priority: 2 }, { provider_id: 8, provider_name: 'Netflix', logo_path: '/n.jpg' }],
      },
      FR: { link: 'javascript:alert(1)', buy: [{ provider_id: 3, provider_name: 'Google Play Movies', logo_path: '../x' }] },
      US: { flatrate: [] },
    },
  }
  test('the country’s services, best known first, one of each', () => {
    const offers = offersFor(answer, 'TN')!
    assert.deepEqual(offers.stream.map((p) => p.name), ['Netflix', 'Shahid VIP'])
    assert.deepEqual(offers.rentBuy.map((p) => p.name), ['Apple TV'])
    assert.equal(offers.link, 'https://www.themoviedb.org/movie/550/watch?locale=TN')
  })
  test('links and logos checked', () => {
    const offers = offersFor(answer, 'FR')!
    assert.equal(offers.link, null)
    assert.equal(offers.rentBuy[0].logo, null)
  })
  test('a country with nothing shows nothing, never another country’s', () => {
    assert.equal(offersFor(answer, 'US'), null)
    assert.equal(offersFor(answer, 'DE'), null)
    assert.equal(offersFor(null, 'TN'), null)
  })
  test('the viewer’s country, Tunisia when unknown', () => {
    assert.equal(viewerCountry('fr'), 'FR')
    assert.equal(viewerCountry(null), 'TN')
    assert.equal(viewerCountry('XX'), 'TN')
    assert.equal(viewerCountry('../'), 'TN')
  })
})
