// Smoke tests for the drama hubs and the thumbnail route, against a running server:
//   BASE_URL=http://localhost:3300 node --import ./tests/register.mjs --test tests/drama-hubs.test.mjs
// The pages answer 200 even when TMDB is unreachable (they say so and offer "Try again"); what
// they contain is only checked when TMDB_API_KEY is set.
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

/** The hrefs of the chip links marked as the current page. */
const currentChips = (html) => [...html.matchAll(/<a\b[^>]*>/g)]
  .map((match) => match[0])
  .filter((tag) => tag.includes('data-chip') && tag.includes('aria-current="page"'))
  .map((tag) => tag.match(/href="([^"]*)"/)?.[1])

const jsonLd = (html) => [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map((match) => JSON.parse(match[1]))

for (const path of ['/dramas', '/dramas/turkish', '/dramas/korean', '/dramas/turkish?shelf=romance', '/dramas/korean?shelf=short']) {
  test(`page ${path}`, TIMEOUT, () => page(path))
}

test('an unknown hub is a 404', TIMEOUT, async () => {
  assert.equal((await get('/dramas/japanese')).status, 404)
})

test('an unknown shelf shows the whole hub', TIMEOUT, async () => {
  const html = await page('/dramas/korean?shelf=nonsense')
  assert.deepEqual(currentChips(html), ['/dramas/korean'])
})

test('the filter chips are a nav of links, the current one marked', TIMEOUT, async () => {
  const html = await page('/dramas/turkish?shelf=romance')
  assert.match(html, /<nav aria-label="Show"/)
  assert.deepEqual(currentChips(html), ['/dramas/turkish?shelf=romance'])
  // Turkish | Korean keeps the shelf.
  assert.match(html, /href="\/dramas\/korean\?shelf=romance"/)
})

test('Derja renders the hub right-to-left', TIMEOUT, async () => {
  const html = await page('/dramas/turkish', { headers: { cookie: 'tf-locale=tn' } })
  assert.match(html, /<html[^>]*lang="ar-TN"[^>]*dir="rtl"/)
})

test('hubs describe themselves as a CollectionPage', { ...TIMEOUT, skip: !hasTmdb && 'no TMDB_API_KEY' }, async () => {
  for (const path of ['/dramas', '/dramas/korean']) {
    const pages = jsonLd(await page(path)).filter((data) => data['@type'] === 'CollectionPage')
    assert.equal(pages.length, 1, path)
    assert.match(pages[0].url, new RegExp(`${path.replace(/\//g, '\\/')}$`))
  }
  const [hub] = jsonLd(await page('/dramas/turkish')).filter((data) => data['@type'] === 'CollectionPage')
  assert.ok(hub.mainEntity?.itemListElement?.length >= 5, 'the Top 10 is listed')
})

test('a hub shows its featured series and rows', { ...TIMEOUT, skip: !hasTmdb && 'no TMDB_API_KEY' }, async () => {
  const html = await page('/dramas/korean')
  assert.match(html, /aria-label="Featured series"/)
  assert.match(html, /href="\/tv\/\d+\?s=1&amp;e=1"/, 'Play goes to the first episode')
  assert.match(html, /Top 10 K-dramas this week/)
})

test('the home page has the Beyond Hollywood shelf', { ...TIMEOUT, skip: !hasTmdb && 'no TMDB_API_KEY' }, async () => {
  const html = await page('/')
  assert.match(html, /Beyond Hollywood/)
  assert.match(html, /href="\/dramas\/turkish"/)
  assert.match(html, /href="\/dramas\/korean"/)
})

test('YouTube thumbnails come through our own route', TIMEOUT, async () => {
  const res = await get('/api/yt-thumb/dQw4w9WgXcQ/mq')
  assert.equal(res.status, 200)
  assert.equal(res.headers.get('content-type'), 'image/jpeg')
  assert.match(res.headers.get('cache-control') ?? '', /max-age=86400/)
  assert.ok((await res.arrayBuffer()).byteLength > 1000)
})

test('thumbnail route: a bad id or size is a 404', TIMEOUT, async () => {
  for (const path of ['/api/yt-thumb/not-an-id/mq', '/api/yt-thumb/dQw4w9WgXcQ/huge', '/api/yt-thumb/..%2F..%2Fetc/mq', '/api/yt-thumb/zzzzzzzzzzz/mq']) {
    const res = await get(path)
    assert.equal(res.status, 404, path)
    await res.arrayBuffer()
  }
})
