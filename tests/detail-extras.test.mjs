// Smoke tests for the title pages' extras, against a running server:
//   BASE_URL=http://localhost:3300 node --import ./tests/register.mjs --test tests/detail-extras.test.mjs
// Checks that need TMDB or Deezer answers run only when TMDB_API_KEY is set.
import { test } from 'node:test'
import assert from 'node:assert/strict'

const BASE = (process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
const hasTmdb = !!process.env.TMDB_API_KEY
// First compiles of a page on a dev server can take a while.
const TIMEOUT = { timeout: 300_000 }

const get = (path) => fetch(BASE + path, { redirect: 'manual' })
const json = async (path) => {
  const res = await get(path)
  return { status: res.status, body: await res.json().catch(() => null) }
}

test('the title pages render their sections in order', { ...TIMEOUT, skip: !hasTmdb && 'no TMDB_API_KEY' }, async () => {
  for (const path of ['/movie/550', '/tv/1396']) {
    const res = await get(path)
    assert.equal(res.status, 200, path)
    const html = await res.text()
    assert.doesNotMatch(html, /Application error/, `${path}: crashed`)
    const order = ['similar', 'extras', 'cast']
      .map((id) => ({ id, at: html.indexOf(`id="${id}"`) }))
      .filter((section) => section.at >= 0)
    assert.ok(order.length >= 2, `${path}: sections found: ${order.map((s) => s.id).join(',')}`)
    assert.deepEqual(order.map((s) => s.id), [...order].sort((a, b) => a.at - b.at).map((s) => s.id), `${path}: out of order`)
  }
})

test('more-like-this checks what it is asked', TIMEOUT, async () => {
  assert.equal((await json('/api/more-like-this?type=movie&id=550&but=nope&kids=0')).status, 400)
  assert.equal((await json('/api/more-like-this?type=film&id=550&but=newer&kids=0')).status, 400)
  assert.equal((await json('/api/more-like-this?type=movie&id=abc&but=newer&kids=0')).status, 400)
  // A guest is never a Kids profile: asking as one means the page is out of date.
  const stale = await json('/api/more-like-this?type=movie&id=550&but=newer&kids=1')
  assert.equal(stale.status, 409)
  assert.equal(stale.body?.code, 'profile_changed')
})

for (const but of ['newer', 'darker', 'older']) {
  test(`more-like-this, but ${but}: titles, never the film itself`, { ...TIMEOUT, skip: !hasTmdb && 'no TMDB_API_KEY' }, async () => {
    const { status, body } = await json(`/api/more-like-this?type=movie&id=550&but=${but}&kids=0`)
    assert.equal(status, 200)
    assert.equal(body.but, but)
    assert.ok(body.items.length >= 4, `${but}: ${body.items.length} items`)
    assert.ok(!body.items.some((item) => Number(item.id) === 550), `${but}: includes 550`)
  })
}

test('seen-with needs an account; the soundtrack checks its id', TIMEOUT, async () => {
  assert.equal((await json('/api/seen-with?people=6384')).status, 401)
  assert.equal((await json('/api/soundtrack?type=movie&id=abc&kids=0')).status, 400)
})

test("Inception's soundtrack is Hans Zimmer's", { ...TIMEOUT, skip: !hasTmdb && 'no TMDB_API_KEY' }, async () => {
  const { status, body } = await json('/api/soundtrack?type=movie&id=27205&kids=0')
  assert.equal(status, 200)
  assert.equal(body.status, 'found')
  assert.match(body.album.artist, /Zimmer/)
  assert.ok(!/cdns-preview/.test(JSON.stringify(body)), 'no preview URL is handed out')
})
