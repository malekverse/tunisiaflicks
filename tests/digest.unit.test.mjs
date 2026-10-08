// Unit tests for the scheduling lib and the weekly digest (npm run test:unit).
// The database tests (lease, deliveries) run when MONGODB_URI is set (CI starts a MongoDB);
// they use their own collections' documents and clean up after themselves.
import { after, describe, test } from 'node:test'
import assert from 'node:assert/strict'

const HAS_DB = !!process.env.MONGODB_URI
const SECRET = 'unit-test-cron-secret-0123456789abcdef'
const EXTRA = 'unit-test-extra-secret-0123456789abcdef-cron-job'
const SHORT_EXTRA = 'short-extra-secret'

process.env.CRON_SECRET = SECRET
process.env.CRON_SECRETS_EXTRA = ` ${SHORT_EXTRA} , ${EXTRA} `

const cron = await import('@/src/lib/cron')

const request = (headers = {}) => new Request('http://localhost/api/cron/test', { headers })

after(async () => {
  if (HAS_DB) await (await (await import('@/src/lib/mongodb')).default).close()
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
