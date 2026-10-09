// Smoke tests for French against a running server (BASE_URL, default http://localhost:3000):
//   BASE_URL=http://localhost:3300 node --test tests/french.test.mjs   (or npm run test:smoke)
// Pages that need TMDB are skipped when TMDB_API_KEY isn't set.
import { test } from 'node:test'
import assert from 'node:assert/strict'

const BASE = (process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
const hasTmdb = !!process.env.TMDB_API_KEY
const ARABIC = new RegExp(`[${String.fromCharCode(0x600)}-${String.fromCharCode(0x6ff)}]`)

const get = (path, headers = {}) => fetch(BASE + path, { redirect: 'manual', headers })
const french = { cookie: 'tf-locale=fr' }

async function html(path, headers) {
  const res = await get(path, headers)
  assert.equal(res.status, 200, `${path} -> ${res.status}`)
  return res.text()
}
const htmlTag = (page) => page.match(/<html[^>]*>/)?.[0] ?? ''
const main = (page) => page.slice(page.indexOf('<main'), page.indexOf('</main>'))

const postLocale = (body, type = 'application/json') =>
  fetch(`${BASE}/api/locale`, { method: 'POST', headers: { 'content-type': type }, body: typeof body === 'string' ? body : JSON.stringify(body) })

test('French cookie: /about is French, left to right', async () => {
  const page = await html('/about', french)
  assert.match(htmlTag(page), /lang="fr"/)
  assert.match(htmlTag(page), /dir="ltr"/)
  assert.match(page, /À propos de TunisiaFlicks/)
  // A page's own metadata says which language it is in, for link previews.
  assert.match(page, /<meta property="og:locale" content="fr_FR"\/>/)
  assert.match(page, /<meta property="og:locale:alternate" content="en_US"\/>/)
})

test('French cookie: /privacy has no Arabic', async () => {
  const content = main(await html('/privacy', french))
  assert.ok(content.length > 1000, 'the page has content')
  assert.doesNotMatch(content, ARABIC)
  assert.match(content, /Politique de confidentialité/)
})

test('negotiation: Accept-Language without a cookie', async () => {
  const lang = async (headers) => htmlTag(await html('/about', headers)).match(/lang="([^"]+)" dir="([^"]+)"/)?.slice(1).join(' ')
  assert.equal(await lang({ 'accept-language': 'fr-FR,fr;q=0.9' }), 'fr ltr')
  assert.equal(await lang({ 'accept-language': 'ar-TN,fr;q=0.8' }), 'ar rtl')
  assert.equal(await lang({ 'accept-language': 'de-DE,fr;q=0.5' }), 'fr ltr')
  assert.equal(await lang({ 'accept-language': 'de' }), 'en ltr')
  assert.equal(await lang({ 'accept-language': 'fr-FR', cookie: 'tf-locale=en' }), 'en ltr')
  assert.equal(await lang({ cookie: 'tf-locale=tn' }), 'ar-TN rtl')
})

test('French cookie: a movie page shows the French title and text', { skip: !hasTmdb && 'no TMDB_API_KEY' }, async () => {
  const fightClub = await html('/movie/550', french)
  assert.match(fightClub, /<title>Fight Club \(1999\)/)
  assert.match(fightClub, /Bande-annonce/)
  assert.match(fightClub, /Le narrateur/, 'the French overview')
  const darkKnight = await html('/movie/155', french)
  assert.match(darkKnight, /Le Chevalier noir/, 'the French title')
})

test('French cookie: TV genres are French, not TMDB\'s English leftovers', { skip: !hasTmdb && 'no TMDB_API_KEY' }, async () => {
  const page = await html('/discover?type=tv', french)
  assert.doesNotMatch(page, /War (&amp;|&) Politics/)
  assert.match(page, /Guerre et politique/)
})

test('POST /api/locale: JSON only', async () => {
  assert.equal((await postLocale('locale=fr', 'application/x-www-form-urlencoded')).status, 415)
  assert.equal((await postLocale('fr', 'text/plain')).status, 415)
})

test('POST /api/locale: a known locale, an https endpoint', async () => {
  assert.equal((await postLocale({ locale: 'de' })).status, 400)
  assert.equal((await postLocale({})).status, 400)
  assert.equal((await postLocale('{not json')).status, 400)
  assert.equal((await postLocale({ locale: 'fr', endpoint: 'http://push.example/1' })).status, 400)
  assert.equal((await postLocale({ locale: 'fr', endpoint: `https://push.example/${'x'.repeat(2100)}` })).status, 400)
})

test('POST /api/locale: 200 for a valid switch (signed out, unknown endpoint: nothing created)', async () => {
  const res = await postLocale({ locale: 'fr' })
  assert.equal(res.status, 200)
  assert.deepEqual(await res.json(), { ok: true })
  assert.equal((await postLocale({ locale: 'tn', endpoint: 'https://fcm.googleapis.com/fcm/send/smoke-test' })).status, 200)
})
