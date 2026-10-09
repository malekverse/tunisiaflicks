// Smoke tests for the Arab cinema map, against a running server:
//   BASE_URL=http://localhost:3300 node --import ./tests/register.mjs --test tests/arab-map.test.mjs
// The pages answer even when TMDB is unreachable (the map shows the names only); what they hold is
// only checked when TMDB_API_KEY is set.
import { test } from 'node:test'
import assert from 'node:assert/strict'

const BASE = (process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
const hasTmdb = !!process.env.TMDB_API_KEY
// First compiles of a page on a dev server can take a while.
const TIMEOUT = { timeout: 300_000 }

const get = (path, init) => fetch(BASE + path, { redirect: 'manual', ...init })

async function page(path, init) {
  const res = await get(path, init)
  assert.equal(res.status, 200, `${path} -> ${res.status}`)
  const html = await res.text()
  assert.match(html, /<html[^>]+lang=/, `${path}: not an HTML page`)
  assert.doesNotMatch(html, /Application error: a (client|server)-side exception/, `${path}: crashed`)
  return html
}

/** The country codes of the map's tiles, in the order they are drawn. */
const tiles = (html) => [...html.matchAll(/<a\b[^>]*data-country="([a-z]{2})"/g)].map((match) => match[1])

test('the map: 22 tiles, laid out left to right, Tunisia first in the tab order', TIMEOUT, async () => {
  const html = await page('/arab-cinema')
  const codes = tiles(html)
  assert.equal(codes.length, 22, `tiles: ${codes.join(',')}`)
  assert.equal(new Set(codes).size, 22)
  assert.match(html, /<div[^>]*role="group"[^>]*dir="ltr"/, 'the map is never mirrored')
  // One tab stop: Tunisia's tile on the index.
  const focusable = [...html.matchAll(/<a\b[^>]*data-country="([a-z]{2})"[^>]*>/g)].filter((match) => match[0].includes('tabindex="0"')).map((match) => match[1])
  assert.deepEqual(focusable, ['tn'])
  assert.match(html, /<h1[^>]*>Arab cinema<\/h1>/)
})

test('the index lists every country by name (the map\'s accessible twin)', TIMEOUT, async () => {
  const html = await page('/arab-cinema')
  for (const name of ['Egypt', 'Morocco', 'Palestine', 'Comoros']) assert.ok(html.includes(`>${name}<`), name)
  assert.match(html, /href="\/arab-cinema\/eg"/)
  // Tunisia's row and tile go to its own cinema page.
  assert.match(html, /href="\/tunisian\/cinema"/)
})

test('a country page: Egypt', TIMEOUT, async () => {
  const html = await page('/arab-cinema/eg')
  assert.match(html, /<h1[^>]*>Egypt<\/h1>/)
  assert.match(html, /aria-current="page"[^>]*data-country="eg"|data-country="eg"[^>]*aria-current="page"/, 'the tile is selected')
  assert.match(html, /<link rel="canonical" href="[^"]*\/arab-cinema\/eg"/)
})

test('an uppercase code goes to the lowercase page', TIMEOUT, async () => {
  const res = await get('/arab-cinema/EG')
  if (res.status === 308) {
    assert.match(res.headers.get('location') ?? '', /\/arab-cinema\/eg$/)
  } else {
    // Until the middleware answers it, the page redirects itself (streamed under the root loading screen).
    assert.equal(res.status, 200)
    assert.match(await res.text(), /http-equiv="refresh" content="0;url=\/arab-cinema\/eg"/)
  }
})

test('Tunisia goes to its own cinema page, permanently', TIMEOUT, async () => {
  const res = await get('/arab-cinema/tn')
  assert.equal(res.status, 308)
  assert.match(res.headers.get('location') ?? '', /\/tunisian\/cinema$/)
})

test('anything that is not a member is a 404', TIMEOUT, async () => {
  for (const path of ['/arab-cinema/zz', '/arab-cinema/fr', '/arab-cinema/egypt']) {
    assert.equal((await get(path)).status, 404, path)
  }
})

test('Arabic: right to left, the country in Arabic, the map still left to right', TIMEOUT, async () => {
  const html = await page('/arab-cinema/eg', { headers: { cookie: 'tf-locale=ar' } })
  assert.match(html, /<html[^>]*lang="ar"[^>]*dir="rtl"/)
  assert.match(html, /<h1[^>]*>مصر<\/h1>/)
  assert.match(html, /<div[^>]*role="group"[^>]*dir="ltr"/)
  const index = await page('/arab-cinema', { headers: { cookie: 'tf-locale=ar' } })
  assert.ok(index.includes('>فلسطين<'), 'Palestine is فلسطين')
})

test('the Tunisian cinema page has a door to the map', TIMEOUT, async () => {
  const html = await page('/tunisian/cinema')
  assert.match(html, /href="\/arab-cinema"/)
  assert.match(html, /See the Arab cinema map/)
})

test('a country with titles has its stats, today\'s pick and its rows', { ...TIMEOUT, skip: !hasTmdb && 'no TMDB_API_KEY' }, async () => {
  const html = await page('/arab-cinema/eg')
  assert.match(html, /First film on record/)
  assert.match(html, /aria-label="Today’s pick"/)
  assert.match(html, /aria-label="New releases"/)
  assert.match(html, /<nav aria-label="Nearby"/, 'neighbours are a nav of chips')
  assert.match(html, /href="\/arab-cinema\/ly"/)
})

test('a small country shows everything at once', { ...TIMEOUT, skip: !hasTmdb && 'no TMDB_API_KEY' }, async () => {
  const html = await page('/arab-cinema/dj')
  assert.match(html, /Everything on record/)
})

test('the share cards answer', { ...TIMEOUT, skip: (process.platform === 'win32' && 'next/og cannot run on a Windows dev server') || (!hasTmdb && 'no TMDB_API_KEY') }, async () => {
  for (const path of ['/arab-cinema/opengraph-image', '/arab-cinema/eg/opengraph-image']) {
    const res = await get(path)
    assert.equal(res.status, 200, path)
    assert.match(res.headers.get('content-type') ?? '', /^image\//, path)
  }
})
