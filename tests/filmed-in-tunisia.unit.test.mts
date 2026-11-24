// Unit tests for lib/filmed-in-tunisia: the places, and the map they're drawn on.
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { DJERBA, MAP_HEIGHT, MAP_WIDTH, OUTLINE, PLACES, filmIds, mapsLink, pathOf, project, textIn } from '@/src/lib/filmed-in-tunisia'

describe('Filmed in Tunisia: the places', () => {
  test('each one has its id once, texts in three languages and at least one film', () => {
    const ids = new Set<string>()
    for (const place of PLACES) {
      assert.ok(!ids.has(place.id), place.id)
      ids.add(place.id)
      assert.match(place.id, /^[a-z-]+$/)
      for (const text of [place.name, place.area, place.visit, ...place.films.map((film) => film.scene)]) {
        assert.ok(text.en && text.fr && text.ar, place.id)
      }
      assert.ok(place.films.length > 0, place.id)
    }
  })
  test('every place is in Tunisia, and on the map', () => {
    for (const place of PLACES) {
      assert.ok(place.lat > 30 && place.lat < 37.6 && place.lon > 7.4 && place.lon < 11.7, place.id)
      const [x, y] = project(place.lat, place.lon)
      assert.ok(x > 0 && x < MAP_WIDTH && y > 0 && y < MAP_HEIGHT, place.id)
    }
  })
  test('the films, once each', () => {
    const ids = filmIds()
    assert.equal(new Set(ids).size, ids.length)
    assert.ok(ids.includes(11) && ids.includes(44281))
  })
  test('the reader’s language; Tunisian reads the Arabic', () => {
    const text = { en: 'a', fr: 'b', ar: 'c' }
    assert.deepEqual(['en', 'fr', 'ar', 'tn'].map((locale) => textIn(text, locale)), ['a', 'b', 'c', 'c'])
  })
})

describe('Filmed in Tunisia: the map', () => {
  test('north up, west left', () => {
    const [bizerteX, bizerteY] = project(37.27, 9.87)
    const [djerbaX, djerbaY] = project(33.8, 10.9)
    assert.ok(bizerteY < djerbaY)
    assert.ok(project(34, 8)[0] < djerbaX && bizerteX < djerbaX)
  })
  test('closed outlines, and a maps link per place', () => {
    for (const ring of [OUTLINE, DJERBA]) assert.deepEqual(ring[0], ring[ring.length - 1])
    assert.match(pathOf(DJERBA), /^M[\d. ]+(L[\d. ]+)+Z$/)
    assert.equal(mapsLink({ lat: 33.5, lon: 9.9 }), 'https://www.google.com/maps/search/?api=1&query=33.5,9.9')
  })
})
