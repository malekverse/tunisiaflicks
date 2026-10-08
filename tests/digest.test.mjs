// Smoke tests for scheduling and the weekly digest against a running server (BASE_URL, default
// :3000): the cron routes refuse callers without the secret and answer JSON with it, the digest
// APIs need a signed-in grown-up profile, and the unsubscribe link (page and one-click POST) works
// without JavaScript, never acts on a GET and never rate-limits a valid link.
//
// The signed-link tests need the server's EMAIL_TOKEN_SECRET and database (MONGODB_URI) in this
// process too (CI sets both for the whole job); they seed one profile of their own and remove it.
import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'

const BASE = (process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
const CRON_SECRET = process.env.CRON_SECRET?.trim() || ''
const CAN_SIGN = (process.env.EMAIL_TOKEN_SECRET?.trim().length ?? 0) >= 16 && !!process.env.MONGODB_URI

const call = (path, init = {}) => fetch(BASE + path, { redirect: 'manual', ...init })

async function json(res) {
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    assert.fail(`not JSON (${res.status}): ${text.slice(0, 160)}`)
  }
}

describe('cron routes', () => {
  test('no secret, a wrong one or an empty Bearer: 401, and nothing runs', async () => {
    for (const path of ['/api/cron/digest', '/api/cron/notify']) {
      for (const headers of [{}, { authorization: 'Bearer wrong-secret-0123456789abcdef0123456789' }, { authorization: 'Bearer ' }, { authorization: CRON_SECRET || 'x' }]) {
        const res = await call(path, { headers })
        assert.equal(res.status, 401, `${path} with ${JSON.stringify(Object.keys(headers))}`)
        const body = await json(res)
        assert.equal(body.ok, false)
        assert.match(res.headers.get('cache-control') ?? '', /no-store/)
      }
    }
  })

  test('with the secret, the digest job answers 200 and says what it did', { skip: !CRON_SECRET && 'no CRON_SECRET' }, async () => {
    const res = await call('/api/cron/digest', { headers: { authorization: `Bearer ${CRON_SECRET}`, 'x-cron-source': 'cron-job' } })
    assert.equal(res.status, 200)
    const body = await json(res)
    assert.equal(body.ok, true)
    assert.equal(body.job, 'digest')
    // idle outside Friday 17:00 + 3 days (or without mail set up); done / more inside; busy if a run holds the lease.
    assert.ok(['idle', 'done', 'more', 'busy', 'quota'].includes(body.status), body.status)
    assert.equal(typeof body.more, 'boolean')
    assert.equal(typeof body.ms, 'number')
    assert.ok(body.ms < 30_000, 'a cron-job.org call stays inside its 30s')
  })
})

describe('digest APIs need a signed-in profile', () => {
  test('signed out: settings, preview and test send are 401', async () => {
    assert.equal((await call('/api/digest')).status, 401)
    const put = await call('/api/digest', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ enabled: true }) })
    assert.equal(put.status, 401)
    assert.equal((await call('/api/digest/preview')).status, 401)
    const send = await call('/api/digest/test', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
    assert.equal(send.status, 401)
  })
})

describe('unsubscribe: bad links', () => {
  test('GET /api/unsubscribe only sends you to the page (303), with no referrer', async () => {
    const res = await call('/api/unsubscribe?t=v1.abc.def')
    assert.equal(res.status, 303)
    const location = new URL(res.headers.get('location'), BASE)
    assert.equal(location.pathname, '/unsubscribe')
    assert.equal(location.searchParams.get('t'), 'v1.abc.def')
    assert.equal(res.headers.get('referrer-policy'), 'no-referrer')
  })

  test('a one-click POST with a broken link is 400 (or 429 once this IP has tried too often)', async () => {
    const res = await call('/api/unsubscribe?t=v1.bm90LWEtcHJvZmlsZQ.AAAAAAAAAAAAAAAAAAAAAA', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'List-Unsubscribe=One-Click',
    })
    assert.ok([400, 429].includes(res.status), String(res.status))
    assert.equal((await json(res)).ok, false)
  })

  test('the page explains a broken link, unindexed, without a form that could act on it', async () => {
    const res = await call('/unsubscribe?t=not-a-token')
    assert.equal(res.status, 200)
    assert.equal(res.headers.get('referrer-policy'), 'no-referrer')
    const html = await res.text()
    assert.match(html, /<meta name="robots" content="noindex/)
    assert.doesNotMatch(html, /action="\/api\/unsubscribe"/)
    assert.match(html, /href="\/profile#email"/)
  })
})

describe('unsubscribe: a signed link', { skip: !CAN_SIGN && 'needs EMAIL_TOKEN_SECRET and MONGODB_URI' }, () => {
  let client
  let db
  let token
  const suffix = Date.now().toString(16).padStart(12, '0').slice(-12)
  const profileId = `5e7e57${suffix}abcdef`.slice(0, 24)
  const userHex = `5e7e57${suffix}fedcba`.slice(0, 24)
  const email = `digest.smoke.${suffix}@example.test`

  const pref = () => db.collection('digestPrefs').findOne({ _id: profileId })
  const form = (fields) => new URLSearchParams(fields).toString()
  const post = (body, query = '') => call(`/api/unsubscribe${query}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  })

  before(async () => {
    const { MongoClient, ObjectId } = await import('mongodb')
    const { unsubscribeToken } = await import('@/src/lib/digest/token')
    token = unsubscribeToken(profileId)
    client = await new MongoClient(process.env.MONGODB_URI).connect()
    db = client.db()
    await db.collection('users').insertOne({
      _id: new ObjectId(userHex), name: 'Digest smoke', email, emailVerified: new Date(),
      profiles: [{ id: profileId, name: 'Smoke', color: '#888888', kids: false }],
    })
    await db.collection('digestPrefs').insertOne({ _id: profileId, userId: userHex, enabled: true, locale: 'en', created_at: new Date(), updated_at: new Date(), hard_bounces: 0 })
  })

  after(async () => {
    if (!db) return
    const { ObjectId } = await import('mongodb')
    await db.collection('digestPrefs').deleteOne({ _id: profileId })
    await db.collection('users').deleteOne({ _id: new ObjectId(userHex) })
    await client.close()
  })

  test('opening the link asks first: a GET never unsubscribes, and the address is masked', async () => {
    const page = await call(`/unsubscribe?t=${encodeURIComponent(token)}`)
    assert.equal(page.status, 200)
    const html = await page.text()
    // A plain form posting the token: works without JavaScript (React orders the attributes its own way).
    const forms = html.match(/<form[^>]*>/g) ?? []
    assert.ok(forms.some((tag) => /\smethod="post"/i.test(tag) && /\saction="\/api\/unsubscribe"/.test(tag)), forms.join('\n') || 'no <form>')
    assert.match(html, /name="t" value="[^"]+"/)
    assert.match(html, /name="do" value="off"/)
    assert.ok(!html.includes(email), 'the full address never shows')
    assert.ok(html.includes(`d•••@example.test`), 'the masked address does')

    const redirect = await call(`/api/unsubscribe?t=${encodeURIComponent(token)}`)
    assert.equal(redirect.status, 303)
    assert.equal((await pref()).enabled, true, 'still on after two GETs')
  })

  test('100 one-click POSTs from one address all succeed, and it ends up off', async () => {
    const results = await Promise.all(Array.from({ length: 100 }, () => post('List-Unsubscribe=One-Click', `?t=${encodeURIComponent(token)}`)))
    const statuses = results.map((res) => res.status)
    assert.deepEqual([...new Set(statuses)], [200], `statuses: ${[...new Set(statuses)].join(', ')}`)
    for (const res of results.slice(0, 3)) assert.equal((await json(res)).ok, true)
    const after = await pref()
    assert.equal(after.enabled, false)
    assert.ok(after.unsubscribed_at instanceof Date)
  })

  test('the page offers to undo it, and Undo turns it back on (303 back to the page)', async () => {
    const page = await (await call(`/unsubscribe?t=${encodeURIComponent(token)}&s=done`)).text()
    assert.match(page, /name="do" value="on"/)
    const undo = await post(form({ t: token, do: 'on' }))
    assert.equal(undo.status, 303)
    const location = new URL(undo.headers.get('location'), BASE)
    assert.equal(location.pathname, '/unsubscribe')
    assert.equal(location.searchParams.get('s'), 'on')
    assert.equal((await pref()).enabled, true)
  })

  test('the page form unsubscribes too, idempotently', async () => {
    for (let i = 0; i < 2; i++) {
      const res = await post(form({ t: token, do: 'off' }))
      assert.equal(res.status, 303)
      assert.equal(new URL(res.headers.get('location'), BASE).searchParams.get('s'), 'done')
    }
    assert.equal((await pref()).enabled, false)
  })
})
