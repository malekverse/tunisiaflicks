// Smoke tests for Ask (AI search) against a running server (BASE_URL, default :3000).
//
// The server decides whether Ask exists (GROQ_API_KEY, AI_SEARCH_OFF): the first request finds out.
// - Ask off: POST /api/ai/search is a 404, and neither home nor /search offers Ask.
// - Ask on: bad bodies, crafted plans and other sites are refused; a valid plan streams its plan
//   then its titles; TV mode gets no Ask; the per-minute cap answers 429.
// - With the server's database (MONGODB_URI, local only unless CI) and NEXTAUTH_SECRET in this
//   process too: with today's model budget spent, the simple parser answers (and a repeat comes
//   from the cache); a Kids profile gets no Ask; a real question is answered and then cached.
//   Everything seeded is removed afterwards, and the budget is put back as it was.
import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash, randomBytes } from 'node:crypto'
import { normalizeQuery } from '@/src/lib/ai-search/normalize'
import { PROMPT_VERSION } from '@/src/lib/ai-search/config'

const BASE = (process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
const MONGODB_URI = process.env.MONGODB_URI?.trim() || ''
const LOCAL_DB = /^mongodb:\/\/(127\.0\.0\.1|localhost)[:/]/.test(MONGODB_URI)
const CAN_SEED = !!MONGODB_URI && (process.env.NEXTAUTH_SECRET?.trim().length ?? 0) > 0 && (LOCAL_DB || !!process.env.CI)
const hasTmdb = !!process.env.TMDB_API_KEY

const guestId = () => randomBytes(16).toString('hex')

/** POST /api/ai/search as this site's own page would (JSON, same origin), unless told otherwise. */
const ask = (body, headers = {}) => fetch(`${BASE}/api/ai/search`, {
  method: 'POST',
  redirect: 'manual',
  headers: { 'content-type': 'application/json', origin: BASE, cookie: `tf-gid=${guestId()}; tf-locale=en`, ...headers },
  body: typeof body === 'string' ? body : JSON.stringify(body),
})

const page = (path, cookie = 'tf-locale=en') => fetch(BASE + path, { redirect: 'manual', headers: { cookie } })

/** The NDJSON lines of an answer. */
async function events(res) {
  const text = await res.text()
  return text.split('\n').filter((line) => line.trim()).map((line) => {
    try {
      return JSON.parse(line)
    } catch {
      return assert.fail(`not NDJSON (${res.status}): ${text.slice(0, 160)}`)
    }
  })
}

async function json(res) {
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    return assert.fail(`not JSON (${res.status}): ${text.slice(0, 160)}`)
  }
}

/** The answer's cache key, as src/lib/ai-search/cache.ts makes it. */
const cacheKey = (q) => createHash('sha256').update(`${PROMPT_VERSION}|${new Date().getUTCFullYear()}|${normalizeQuery(q)}`).digest('hex')

// Ask is on when the server answers a valid plan with anything but a 404.
const enabled = (await ask({ plan: 'k:m~g:comedy' }).then((res) => res.body?.cancel().then(() => res.status)).catch(() => 0)) !== 404

describe('Ask off (no GROQ_API_KEY, or AI_SEARCH_OFF=1)', { skip: enabled && 'Ask is on on this server' }, () => {
  test('the route does not exist', async () => {
    for (const body of [{ q: 'funny films from the 90s' }, { plan: 'k:m~g:comedy' }, 'nonsense']) {
      assert.equal((await ask(body)).status, 404)
    }
  })

  test('no Ask chip at home, no Titles | Ask switch on /search', async () => {
    assert.doesNotMatch(await (await page('/')).text(), /data-ask-chip/)
    const search = await page('/search?mode=ask&q=funny%20films')
    assert.equal(search.status, 200)
    assert.doesNotMatch(await search.text(), /data-ask-switch/)
  })
})

describe('Ask on', { skip: !enabled && 'Ask is off on this server' }, () => {
  test('bad bodies are 400, other content types 415', async () => {
    for (const body of ['{', '[]', '"text"', '{"q":"x","extra":1}', '{"q":42}', '{"q":"x","page":9}', '{"q":"x","page":0}', '{}', '{"q":"   "}', `{"q":"${'x'.repeat(400)}"}`]) {
      const res = await ask(body)
      assert.equal(res.status, 400, body.slice(0, 40))
      assert.ok(['bad_body', 'empty'].includes((await json(res)).code), body.slice(0, 40))
    }
    const plain = await ask('{"q":"funny films"}', { 'content-type': 'text/plain' })
    assert.equal(plain.status, 415)
  })

  test('crafted plans are 400', async () => {
    const crafted = [
      'k:m~g:nope', 'k:m~g:comedy.drama.horror.war', 'k:m~y:1800-1900', 'k:m~y:2000-1990', 'k:m~mr:9.5', 'k:m~g:comedy~x:comedy',
      'k:m~c:ZZ', 'k:m~lg:qq', 'g:comedy', 'k:m~s:rel', 'k:m~kw:1;drop',
    ]
    if (hasTmdb) crafted.push('k:m~kw:999999999', 'k:m~p:999999999', 'k:m~lk:m999999999')
    for (const plan of crafted) {
      const res = await ask({ plan })
      assert.equal(res.status, 400, plan)
      assert.equal((await json(res)).code, 'bad_plan', plan)
    }
  })

  test('other sites are 403, and so is a request without an Origin', async () => {
    assert.equal((await ask({ q: 'funny films' }, { origin: 'https://evil.example' })).status, 403)
    assert.equal((await ask({ q: 'funny films' }, { origin: 'null' })).status, 403)
    const res = await fetch(`${BASE}/api/ai/search`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"q":"funny films"}' })
    assert.equal(res.status, 403)
    assert.equal((await json(res)).code, 'cross_origin')
  })

  test('a valid plan streams its plan, then its titles', async () => {
    const res = await ask({ plan: 'k:m~g:comedy~y:1990-1999~s:top' })
    assert.equal(res.status, 200)
    assert.match(res.headers.get('content-type') ?? '', /application\/x-ndjson/)
    assert.match(res.headers.get('cache-control') ?? '', /no-store/)
    const [plan, results, ...rest] = await events(res)
    assert.equal(rest.length, 0)
    assert.equal(plan.t, 'plan')
    assert.equal(plan.p, 'k:m~g:comedy~y:1990-1999~s:top')
    assert.equal(plan.src, 'plan', 'a plan sent back never reaches the model')
    assert.deepEqual(plan.chips, [
      { id: 'k', label: 'Films' }, { id: 'g:comedy', label: 'Comedy' }, { id: 'y', label: '1990s' }, { id: 's', label: 'Best rated' },
    ])
    if (results.t === 'error') {
      assert.equal(results.code, 'tmdb', 'only the catalogue may fail here')
      return
    }
    assert.equal(results.t, 'results')
    assert.equal(results.page, 1)
    assert.ok(results.items.length > 0 && results.items.length <= 40)
    for (const item of results.items) {
      assert.equal(item.media_type, 'movie')
      assert.ok(item.poster_path, 'titles without a poster are left out')
    }
    // Full matches come first; relaxed ones (if any) only fill the end.
    const full = (item) => item.genre_ids.includes(35) && /^199\d/.test(item.release_date ?? '')
    assert.ok(full(results.items[0]), 'the best match is a 90s comedy')
    assert.ok(results.items.filter(full).length >= results.items.length * 0.6, 'mostly 90s comedies')
  })

  test('labels follow the interface language', async () => {
    const res = await ask({ plan: 'k:t~g:comedy~y:1990-1999' }, { cookie: `tf-gid=${guestId()}; tf-locale=ar` })
    const [plan] = await events(res)
    assert.deepEqual(plan.chips.map((chip) => chip.label), ['مسلسلات', 'كوميديا', 'التسعينات'])
  })

  test('a guest gets a first-party id cookie, httpOnly', async () => {
    const res = await fetch(`${BASE}/api/ai/search`, { method: 'POST', headers: { 'content-type': 'application/json', origin: BASE }, body: '{"plan":"k:m~g:comedy"}' })
    const cookie = res.headers.get('set-cookie') ?? ''
    await res.body?.cancel()
    assert.match(cookie, /tf-gid=[0-9a-f]{32}/)
    assert.match(cookie, /HttpOnly/i)
    assert.match(cookie, /SameSite=lax/i)
  })

  test('TV mode gets no Ask: the route, the home chip, the search switch', async () => {
    const res = await ask({ plan: 'k:m~g:comedy' }, { cookie: `tf-gid=${guestId()}; tf-tv=1` })
    assert.equal(res.status, 403)
    assert.equal((await json(res)).code, 'tv_mode')
    assert.doesNotMatch(await (await page('/', 'tf-tv=1; tf-locale=en')).text(), /data-ask-chip/)
    assert.doesNotMatch(await (await page('/search?mode=ask&q=funny', 'tf-tv=1; tf-locale=en')).text(), /data-ask-switch/)
  })

  test('grown-ups outside TV mode get the home chip and the switch; title search still renders', async () => {
    assert.match(await (await page('/')).text(), /data-ask-chip/)
    const askPage = await page('/search?mode=ask&q=funny%20films')
    assert.match(await askPage.text(), /data-ask-switch/)
    const titles = await page('/search?q=inception')
    assert.equal(titles.status, 200)
    assert.match(await titles.text(), /value="inception"/)
  })

  test('the per-minute cap answers 429 with when to come back', async () => {
    // A bare title: answered without the model (and cached after the first time).
    const cookie = `tf-gid=${guestId()}; tf-locale=en`
    let refused = null
    for (let index = 0; index < 14 && !refused; index++) {
      const res = await ask({ q: 'inception' }, { cookie })
      if (res.status === 429) refused = res
      else {
        assert.equal(res.status, 200)
        await res.body?.cancel()
      }
    }
    assert.ok(refused, 'refused within the minute')
    const body = await json(refused)
    assert.equal(body.code, 'rate_minute')
    assert.ok(body.retryAfter >= 1 && body.retryAfter <= 60)
    assert.equal(body.signIn, false)
    assert.equal(refused.headers.get('retry-after'), String(body.retryAfter))
  })
})

describe('Ask on, with the database', { skip: (!enabled && 'Ask is off') || (!CAN_SEED && 'needs MONGODB_URI (local) and NEXTAUTH_SECRET') }, () => {
  let client
  let db
  const stamp = randomBytes(6).toString('hex')
  const hex = (n) => `${stamp}${String(n).padStart(12, '0')}`
  const person = { user: hex(1), profile: hex(101), kids: hex(102), email: `ai-${stamp}@example.test` }
  let session = ''
  const as = (profile) => ({ cookie: `next-auth.session-token=${session}; tf_profile=${profile}; tf-locale=en` })
  const budgetId = () => `budget:${new Date().toISOString().slice(0, 10)}`
  let budget = null

  before(async () => {
    const { MongoClient, ObjectId } = await import('mongodb')
    const { encode } = await import('next-auth/jwt')
    client = await new MongoClient(MONGODB_URI).connect()
    db = client.db()
    const now = new Date()
    await db.collection('users').insertOne({
      _id: new ObjectId(person.user), email: person.email, name: 'Ask smoke', emailVerified: now,
      profiles: [
        { id: person.profile, name: 'Grown-up', color: '#3B82F6', kids: false, createdAt: now },
        { id: person.kids, name: 'Kid', color: '#2BB673', kids: true, createdAt: now },
      ],
    })
    session = await encode({
      token: { id: person.user, sub: person.user, email: person.email, name: 'Ask smoke', loginAt: now.getTime() },
      secret: process.env.NEXTAUTH_SECRET,
      maxAge: 3600,
    })
    budget = await db.collection('aiState').findOne({ _id: budgetId() })
  })

  after(async () => {
    if (!db) return
    const { ObjectId } = await import('mongodb')
    await db.collection('users').deleteOne({ _id: new ObjectId(person.user) })
    // Today's budget as it was (calls made meanwhile by others are lost, which is fine locally).
    if (budget) await db.collection('aiState').replaceOne({ _id: budget._id }, budget, { upsert: true })
    else await db.collection('aiState').deleteOne({ _id: budgetId() })
    await client.close()
  })

  test('a Kids profile gets no Ask: the route, the home chip, the search switch', async () => {
    const res = await ask({ plan: 'k:m~g:comedy' }, as(person.kids))
    assert.equal(res.status, 403)
    assert.equal((await json(res)).code, 'kids')
    assert.doesNotMatch(await (await page('/', as(person.kids).cookie)).text(), /data-ask-chip/)
    assert.doesNotMatch(await (await page('/search?mode=ask&q=funny', as(person.kids).cookie)).text(), /data-ask-switch/)
    // The grown-up profile of the same account may ask.
    const grownUp = await ask({ plan: 'k:m~g:comedy' }, as(person.profile))
    assert.equal(grownUp.status, 200)
    await grownUp.body?.cancel()
  })

  test('with the day\'s model budget spent, the simple parser answers, and a repeat comes from the cache', async () => {
    const q = 'funny korean films from the 90s'
    await db.collection('aiSearchCache').deleteOne({ _id: cacheKey(q) })
    await db.collection('aiState').updateOne(
      { _id: budgetId() },
      { $set: { calls: 1_000_000_000, guestCalls: 1_000_000_000, expiresAt: new Date(Date.now() + 2 * 86400000) } },
      { upsert: true },
    )
    const first = await events(await ask({ q }))
    assert.equal(first[0].t, 'plan', JSON.stringify(first[0]))
    assert.equal(first[0].src, 'parser')
    assert.equal(first[0].ai, false, 'no AI mark on simple matching')
    assert.ok(first[0].notices.some((notice) => notice.code === 'resting'), 'says Ask is resting')
    assert.equal(first[0].p, 'k:m~g:comedy~c:KR~y:1990-1999')
    const again = await events(await ask({ q }))
    assert.equal(again[0].src, 'cache')
    assert.equal(again[0].p, first[0].p)
    assert.ok(again[0].notices.some((notice) => notice.code === 'resting'))
    if (budget) await db.collection('aiState').replaceOne({ _id: budget._id }, budget)
    else await db.collection('aiState').deleteOne({ _id: budgetId() })
  })

  test('a real question is answered, then comes from the cache', async () => {
    const q = 'a tense korean thriller about revenge'
    await db.collection('aiSearchCache').deleteOne({ _id: cacheKey(q) })
    const first = await events(await ask({ q }))
    assert.equal(first[0].t, 'plan', JSON.stringify(first[0]))
    assert.ok(['model', 'parser'].includes(first[0].src), first[0].src)
    assert.ok(first[0].chips.some((chip) => chip.id === 'c:KR'), JSON.stringify(first[0].chips))
    assert.ok(first[0].chips.every((chip) => typeof chip.label === 'string' && chip.label.length > 0))
    const again = await events(await ask({ q }))
    assert.equal(again[0].src, 'cache')
    assert.equal(again[0].p, first[0].p)
    assert.equal(again[0].ai, first[0].ai)
  })
})
