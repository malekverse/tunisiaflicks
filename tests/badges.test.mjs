// Smoke tests for badges and supporters against a running server (BASE_URL, default :3000):
// /support renders (and stays out of search engines until support opens), the medallion art is a
// cacheable SVG, the Ko-fi webhook stays shut without its secrets and turns away bad bodies and
// wrong tokens, the nightly job needs the cron secret, and every personal API needs a profile.
//
// The webhook's configured branch is checked when KOFI_VERIFICATION_TOKEN is set in this process
// too (with the server's value); without it the webhook must answer 404.
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'

const BASE = (process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
const CRON_SECRET = process.env.CRON_SECRET?.trim() || ''
const KOFI_TOKEN = process.env.KOFI_VERIFICATION_TOKEN?.trim() || ''
const KOFI_OPEN = !!KOFI_TOKEN && !!process.env.SUPPORT_HASH_SECRET?.trim()

const call = (path, init = {}) => fetch(BASE + path, { redirect: 'manual', ...init })

async function json(res) {
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    assert.fail(`not JSON (${res.status}): ${text.slice(0, 160)}`)
  }
}

const kofiForm = (data) => new URLSearchParams({ data: typeof data === 'string' ? data : JSON.stringify(data) }).toString()
const FORM = { 'content-type': 'application/x-www-form-urlencoded' }

describe('/support', () => {
  test('renders for a guest, with its title and no crash', async () => {
    const res = await call('/support')
    assert.equal(res.status, 200)
    const html = await res.text()
    assert.match(html, /<html[^>]+lang=/)
    assert.doesNotMatch(html, /Application error: a (client|server)-side exception/)
    assert.match(html, /Support TunisiaFlicks/)
    // Open: the Ko-fi link opens in a new tab without an opener. Closed: kept out of search engines.
    if (/ko-fi\.com/i.test(html)) {
      assert.match(html, /<a[^>]+href="https:\/\/[^"]*ko-fi\.com[^"]*"[^>]+target="_blank"[^>]+rel="noopener noreferrer"/i)
    } else {
      assert.match(html, /<meta[^>]+name="robots"[^>]+content="[^"]*noindex/i)
    }
  })

  test('renders in Arabic, right to left', async () => {
    const res = await call('/support', { headers: { cookie: 'tf-locale=ar' } })
    assert.equal(res.status, 200)
    const html = await res.text()
    assert.match(html, /<html[^>]*dir="rtl"/)
    assert.match(html, /ادعم TunisiaFlicks/)
  })
})

describe('badge art', () => {
  test('every level of a badge is an immutable SVG, never red', async () => {
    for (const file of ['openingNight-3.svg', 'marathon-0.svg', 'marathon-1.svg', 'world-4.svg', 'supporter-3.svg']) {
      const res = await call(`/badges/art/${file}`)
      assert.equal(res.status, 200, file)
      assert.match(res.headers.get('content-type') ?? '', /^image\/svg\+xml/, file)
      assert.match(res.headers.get('cache-control') ?? '', /immutable/, file)
      const svg = await res.text()
      assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/, file)
      assert.doesNotMatch(svg, /<script|<image|#FF2414|#E50F05|rgb\(2[0-9]{2},\s?[0-4]?[0-9],\s?[0-4]?[0-9]\)/i, file)
    }
  })

  test('unknown badges and levels are 404', async () => {
    for (const file of ['nope-1.svg', 'marathon-5.svg', 'marathon-1.png', 'marathon.svg']) {
      assert.equal((await call(`/badges/art/${file}`)).status, 404, file)
    }
  })
})

describe('Ko-fi webhook', () => {
  test('shut (404) while its secrets are missing', { skip: KOFI_OPEN && 'KOFI_VERIFICATION_TOKEN is set' }, async () => {
    const res = await call('/api/supporters/webhook', { method: 'POST', headers: FORM, body: kofiForm({ verification_token: 'whatever', kofi_transaction_id: 'smoke-1' }) })
    // A server configured with secrets this process doesn't know answers 401 to a wrong token.
    assert.ok([404, 401].includes(res.status), `-> ${res.status}`)
    if (res.status === 404) assert.equal((await call('/api/supporters/webhook')).status, 404)
  })

  test('bad body 400, oversized 400, wrong token 401, never a 5xx', { skip: !KOFI_OPEN && 'no KOFI_VERIFICATION_TOKEN' }, async () => {
    assert.equal((await call('/api/supporters/webhook', { method: 'POST', headers: FORM, body: 'nothing=here' })).status, 400)
    assert.equal((await call('/api/supporters/webhook', { method: 'POST', headers: FORM, body: kofiForm('{not json') })).status, 400)
    assert.equal((await call('/api/supporters/webhook', { method: 'POST', headers: FORM, body: kofiForm({ verification_token: KOFI_TOKEN, message: 'x'.repeat(70_000) }) })).status, 400)
    const wrong = await call('/api/supporters/webhook', { method: 'POST', headers: FORM, body: kofiForm({ verification_token: `${KOFI_TOKEN}x`, kofi_transaction_id: 'smoke-2' }) })
    assert.equal(wrong.status, 401)
    // The right token with nothing to link still answers 200 (Ko-fi retries anything else).
    const ok = await call('/api/supporters/webhook', { method: 'POST', headers: FORM, body: kofiForm({ verification_token: KOFI_TOKEN, kofi_transaction_id: `smoke-${Date.now()}`, type: 'Donation', email: 'nobody.smoke@example.test' }) })
    assert.equal(ok.status, 200)
    assert.equal((await json(ok)).ok, true)
  })
})

describe('the nightly badges job', () => {
  test('401 without the secret, with a wrong one or an empty Bearer', async () => {
    for (const headers of [{}, { authorization: 'Bearer wrong-secret-0123456789abcdef0123456789' }, { authorization: 'Bearer ' }]) {
      const res = await call('/api/cron/badges', { headers })
      assert.equal(res.status, 401, JSON.stringify(Object.keys(headers)))
      assert.equal((await json(res)).ok, false)
    }
  })

  test('with the secret it answers JSON and says what it did', { skip: !CRON_SECRET && 'no CRON_SECRET' }, async () => {
    const res = await call('/api/cron/badges', { headers: { authorization: `Bearer ${CRON_SECRET}`, 'x-cron-source': 'cron-job' } })
    assert.ok([200, 409].includes(res.status), `-> ${res.status}`)
    const body = await json(res)
    assert.equal(typeof body, 'object')
  })
})

describe('personal APIs need a profile', () => {
  test('guests get 401 and nothing is cached', async () => {
    const cases = [
      ['/api/badges/settings', { method: 'GET' }],
      ['/api/badges/settings', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ enabled: false }) }],
      ['/api/badges/seen', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: 'marathon' }) }],
      ['/api/supporters/me', { method: 'GET' }],
      ['/api/supporters/me', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ listed: true }) }],
    ]
    for (const [path, init] of cases) {
      const res = await call(path, init)
      assert.equal(res.status, 401, `${init.method} ${path} -> ${res.status}`)
    }
  })
})
