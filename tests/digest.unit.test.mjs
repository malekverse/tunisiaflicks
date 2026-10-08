// Unit tests for the scheduling lib, the mail budget, release alerts and the weekly digest
// (npm run test:unit). The database tests run when MONGODB_URI is set (CI starts a MongoDB), in a
// database of their own that is dropped at the end.
import { after, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'

// A few app modules (src/lib/tmdb.ts) use a TypeScript parameter property, which Node's type
// stripping can't load: those files go through Node's own TypeScript transform instead.
const TRANSFORM_HOOK = String.raw`
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { stripTypeScriptTypes } from 'node:module'
const PARAMETER_PROPERTY = /constructor\s*\([^)]*\b(public|private|protected|readonly)\s/
export async function load(url, context, nextLoad) {
  if (url.startsWith('file:') && url.endsWith('.ts')) {
    const source = await readFile(fileURLToPath(url), 'utf8')
    if (PARAMETER_PROPERTY.test(source)) {
      return { format: 'module', source: stripTypeScriptTypes(source, { mode: 'transform' }), shortCircuit: true }
    }
  }
  return nextLoad(url, context)
}`
register(`data:text/javascript,${encodeURIComponent(TRANSFORM_HOOK)}`)

const HAS_DB = !!process.env.MONGODB_URI
if (HAS_DB) {
  const url = new URL(process.env.MONGODB_URI)
  url.pathname = `/tf_unit_digest_${process.pid}`
  process.env.MONGODB_URI = url.toString()
}
const SECRET = 'unit-test-cron-secret-0123456789abcdef'
const EXTRA = 'unit-test-extra-secret-0123456789abcdef-cron-job'
const SHORT_EXTRA = 'short-extra-secret'

process.env.CRON_SECRET = SECRET
process.env.CRON_SECRETS_EXTRA = ` ${SHORT_EXTRA} , ${EXTRA} `

const cron = await import('@/src/lib/cron')

const request = (headers = {}) => new Request('http://localhost/api/cron/test', { headers })

after(async () => {
  if (!HAS_DB) return
  const client = await (await import('@/src/lib/mongodb')).default
  await client.db().dropDatabase()
  await client.close()
})

describe('cron: who may call', () => {
  test('missing, wrong or short secret is refused', () => {
    assert.equal(cron.isCronAuthorized(request()), false)
    assert.equal(cron.isCronAuthorized(request({ authorization: 'Bearer nope' })), false)
    assert.equal(cron.isCronAuthorized(request({ authorization: SECRET })), false, 'no Bearer prefix')
    assert.equal(cron.isCronAuthorized(request({ authorization: `Bearer ${SECRET.slice(0, -1)}` })), false, 'a prefix of the secret')
    assert.equal(cron.isCronAuthorized(request({ authorization: `Bearer ${SECRET}x` })), false)
    assert.equal(cron.isCronAuthorized(request({ authorization: `Bearer ${SHORT_EXTRA}` })), false, 'extra secrets under 32 chars are ignored')
    assert.equal(cron.isCronAuthorized(request({ authorization: 'Bearer ' })), false)
  })

  test('CRON_SECRET and a long extra secret are accepted', () => {
    assert.equal(cron.isCronAuthorized(request({ authorization: `Bearer ${SECRET}` })), true)
    assert.equal(cron.isCronAuthorized(request({ authorization: `Bearer ${EXTRA}` })), true)
  })

  test('with no secret configured nothing is authorized', () => {
    const saved = [process.env.CRON_SECRET, process.env.CRON_SECRETS_EXTRA]
    delete process.env.CRON_SECRET
    delete process.env.CRON_SECRETS_EXTRA
    try {
      assert.equal(cron.isCronAuthorized(request({ authorization: 'Bearer ' })), false)
      assert.equal(cron.isCronAuthorized(request({ authorization: `Bearer ${SECRET}` })), false)
    } finally {
      ;[process.env.CRON_SECRET, process.env.CRON_SECRETS_EXTRA] = saved
    }
  })

  test('runCron answers 401 before touching anything', async () => {
    let ran = false
    const res = await cron.runCron(request({ authorization: 'Bearer wrong' }), 'unit-401', async () => { ran = true; return {} })
    assert.equal(res.status, 401)
    assert.equal(ran, false)
    assert.equal((await res.json()).ok, false)
  })
})

describe('cron: time budgets', () => {
  const budget = (source) => cron.cronDeadline(source) - Date.now()
  test('cron-job.org (and anything unknown) gets 22s', () => {
    assert.ok(Math.abs(budget('cron-job') - 22_000) < 50)
    assert.ok(Math.abs(budget('unknown') - 22_000) < 50)
    assert.ok(Math.abs(budget('') - 22_000) < 50)
  })
  test('GitHub and Vercel cron get 45s', () => {
    assert.ok(Math.abs(budget('github') - 45_000) < 50)
    assert.ok(Math.abs(budget('vercel') - 45_000) < 50)
    assert.ok(Math.abs(budget('vercel-cron/1.0') - 45_000) < 50)
  })
  test('the source comes from X-Cron-Source, or the Vercel cron user agent', () => {
    assert.equal(cron.cronSource(request({ 'x-cron-source': 'cron-job' })), 'cron-job')
    assert.equal(cron.cronSource(request({ 'x-cron-source': 'GitHub' })), 'github')
    assert.equal(cron.cronSource(request({ 'user-agent': 'vercel-cron/1.0' })), 'vercel')
    assert.equal(cron.cronSource(request({ 'x-cron-source': 'not a valid source!' })), 'unknown')
    assert.equal(cron.cronSource(request()), 'unknown')
  })
})

describe('cron: lease and answers', { skip: !HAS_DB && 'no MONGODB_URI' }, () => {
  const auth = (source) => request({ authorization: `Bearer ${EXTRA}`, ...(source ? { 'x-cron-source': source } : {}) })
  const name = `unit-${process.pid}-${Date.now()}`

  after(async () => {
    const db = (await (await import('@/src/lib/mongodb')).default).db()
    await db.collection('jobs').deleteMany({ _id: { $regex: `^cron:${name}` } })
    await db.collection('cronRuns').deleteMany({ job: { $regex: `^${name}` } })
  })

  test('done, with the stats and a 22s deadline for cron-job.org', async () => {
    let budget = 0
    const res = await cron.runCron(auth('cron-job'), name, async (ctx) => {
      budget = ctx.deadline - Date.now()
      assert.equal(ctx.source, 'cron-job')
      return { sent: 3, more: false }
    })
    assert.equal(res.status, 200)
    const body = await res.json()
    assert.equal(body.ok, true)
    assert.equal(body.status, 'done')
    assert.equal(body.more, false)
    assert.equal(body.sent, 3)
    assert.ok(budget > 21_000 && budget <= 22_000, `budget ${budget}`)
  })

  test('more, idle and quota are passed through', async () => {
    const more = await (await cron.runCron(auth('github'), name, async () => ({ more: true }))).json()
    assert.equal(more.status, 'more')
    assert.equal(more.more, true)
    const idle = await (await cron.runCron(auth(), name, async () => ({ status: 'idle' }))).json()
    assert.equal(idle.status, 'idle')
  })

  test('a second run while the first holds the lease is busy, and answers 200', async () => {
    let release
    const holding = new Promise((resolve) => { release = resolve })
    const first = cron.runCron(auth('github'), `${name}-busy`, async () => { await holding; return { n: 1 } })
    // Let the first run take the lease.
    await new Promise((resolve) => setTimeout(resolve, 150))
    const second = await cron.runCron(auth('github'), `${name}-busy`, async () => { throw new Error('must not run') })
    assert.equal(second.status, 200)
    assert.equal((await second.json()).status, 'busy')
    release()
    assert.equal((await (await first).json()).status, 'done')
    // Released: the next run gets it.
    const third = await (await cron.runCron(auth('github'), `${name}-busy`, async () => ({}))).json()
    assert.equal(third.status, 'done')
  })

  test('a failing job answers 500 and frees the lease', async () => {
    const original = console.error
    console.error = () => {}
    try {
      const res = await cron.runCron(auth(), `${name}-fail`, async () => { throw new Error('boom') })
      assert.equal(res.status, 500)
      assert.equal((await res.json()).ok, false)
    } finally {
      console.error = original
    }
    const again = await (await cron.runCron(auth(), `${name}-fail`, async () => ({}))).json()
    assert.equal(again.status, 'done')
  })

  test('withLease: busy while held, free once released', async () => {
    const key = `${name}-direct`
    const inner = await cron.withLease(key, 60_000, async () => cron.withLease(key, 60_000, async () => 'nested'))
    assert.equal(inner.busy, false)
    assert.deepEqual(inner.value, { busy: true })
    const later = await cron.withLease(key, 60_000, async () => 'ok')
    assert.deepEqual(later, { busy: false, value: 'ok' })
  })
})

describe('mail budget', { skip: !HAS_DB && 'no MONGODB_URI' }, () => {
  const today = () => `mail:day:${new Date().toISOString().slice(0, 10)}`
  const counters = async () => (await (await import('@/src/lib/mongodb')).default).db().collection('rateLimits')

  test('bulk stops at MAIL_DAILY_LIMIT - 70; account mail always goes and still counts', async () => {
    const { reserveMail } = await import('@/src/lib/email')
    process.env.MAIL_DAILY_LIMIT = '73'
    try {
      await (await counters()).deleteOne({ _id: today() })
      const bulk = []
      for (let i = 0; i < 5; i++) bulk.push(await reserveMail('bulk'))
      assert.deepEqual(bulk, [true, true, true, false, false])
      assert.equal(await reserveMail('transactional'), true)
      assert.equal(await reserveMail('bulk'), false)
      const doc = await (await counters()).findOne({ _id: today() })
      assert.equal(doc.count, 4, 'three bulk and one account mail')
      assert.ok(doc.expiresAt instanceof Date)
    } finally {
      delete process.env.MAIL_DAILY_LIMIT
      await (await counters()).deleteOne({ _id: today() })
    }
  })

  test('concurrent bulk reservations never pass the cap', async () => {
    const { reserveDailySlot } = await import('@/src/lib/email')
    const results = await Promise.all(Array.from({ length: 40 }, () => reserveDailySlot('unit-race', 7)))
    assert.equal(results.filter(Boolean).length, 7)
  })
})

describe('release alerts: the e-mail switch, the budget and Kids', { skip: !HAS_DB && 'no MONGODB_URI' }, () => {
  const db = async () => (await (await import('@/src/lib/mongodb')).default).db()
  process.env.FROM_EMAIL ??= 'alerts@example.test'
  process.env.NEXT_PUBLIC_APP_URL ??= 'http://localhost:3000'

  const seed = async (emailPrefs) => {
    const { ObjectId } = await import('mongodb')
    const d = await db()
    const _id = new ObjectId()
    await d.collection('users').insertOne({ _id, email: `${_id}@example.test`, name: 'Unit', ...(emailPrefs ? { emailPrefs } : {}) })
    await d.collection('notifications').insertOne({
      userId: String(_id), media_type: 'movie', tmdbId: '550', title: 'Fight Club', poster_path: null,
      kind: 'movie_released', event_key: `movie:550:released:${_id}`, episode: null,
      created_at: new Date(), read: false, email_status: 'pending', kidSafe: false,
    })
    return String(_id)
  }

  test('with release e-mails off: no e-mail, the bell keeps the alert', async () => {
    const { runReleaseAlerts } = await import('@/src/lib/release-alerts')
    const d = await db()
    await d.collection('notifications').deleteMany({})
    const userId = await seed({ releaseAlerts: false })
    const stats = await runReleaseAlerts({ deadline: Date.now() + 10_000 })
    assert.equal(stats.emailsSkipped, 1)
    assert.equal(stats.usersEmailed, 0)
    const doc = await d.collection('notifications').findOne({ userId })
    assert.equal(doc.email_status, 'sent')
    assert.equal(doc.emailed_at, null)
    assert.equal(doc.read, false, 'still in the bell')
  })

  test('once the bulk budget is spent, alerts wait for the next run; a password reset still goes', async () => {
    const { runReleaseAlerts } = await import('@/src/lib/release-alerts')
    const { reserveMail } = await import('@/src/lib/email')
    const d = await db()
    await d.collection('notifications').deleteMany({})
    const userId = await seed(null)
    process.env.MAIL_DAILY_LIMIT = '71'
    const key = `mail:day:${new Date().toISOString().slice(0, 10)}`
    await d.collection('rateLimits').updateOne({ _id: key }, { $set: { count: 1, expiresAt: new Date(Date.now() + 86400000) } }, { upsert: true })
    try {
      const stats = await runReleaseAlerts({ deadline: Date.now() + 10_000 })
      assert.equal(stats.emailsOverQuota, 1)
      assert.equal(stats.usersEmailed, 0)
      assert.equal(stats.emailsFailed, 0)
      const doc = await d.collection('notifications').findOne({ userId })
      assert.equal(doc.email_status, 'pending', 'left for the next run')
      assert.equal(doc.email_attempts ?? 0, 0, 'not counted as a failed attempt')
      assert.equal(await reserveMail('transactional'), true, 'account mail is never held back')
    } finally {
      delete process.env.MAIL_DAILY_LIMIT
      await d.collection('rateLimits').deleteOne({ _id: key })
    }
  })
})
