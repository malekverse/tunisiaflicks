// Unit tests for the Arab cinema map: the grid, the arrow keys, the neighbours, typeahead, the
// birthplace rules and the index (Kids filtering, its cache key, failure handling) against a fake
// TMDB.
//   node --import ./tests/register.mjs --test tests/arab-map.unit.test.mjs
import { test, describe, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { ARAB_COUNTRY_CODES, arabCountryName } from '@/src/lib/arab-countries'
import {
  FIRST_TILE, LAST_TILE, MAP_CELLS, MAP_COLUMNS, MAP_ROWS, cellOf, foldName, intensity, neighbours, posterOpacity,
  rippleDelay, sortByName, step, typeahead,
} from '@/src/lib/arab-map'
import { bornIn, filmOfTheDay, withoutMislabelled } from '@/src/lib/country-cinema'
import { buildArabMapIndex, indexCacheKey, mapLimit, namesOnlyIndex } from '@/src/lib/arab-cinema'

describe('the grid', () => {
  test('holds the 22 members once each, inside 9 by 5, no two on one square', () => {
    assert.equal(MAP_CELLS.length, 22)
    assert.deepEqual([...MAP_CELLS.map((cell) => cell.code)].sort(), [...ARAB_COUNTRY_CODES].sort())
    const squares = new Set(MAP_CELLS.map((cell) => `${cell.x},${cell.y}`))
    assert.equal(squares.size, 22)
    for (const cell of MAP_CELLS) {
      assert.ok(cell.x >= 0 && cell.x < MAP_COLUMNS && cell.y >= 0 && cell.y < MAP_ROWS, cell.code)
    }
  })

  test('is laid out as planned (west to east, north to south)', () => {
    assert.deepEqual(cellOf('tn'), { code: 'tn', x: 2, y: 0 })
    assert.deepEqual(cellOf('qa'), { code: 'qa', x: 8, y: 1 })
    assert.deepEqual(cellOf('km'), { code: 'km', x: 6, y: 4 })
  })

  test('the ripple starts at Tunisia and grows with the distance', () => {
    assert.equal(rippleDelay('tn'), 0)
    assert.equal(rippleDelay('dz'), 40)
    assert.ok(rippleDelay('km') > rippleDelay('so'))
  })

  test('tiles get brighter, on a log scale, up to 5000 titles', () => {
    assert.equal(intensity(0), 0)
    assert.equal(intensity(null), 0)
    assert.equal(intensity(5000), 1)
    assert.equal(intensity(20000), 1)
    assert.ok(intensity(10) < intensity(100) && intensity(100) < intensity(1000))
    assert.equal(posterOpacity(0), 0.14)
    assert.equal(posterOpacity(5000), 0.4)
    // Rounded, so server and browser write the same style.
    assert.equal(posterOpacity(553), Math.round(posterOpacity(553) * 1000) / 1000)
  })
})

describe('arrow keys', () => {
  test('from Tunisia, Right is Lebanon and Down is Libya', () => {
    assert.equal(step('tn', 'right'), 'lb')
    assert.equal(step('tn', 'down'), 'ly')
  })

  test('a tile straight ahead beats a closer one off to the side', () => {
    // Libya → right: Egypt is next to it.
    assert.equal(step('ly', 'right'), 'eg')
    // Saudi Arabia → down: Yemen, straight below.
    assert.equal(step('sa', 'down'), 'ye')
    assert.equal(step('ye', 'down'), 'so')
    assert.equal(step('so', 'down'), 'km')
  })

  test('nothing beyond the edges', () => {
    assert.equal(step('ma', 'left'), null)
    assert.equal(step('ma', 'up'), null)
    assert.equal(step('qa', 'right'), null)
    assert.equal(step('km', 'down'), null)
  })

  test('every tile can be reached from Tunisia with the arrows', () => {
    const seen = new Set(['tn'])
    const queue = ['tn']
    while (queue.length) {
      const code = queue.shift()
      for (const direction of ['left', 'right', 'up', 'down']) {
        const next = step(code, direction)
        if (next && !seen.has(next)) {
          seen.add(next)
          queue.push(next)
        }
      }
    }
    assert.equal(seen.size, 22)
  })

  test('Home and End are Morocco and Comoros', () => {
    assert.equal(FIRST_TILE, 'ma')
    assert.equal(LAST_TILE, 'km')
  })
})

describe('neighbours', () => {
  test('at most four, real members, never the country itself', () => {
    for (const code of ARAB_COUNTRY_CODES) {
      const list = neighbours(code)
      assert.ok(list.length >= 1 && list.length <= 4, code)
      assert.ok(!list.includes(code), code)
      assert.equal(new Set(list).size, list.length, code)
      for (const other of list) assert.ok(ARAB_COUNTRY_CODES.includes(other), `${code} → ${other}`)
    }
  })

  test('are the countries next door, nearest first', () => {
    assert.deepEqual(neighbours('eg'), ['ly', 'sd', 'ps', 'jo'])
    assert.equal(neighbours('ma')[0], 'dz')
    assert.equal(neighbours('ps')[0], 'jo')
    assert.deepEqual(neighbours('eg', 2), ['ly', 'sd'])
  })

  test('land neighbours are neighbours both ways', () => {
    for (const [a, b] of [['ma', 'dz'], ['dz', 'tn'], ['tn', 'ly'], ['ly', 'eg'], ['eg', 'sd'], ['sy', 'lb'], ['iq', 'kw'], ['ae', 'om'], ['dj', 'so']]) {
      assert.ok(neighbours(a).includes(b), `${a} → ${b}`)
      assert.ok(neighbours(b).includes(a), `${b} → ${a}`)
    }
  })
})

describe('names', () => {
  const entries = ARAB_COUNTRY_CODES.map((code) => ({ code, names: [arabCountryName(code, 'ar'), arabCountryName(code, 'en')] }))

  test('folding drops the article, accents and hamza seats', () => {
    assert.equal(foldName('المغرب'), 'مغرب')
    assert.equal(foldName('الإمارات العربية المتحدة'), 'امارات العربية المتحدة')
    assert.equal(foldName('Égypte'), 'egypte')
    assert.equal(foldName('  Oman '), 'oman')
  })

  test('typeahead finds Egypt in Arabic and in English', () => {
    assert.equal(typeahead('مصر', entries), 'eg')
    assert.equal(typeahead('مص', entries), 'eg')
    assert.equal(typeahead('egy', entries), 'eg')
    assert.equal(typeahead('EGY', entries), 'eg')
  })

  test('typeahead ignores a leading ال and accents', () => {
    assert.equal(typeahead('مغرب', entries), 'ma')
    assert.equal(typeahead('امارات', entries), 'ae')
    assert.equal(typeahead('الأردن', entries), 'jo')
    assert.equal(typeahead('palestine', entries), 'ps')
    assert.equal(typeahead('فلسطين', entries), 'ps')
    assert.equal(typeahead('zz', entries), null)
  })

  test('a repeated letter cycles through the matches', () => {
    const first = typeahead('s', entries, 'tn')
    const second = typeahead('ss', entries, first)
    assert.ok(first && second && first !== second)
    assert.ok(['sy', 'sa', 'sd', 'so'].includes(first) && ['sy', 'sa', 'sd', 'so'].includes(second))
  })

  test('Palestine is called Palestine', () => {
    assert.equal(arabCountryName('ps', 'en'), 'Palestine')
    assert.equal(arabCountryName('ps', 'ar'), 'فلسطين')
    assert.equal(arabCountryName('ps', 'tn'), 'فلسطين')
  })

  test('the list sorts by name, the article set aside', () => {
    const arabic = sortByName(['tn', 'bh', 'jo', 'ae'].map((code) => ({ code, name: arabCountryName(code, 'ar') })), 'ar').map((item) => item.code)
    // الأردن (أ), الإمارات (إ), البحرين (ب), تونس (ت)
    assert.deepEqual(arabic, ['jo', 'ae', 'bh', 'tn'])
    const english = sortByName(['tn', 'eg', 'dz'].map((code) => ({ code, name: arabCountryName(code, 'en') })), 'en').map((item) => item.code)
    assert.deepEqual(english, ['dz', 'eg', 'tn'])
  })
})

describe('born in', () => {
  test('a country or one of its cities', () => {
    assert.ok(bornIn('eg', 'Cairo, Egypt'))
    assert.ok(bornIn('eg', 'القاهرة، مصر'))
    assert.ok(bornIn('lb', 'Beirut, Lebanon'))
    assert.ok(bornIn('ma', 'Casablanca, Maroc'))
    assert.ok(bornIn('ps', 'Nablus, Palestine'))
    assert.ok(bornIn('ps', 'Gaza'))
    assert.ok(bornIn('jo', 'Amman, Jordan'))
    assert.ok(bornIn('om', 'Muscat, Oman'))
    assert.ok(bornIn('om', 'سلطنة عمان'))
  })

  test("a bare 'عمان' is neither Oman nor Jordan", () => {
    assert.ok(!bornIn('om', 'عمان'))
    assert.ok(!bornIn('jo', 'عمان'))
  })

  test("a bare 'Tripoli' is neither Libya nor Lebanon", () => {
    assert.ok(!bornIn('ly', 'Tripoli'))
    assert.ok(!bornIn('lb', 'Tripoli'))
    assert.ok(bornIn('ly', 'Tripoli, Libya'))
    assert.ok(bornIn('lb', 'Tripoli, Lebanon'))
  })

  test('South Sudan is not Sudan', () => {
    assert.ok(bornIn('sd', 'Khartoum, Sudan'))
    assert.ok(!bornIn('sd', 'Juba, South Sudan'))
    assert.ok(!bornIn('sd', 'جنوب السودان'))
  })

  test('namesakes elsewhere and lookalike words are not', () => {
    assert.ok(!bornIn('lb', 'Lebanon, Pennsylvania, USA'))
    assert.ok(!bornIn('ps', 'Palestine, Texas, United States'))
    assert.ok(!bornIn('lb', 'Mansoura, Egypt'))
    assert.ok(bornIn('eg', 'المنصورة، مصر'))
    assert.ok(!bornIn('lb', 'المنصورة، مصر'))
    assert.ok(!bornIn('tn', 'Nablus'))
    assert.ok(!bornIn('dz', 'Moran, Kansas'))
    assert.ok(!bornIn('eg', null))
  })
})

describe('TMDB data', () => {
  test('Khmer films filed under Comoros are left out, and the count follows', () => {
    const page = { total_results: 100, total_pages: 5, results: [{ id: 1, original_language: 'km' }, { id: 2, original_language: 'fr' }, { id: 3, original_language: 'km' }, { id: 4, original_language: 'ar' }] }
    const kept = withoutMislabelled('km', page)
    assert.deepEqual(kept.results.map((item) => item.id), [2, 4])
    assert.equal(kept.total_results, 50)
    assert.equal(withoutMislabelled('eg', page), page)
    const single = withoutMislabelled('km', { ...page, total_pages: 1 })
    assert.equal(single.total_results, 2)
  })

  test('the film of the day is the same all day, and changes with the date', () => {
    const known = { total_results: 10, total_pages: 1, results: Array.from({ length: 8 }, (_, index) => ({ id: index + 1, title: `Film ${index + 1}`, poster_path: `/p${index}.jpg`, backdrop_path: `/b${index}.jpg`, release_date: '2001-01-01' })) }
    const pages = { known, popular: null, series: null }
    const a = filmOfTheDay('eg', '2026-10-09', pages)
    assert.deepEqual(filmOfTheDay('eg', '2026-10-09', pages), a)
    assert.equal(a.kind, 'movie')
    const days = new Set(['2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13'].map((day) => filmOfTheDay('eg', day, pages).id))
    assert.ok(days.size > 1)
    assert.equal(filmOfTheDay('eg', '2026-10-09', { known: null, popular: null, series: null }), null)
  })

  test('mapLimit keeps the order and never runs more than the limit at once', async () => {
    let running = 0
    let peak = 0
    const out = await mapLimit(Array.from({ length: 30 }, (_, index) => index), 12, async (value) => {
      running++
      peak = Math.max(peak, running)
      await new Promise((resolve) => setTimeout(resolve, 2))
      running--
      return value * 2
    })
    assert.equal(peak, 12)
    assert.deepEqual(out, Array.from({ length: 30 }, (_, index) => index * 2))
  })
})

describe('the index', () => {
  test('Kids have their own cache entry, per language and per day', () => {
    const grown = indexCacheKey(false, 'en-US', '2026-10-09')
    const kids = indexCacheKey(true, 'en-US', '2026-10-09')
    assert.notDeepEqual(grown, kids)
    assert.ok(kids.includes('kids') && grown.includes('all'))
    assert.notDeepEqual(indexCacheKey(false, 'ar', '2026-10-09'), grown)
    assert.notDeepEqual(indexCacheKey(false, 'en-US', '2026-10-10'), grown)
  })

  // A fake TMDB: Egypt has a comedy rated PG and a horror film rated R, and a series; every other
  // country has nothing. With `down`, nothing answers.
  const realFetch = globalThis.fetch
  const realError = console.error
  let down = false
  beforeEach(() => {
    process.env.TMDB_API_KEY = 'test'
    console.error = () => {}
    down = false
    globalThis.fetch = async (input) => {
      const url = new URL(String(input))
      if (down) return new Response('{}', { status: 503 })
      const path = url.pathname.replace('/3/', '')
      const json = (data) => new Response(JSON.stringify(data), { status: 200, headers: { 'content-type': 'application/json' } })
      const comedy = { id: 1, title: 'Family Comedy', poster_path: '/comedy.jpg', backdrop_path: '/comedy-b.jpg', genre_ids: [35], release_date: '2001-05-01', original_language: 'ar' }
      const horror = { id: 2, title: 'Night Horror', poster_path: '/horror.jpg', backdrop_path: '/horror-b.jpg', genre_ids: [27], release_date: '2010-05-01', original_language: 'ar' }
      const show = { id: 3, name: 'Grown-up Drama', poster_path: '/show.jpg', backdrop_path: null, genre_ids: [18], first_air_date: '2015-01-01', original_language: 'ar' }
      if (path === 'movie/1/release_dates') return json({ results: [{ iso_3166_1: 'US', release_dates: [{ certification: 'PG' }] }] })
      if (path === 'movie/2/release_dates') return json({ results: [{ iso_3166_1: 'US', release_dates: [{ certification: 'R' }] }] })
      if (path.startsWith('discover/')) {
        const egypt = url.searchParams.get('with_origin_country') === 'EG'
        const kids = url.searchParams.has('certification')
        if (!egypt) return json({ results: [], total_results: 0, total_pages: 0 })
        if (path === 'discover/movie') {
          // TMDB's own Kids filter would drop the horror film; keep it here to prove filterKidSafe does.
          return json({ results: [horror, comedy], total_results: kids ? 2 : 640, total_pages: kids ? 1 : 32 })
        }
        return json({ results: kids ? [] : [show], total_results: kids ? 0 : 120, total_pages: 1 })
      }
      return json({})
    }
  })
  afterEach(() => {
    globalThis.fetch = realFetch
    console.error = realError
  })

  test('grown-ups: counts, a film of the day, 22 countries in grid order', async () => {
    const index = await buildArabMapIndex('en', false, '2026-10-09')
    assert.equal(index.namesOnly, false)
    assert.deepEqual(index.countries.map((country) => country.code), MAP_CELLS.map((cell) => cell.code))
    const egypt = index.countries.find((country) => country.code === 'eg')
    assert.equal(egypt.name, 'Egypt')
    assert.equal(egypt.films, 640)
    assert.equal(egypt.series, 120)
    assert.equal(egypt.n, 760)
    assert.ok([1, 2].includes(egypt.pick.id))
    const oman = index.countries.find((country) => country.code === 'om')
    assert.equal(oman.n, 0)
    assert.equal(oman.pick, null)
  })

  test('Kids: no unsafe title anywhere, and empty countries count zero (dimmed)', async () => {
    for (const date of ['2026-10-09', '2026-10-10', '2026-10-11', '2026-10-12']) {
      const index = await buildArabMapIndex('en', true, date)
      const egypt = index.countries.find((country) => country.code === 'eg')
      assert.equal(egypt.pick?.id, 1, date)
      assert.ok(egypt.n > 0)
      for (const country of index.countries) {
        assert.notEqual(country.pick?.id, 2, `${country.code} shows the R-rated film`)
        if (country.code !== 'eg') assert.equal(country.n, 0, country.code)
      }
    }
  })

  test('Arabic names in an Arabic index', async () => {
    const index = await buildArabMapIndex('ar', false, '2026-10-09')
    const egypt = index.countries.find((country) => country.code === 'eg')
    assert.equal(egypt.name, 'مصر')
    assert.equal(egypt.en, 'Egypt')
  })

  test('TMDB down: the build throws (nothing cached), and the fallback is names only', async () => {
    down = true
    await assert.rejects(() => buildArabMapIndex('en', false, '2026-10-09'))
    const fallback = namesOnlyIndex('en', '2026-10-09')
    assert.equal(fallback.namesOnly, true)
    assert.equal(fallback.countries.length, 22)
    assert.ok(fallback.countries.every((country) => country.pick === null && country.films === null && country.name))
  })
})
