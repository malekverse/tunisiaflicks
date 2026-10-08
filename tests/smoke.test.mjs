// Smoke tests against a running server: the main pages render and the public APIs answer sanely.
// Run: `npm run build && npm start` in one terminal, then `npm run test:smoke`
// (BASE_URL defaults to http://localhost:3000). Pages that need TMDB are skipped when
// TMDB_API_KEY isn't set (e.g. CI on a fork without secrets).
import { test } from 'node:test'
import assert from 'node:assert/strict'

const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
const hasTmdb = !!process.env.TMDB_API_KEY

const get = (path, init) => fetch(BASE + path, { redirect: 'manual', ...init })

async function page(path) {
  const res = await get(path)
  assert.equal(res.status, 200, `${path} -> ${res.status}`)
  const html = await res.text()
  assert.match(html, /<html[^>]+lang=/, `${path}: not an HTML page`)
  assert.doesNotMatch(html, /Application error: a (client|server)-side exception/, `${path}: crashed`)
  return html
}

const STATIC_PAGES = ['/about', '/privacy', '/terms', '/dmca', '/contact', '/login', '/signup', '/swipe', '/ramadan']
const TMDB_PAGES = ['/', '/tv', '/clips', '/discover', '/upcoming', '/top-rated', '/search?q=batman', '/movie/550', '/tv/1396', '/person/287', '/tunisian/cinema']

for (const path of STATIC_PAGES) test(`page ${path}`, () => page(path))
for (const path of TMDB_PAGES) test(`page ${path}`, { skip: !hasTmdb && 'no TMDB_API_KEY' }, () => page(path))

test('home page has the brand and the language switch', { skip: !hasTmdb && 'no TMDB_API_KEY' }, async () => {
  const html = await page('/')
  assert.match(html, /TunisiaFlicks/)
  assert.match(html, /تونسي/)
})

test('Derja locale renders right-to-left', async () => {
  const res = await get('/about', { headers: { cookie: 'tf-locale=tn' } })
  assert.match(await res.text(), /<html[^>]*lang="ar-TN"[^>]*dir="rtl"/)
})

test('unknown page -> 404', async () => {
  assert.equal((await get('/this-page-does-not-exist')).status, 404)
})

test('robots, sitemap, manifest and service worker', async () => {
  assert.equal((await get('/robots.txt')).status, 200)
  assert.equal((await get('/manifest.webmanifest')).status, 200)
  const sw = await get('/sw.js')
  assert.equal(sw.status, 200)
  assert.match(await sw.text(), /addEventListener\('push'/)
  if (hasTmdb) assert.equal((await get('/sitemap.xml')).status, 200)
})

test('stream health API', async () => {
  const res = await get('/api/stream-health')
  assert.equal(res.status, 200)
  assert.equal(typeof (await res.json()), 'object')
  const bad = await get('/api/stream-health', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Nope', ok: true }) })
  assert.equal(bad.status, 400)
})

test('push API reports whether it is configured', async () => {
  const body = await (await get('/api/push')).json()
  assert.equal(typeof body.enabled, 'boolean')
})

test('swipe: unknown room -> 404, missing name -> 400', async () => {
  assert.equal((await get('/api/swipe/ZZZZZZ')).status, 404)
  const res = await get('/api/swipe', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
  assert.equal(res.status, 400)
})

test('calendar: invalid type -> 400', async () => {
  assert.equal((await get('/api/calendar?type=book&id=1')).status, 400)
})

test('account APIs require a session', async () => {
  assert.equal((await get('/api/account/export')).status, 401)
  const res = await get('/api/account', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: '{}' })
  assert.equal(res.status, 401)
})

test('contact form validates input', async () => {
  const res = await get('/api/contact', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.9.${Math.floor(Math.random() * 250)}.1` }, body: JSON.stringify({ kind: 'contact' }) })
  assert.equal(res.status, 400)
})
