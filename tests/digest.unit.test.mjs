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
// Mail settings are read when lib/email loads: set them first (nothing is sent, the tests use fakes).
process.env.EMAIL_HOST ??= '127.0.0.1'
process.env.EMAIL_PORT ??= '2525'
process.env.EMAIL_USER ??= 'unit'
process.env.EMAIL_PASS ??= 'unit'
process.env.FROM_EMAIL ??= 'digest@example.test'
process.env.NEXT_PUBLIC_APP_URL ??= 'http://localhost:3000'
process.env.EMAIL_TOKEN_SECRET ??= 'unit-test-email-token-secret-0123456789'
delete process.env.DIGEST_ENABLED

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

  test('an adult title never reaches a device bound to a Kids profile', async () => {
    // Nothing leaves the machine: the push service call is replaced by a recorder.
    const webpush = (await import('web-push')).default
    const vapid = webpush.generateVAPIDKeys()
    const original = webpush.sendNotification
    const reached = []
    process.env.VAPID_PUBLIC_KEY = vapid.publicKey
    process.env.VAPID_PRIVATE_KEY = vapid.privateKey
    webpush.sendNotification = async (subscription) => {
      reached.push(subscription.endpoint)
      return { statusCode: 201 }
    }
    try {
      const { pushToUser, pushCollection } = await import('@/src/lib/push')
      const userId = 'unit-kids-push'
      const device = (name, kids) => ({
        _id: `unit-kids-push-${name}`, endpoint: `https://push.example.test/${name}`, keys: { p256dh: 'p', auth: 'a' },
        userId, profileId: `profile-${name}`, profileKids: kids, topics: ['alerts'], locale: 'en', created_at: new Date(),
      })
      const subscriptions = await pushCollection()
      await subscriptions.deleteMany({ userId })
      await subscriptions.insertMany([device('grown-up', false), device('kids', true)])
      const payload = () => ({ title: 'Out now', body: 'Fight Club', url: '/movie/550' })

      await pushToUser(userId, payload, 'alerts', { kidSafe: false })
      assert.deepEqual(reached, ['https://push.example.test/grown-up'], 'adult title: grown-up devices only')

      reached.length = 0
      await pushToUser(userId, payload, 'alerts', { kidSafe: true })
      assert.deepEqual(reached.sort(), ['https://push.example.test/grown-up', 'https://push.example.test/kids'], 'kid-safe title: every device')
      await subscriptions.deleteMany({ userId })
    } finally {
      webpush.sendNotification = original
      delete process.env.VAPID_PUBLIC_KEY
      delete process.env.VAPID_PRIVATE_KEY
    }
  })
})

// ---- The weekly digest ------------------------------------------------------------------------

describe('digest: the schedule', () => {
  test('opens Friday 17:00 Tunis time, for three days', async () => {
    const { editionFor, isOpen, nextEdition } = await import('@/src/lib/digest/schedule')
    // Tunis is UTC+1.
    const before = editionFor(new Date('2026-10-09T15:59:00Z'))
    assert.equal(before.id, '2026-10-02', 'Friday 16:59 still belongs to last week')
    assert.equal(isOpen(before, new Date('2026-10-09T15:59:00Z')), false)
    const open = editionFor(new Date('2026-10-09T16:00:00Z'))
    assert.equal(open.id, '2026-10-09')
    assert.equal(open.opensAt.toISOString(), '2026-10-09T16:00:00.000Z')
    assert.equal(open.closesAt.toISOString(), '2026-10-12T16:00:00.000Z')
    assert.equal(open.inRamadan, false)
    assert.equal(isOpen(open, new Date('2026-10-12T15:59:59Z')), true)
    assert.equal(isOpen(open, new Date('2026-10-12T16:00:00Z')), false)
    assert.equal(nextEdition(new Date('2026-10-08T10:00:00Z')).id, '2026-10-09', 'Thursday: this Friday')
    assert.equal(nextEdition(new Date('2026-10-09T16:00:00Z')).id, '2026-10-16', 'once open: next Friday')
  })

  test('during Ramadan it opens at 21:30, after iftar', async () => {
    const { editionOn, isRamadanDay } = await import('@/src/lib/digest/schedule')
    const { addDays } = await import('@/src/lib/hijri')
    // The first Friday inside Ramadan 1448 (early 2027).
    let friday = '2027-02-05'
    while (!isRamadanDay(friday)) friday = addDays(friday, 7)
    const edition = editionOn(friday)
    assert.equal(edition.inRamadan, true)
    assert.equal(edition.opensAt.toISOString(), `${friday}T20:30:00.000Z`)
  })
})

describe('digest: unsubscribe tokens', () => {
  const PROFILE = '65f0c0ffee0123456789abcd'

  test('a token names its profile, and only with the right key', async () => {
    const { unsubscribeToken, verifyUnsubscribeToken } = await import('@/src/lib/digest/token')
    const token = unsubscribeToken(PROFILE)
    assert.match(token, /^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{22}$/)
    assert.equal(verifyUnsubscribeToken(token), PROFILE)
    const [v, id, mac] = token.split('.')
    const flipped = mac.slice(0, -2) + (mac.at(-2) === 'A' ? 'B' : 'A') + mac.at(-1)
    assert.equal(verifyUnsubscribeToken(`${v}.${id}.${flipped}`), null, 'tampered signature')
    const other = Buffer.from('65f0c0ffee0123456789abce').toString('base64url')
    assert.equal(verifyUnsubscribeToken(`${v}.${other}.${mac}`), null, 'another profile')
    for (const bad of ['', 'v1..', `v2.${id}.${mac}`, `${token}.x`, null, 42, 'x'.repeat(500)]) assert.equal(verifyUnsubscribeToken(bad), null)
  })

  test('the previous key still works while a new one rolls out; no key, no links', async () => {
    const { unsubscribeToken, verifyUnsubscribeToken, emailTokensConfigured } = await import('@/src/lib/digest/token')
    const saved = [process.env.EMAIL_TOKEN_SECRET, process.env.EMAIL_TOKEN_SECRET_PREVIOUS]
    try {
      const old = unsubscribeToken(PROFILE)
      process.env.EMAIL_TOKEN_SECRET_PREVIOUS = saved[0]
      process.env.EMAIL_TOKEN_SECRET = 'a-brand-new-email-token-secret-987654321'
      assert.equal(verifyUnsubscribeToken(old), PROFILE)
      assert.notEqual(unsubscribeToken(PROFILE), old)
      delete process.env.EMAIL_TOKEN_SECRET_PREVIOUS
      assert.equal(verifyUnsubscribeToken(old), null)
      delete process.env.EMAIL_TOKEN_SECRET
      assert.equal(emailTokensConfigured(), false)
      assert.equal(unsubscribeToken(PROFILE), null)
      assert.equal(verifyUnsubscribeToken(old), null)
    } finally {
      process.env.EMAIL_TOKEN_SECRET = saved[0]
      if (saved[1]) process.env.EMAIL_TOKEN_SECRET_PREVIOUS = saved[1]
      else delete process.env.EMAIL_TOKEN_SECRET_PREVIOUS
    }
  })
})

/** A week with something in every section, the longest titles allowed. */
function fullWeek() {
  const tile = (n, extra = {}) => ({ title: `A rather long title for a film, number ${n}`, href: `/movie/${1000 + n}`, poster: `/poster${n}.jpg`, line: 'Movie', ...extra })
  return {
    shared: {
      newThisWeek: [1, 2, 3, 4, 5, 6].map((n) => tile(n)),
      tunisian: [7, 8, 9].map((n) => tile(n, { href: `/tunisian/2026/10/title-${n}`, poster: `https://blogger.example/${n}.jpg`, line: 'Series' })),
      moment: { id: 'halloween', title: 'Halloween', href: '/moments/halloween', accent: '255 120 40', tiles: [10, 11, 12].map((n) => tile(n)) },
      sequels: { title: 'The Return', tiles: [13, 14, 15].map((n) => tile(n)) },
      pick: { tile: tile(16), why: 'A classic turns 30 this week', backdrop: '/backdrop16.jpg', overview: 'x'.repeat(400), color: '200 80 60' },
    },
    personal: {
      follows: [{ ...tile(17, { line: 'Out now' }), kind: 'movie' }, { ...tile(18, { href: '/tv/18', line: 'New episode: S02E05' }), kind: 'tv' }],
      followHero: { title: 'A rather long title for a film, number 17', href: '/movie/1017', backdrop: '/b17.jpg', poster: '/p17.jpg', kicker: 'Out now', text: 'y'.repeat(300), cta: 'Watch now', color: '40 120 220' },
      continueWatching: [19, 20, 21].map((n) => tile(n, { href: `/tv/${n}`, line: 'Season 2, episode 5' })),
      picks: [22, 23, 24].map((n) => tile(n)),
      stillOnList: [25, 26, 27].map((n) => tile(n)),
    },
  }
}

describe('digest: what goes in, and in which order', () => {
  test('each title once, the hero first, and the subject about 60 characters', async () => {
    const { composeDigest } = await import('@/src/lib/digest/compose')
    const { createTranslator } = await import('@/src/lib/i18n')
    const { shared, personal } = fullWeek()
    const digest = composeDigest({ t: createTranslator('en'), name: 'Sami', shared, personal, extra: [{ type: 'posters', id: 'friends', title: 'From your friends', tiles: [shared.newThisWeek[0]] }] })
    assert.equal(digest.hero.href, '/movie/1017', 'a followed title leads')
    const ids = digest.sections.map((section) => section.id)
    assert.deepEqual(ids, ['follows', 'continue', 'picks', 'new', 'tunisian', 'moment', 'sequels', 'still-on-list'], 'the provider section only repeated a title, so it is gone')
    const hrefs = digest.sections.flatMap((section) => (section.rows ?? section.tiles).map((tile) => tile.href))
    assert.equal(new Set(hrefs).size, hrefs.length, 'no title twice')
    assert.ok(!hrefs.includes('/movie/1017'), 'the hero is not repeated')
    assert.ok(digest.sections.every((section) => (section.rows ?? section.tiles).length <= 3))
    assert.match(digest.subject, /and one more you follow have news$/, 'two followed titles: "one more", never "1 more"')
    assert.ok(digest.subject.length <= 64, digest.subject)
    const three = composeDigest({ t: createTranslator('en'), name: 'Sami', shared, personal: { ...personal, follows: [...personal.follows, { ...shared.newThisWeek[1], kind: 'movie' }] } })
    assert.match(three.subject, /and 2 more you follow have news$/)
    assert.equal(digest.sections.find((section) => section.id === 'moment').accent, '255 120 40')
  })

  test('fewer than four titles means the week is skipped; the subject follows the priorities', async () => {
    const { composeDigest, EMPTY_PERSONAL, EMPTY_SNAPSHOT, MIN_TILES } = await import('@/src/lib/digest/compose')
    const { createTranslator } = await import('@/src/lib/i18n')
    const t = createTranslator('en')
    const { shared } = fullWeek()
    const thin = composeDigest({ t, name: 'Sami', shared: { ...EMPTY_SNAPSHOT, newThisWeek: shared.newThisWeek.slice(0, 2) }, personal: EMPTY_PERSONAL })
    assert.ok(thin.tiles < MIN_TILES)
    assert.equal(thin.subject, t('digest.subject.default'))
    const momentOnly = composeDigest({ t, name: 'Sami', shared: { ...EMPTY_SNAPSHOT, moment: shared.moment, pick: shared.pick }, personal: EMPTY_PERSONAL })
    assert.equal(momentOnly.tiles, 4, 'the pick as hero plus three')
    assert.match(momentOnly.subject, /^⁨Halloween⁩: your weekend picks$/)
    const resume = composeDigest({ t, name: 'Sami', shared: EMPTY_SNAPSHOT, personal: { ...EMPTY_PERSONAL, continueWatching: shared.newThisWeek.slice(0, 1) } })
    assert.match(resume.subject, /^Pick up /)
  })

  test('other features’ sections: slow, failing and streak ones are left out', async () => {
    const { providerSections } = await import('@/src/lib/digest/providers')
    const ctx = { userId: 'u', profileId: 'p', locale: 'en', since: new Date(), until: new Date(), t: (key) => key }
    const original = console.error
    console.error = () => {}
    try {
      const sections = await providerSections(ctx, [
        { id: 'ok', build: async () => ({ type: 'note', id: 'ok', text: 'Hello' }) },
        { id: 'slow', build: () => new Promise((resolve) => setTimeout(() => resolve({ type: 'note', id: 'slow', text: 'late' }), 400)) },
        { id: 'broken', build: async () => { throw new Error('boom') } },
        { id: 'badges', build: async () => ({ type: 'note', id: 'weekly-streak', text: '3 weeks in a row' }) },
        { id: 'streaks', build: async () => ({ type: 'note', id: 'x', text: 'streak' }) },
        { id: 'empty', build: async () => ({ type: 'posters', id: 'empty', title: 'Nothing', tiles: [] }) },
        { id: 'none', build: async () => null },
      ], 100)
      assert.deepEqual(sections.map((section) => section.id), ['ok'])
    } finally {
      console.error = original
    }
  })
})

describe('digest: the e-mail', () => {
  const render = async (locale) => {
    const { composeDigest } = await import('@/src/lib/digest/compose')
    const { renderDigestEmail } = await import('@/src/lib/digest/template')
    const { createTranslator } = await import('@/src/lib/i18n')
    const t = createTranslator(locale)
    const { shared, personal } = fullWeek()
    const digest = composeDigest({ t, name: 'سامي', shared, personal })
    return renderDigestEmail({
      locale, t, appUrl: 'https://tunisiaflicks.example', name: 'سامي', edition: '2026-10-09',
      subject: digest.subject, preheader: digest.preheader, hero: digest.hero, sections: digest.sections,
      unsubscribeUrl: 'https://tunisiaflicks.example/unsubscribe?t=v1.abc.def', settingsUrl: 'https://tunisiaflicks.example/profile#email',
    })
  }

  test('a full week stays under 70KB, with a plain-text part', async () => {
    for (const locale of ['en', 'ar', 'tn']) {
      const email = await render(locale)
      const bytes = Buffer.byteLength(email.html)
      assert.ok(bytes < 70 * 1024, `${locale}: ${bytes} bytes`)
      assert.ok(email.text.length > 200)
      assert.match(email.text, /https:\/\/tunisiaflicks\.example\/unsubscribe\?t=/)
    }
  })

  test('no tracking, no scripts, no redirects; the footer says why and how to stop', async () => {
    const email = await render('en')
    assert.doesNotMatch(email.html, /<script/i)
    assert.doesNotMatch(email.html, /width="1"\s+height="1"/)
    assert.match(email.html, /This email has no tracking pixels\./)
    assert.match(email.html, /href="https:\/\/tunisiaflicks\.example\/unsubscribe\?t=v1\.abc\.def"/)
    assert.match(email.html, /href="https:\/\/tunisiaflicks\.example\/profile#email"/)
    assert.match(email.html, /<meta name="color-scheme" content="dark">/)
    assert.match(email.html, /bgcolor="#000000"/)
    const hrefs = [...email.html.matchAll(/href="([^"]+)"/g)].map((match) => match[1])
    assert.ok(hrefs.every((href) => href.startsWith('https://tunisiaflicks.example')), 'links go straight to the site')
    const images = [...email.html.matchAll(/<img[^>]+src="([^"]+)"/g)].map((match) => match[1])
    assert.ok(images.every((src) => /^https:\/\/(image\.tmdb\.org|tunisiaflicks\.example\/email\/|blogger\.example)/.test(src)), images.join(' '))
    // The CTA pill is the only red: its cell, and nothing else.
    assert.equal((email.html.match(/#e50f05/gi) ?? []).length, 2, 'bgcolor and background-color of the one pill')
  })

  test('Arabic: right to left on every table, names and titles isolated', async () => {
    const email = await render('ar')
    assert.match(email.html, /<html lang="ar" dir="rtl"/)
    const tables = email.html.match(/<table\b[^>]*>/g)
    assert.ok(tables.length > 10)
    assert.ok(tables.every((tag) => tag.includes('dir="rtl"')), 'every table carries dir="rtl"')
    assert.match(email.html, /⁨سامي⁩/)
    assert.match(email.subject, /⁨/)
  })

  test('French: a no-break space before a colon, a narrow one before ; ! ? and inside « »', async () => {
    const { frenchSpacing } = await import('@/src/lib/digest/template')
    assert.equal(frenchSpacing('Prochain envoi : vendredi ? Oui !'), 'Prochain envoi : vendredi ? Oui !')
    assert.equal(frenchSpacing('Prochain envoi : vendredi'), 'Prochain envoi : vendredi', 'the colon always gets the full no-break space')
    assert.equal(frenchSpacing('« Dune »'), '« Dune »')
  })
})

describe('digest: delivery, at most once', { skip: !HAS_DB && 'no MONGODB_URI' }, () => {
  const EDITION = '2026-10-09'
  const profileIds = Array.from({ length: 24 }, (_, i) => (0xabc000 + i).toString(16).padStart(24, '0'))

  const reset = async (rows = profileIds) => {
    const { digestCollections } = await import('@/src/lib/digest/db')
    const { deliveries, editions } = await digestCollections()
    await deliveries.deleteMany({ edition: EDITION })
    await editions.deleteMany({ _id: EDITION })
    await editions.insertOne({ _id: EDITION, phase: 'send', counts: {}, shared: {}, enqueue_cursor: null })
    const now = new Date()
    await deliveries.insertMany(rows.map((profileId) => ({
      _id: `${EDITION}:${profileId}`, edition: EDITION, profileId, userId: 'u', status: 'queued', attempts: 0,
      created_at: now, updated_at: now, expires_at: new Date(Date.now() + 86400000),
    })))
    return deliveries
  }

  const engine = (sends, opts = {}) => ({
    prepare: async (delivery) => (opts.skip?.includes(delivery.profileId) ? { skip: 'thin' } : { message: delivery.profileId }),
    reserve: async () => (opts.budget === undefined ? true : opts.budget-- > 0),
    transport: async (delivery, message) => {
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 8))
      sends.push(message)
    },
  })

  test('two runs at once never send a profile twice', async () => {
    const { sendQueued } = await import('@/src/lib/digest/deliveries')
    const deliveries = await reset()
    const sends = []
    const deadline = Date.now() + 20_000
    const [a, b] = await Promise.all([sendQueued(EDITION, deadline, engine(sends)), sendQueued(EDITION, deadline, engine(sends))])
    assert.equal(a.sent + b.sent, profileIds.length)
    assert.equal(sends.length, profileIds.length)
    assert.equal(new Set(sends).size, profileIds.length, 'each profile once')
    assert.equal(await deliveries.countDocuments({ edition: EDITION, status: 'sent' }), profileIds.length)
  })

  test('a run killed while sending never resends; one killed while building is picked up', async () => {
    const { sendQueued } = await import('@/src/lib/digest/deliveries')
    const deliveries = await reset(profileIds.slice(0, 3))
    const old = new Date(Date.now() - 10 * 60 * 1000)
    await deliveries.updateOne({ _id: `${EDITION}:${profileIds[0]}` }, { $set: { status: 'sending', claim: 'dead-run', claimed_at: old } })
    await deliveries.updateOne({ _id: `${EDITION}:${profileIds[1]}` }, { $set: { status: 'building', claim: 'dead-run', claimed_at: old } })
    const sends = []
    const stats = await sendQueued(EDITION, Date.now() + 20_000, engine(sends))
    assert.deepEqual(sends.sort(), [profileIds[1], profileIds[2]].sort())
    assert.equal(stats.unknown, 1)
    assert.equal((await deliveries.findOne({ _id: `${EDITION}:${profileIds[0]}` })).status, 'unknown')
  })

  test('skips are recorded; when the budget runs out the rest waits, attempts untouched', async () => {
    const { sendQueued, queuedCount } = await import('@/src/lib/digest/deliveries')
    const deliveries = await reset(profileIds.slice(0, 6))
    const sends = []
    const stats = await sendQueued(EDITION, Date.now() + 20_000, engine(sends, { budget: 2, skip: [profileIds[0]] }), 1)
    assert.equal(stats.quota, true)
    assert.equal(stats.sent, 2)
    assert.equal(stats.skipped, 1)
    assert.equal(await queuedCount(EDITION), 3)
    const waiting = await deliveries.find({ edition: EDITION, status: 'queued' }).toArray()
    assert.ok(waiting.every((row) => row.attempts === 0))
    assert.equal((await deliveries.findOne({ _id: `${EDITION}:${profileIds[0]}` })).reason, 'thin')
  })

  test('a hard bounce fails the delivery; nothing reaching the server means try again', async () => {
    const { sendQueued } = await import('@/src/lib/digest/deliveries')
    const deliveries = await reset(profileIds.slice(0, 2))
    let bounced = 0
    let calls = 0
    const stats = await sendQueued(EDITION, Date.now() + 20_000, {
      prepare: async (delivery) => ({ message: delivery.profileId }),
      reserve: async () => true,
      transport: async (delivery) => {
        calls++
        if (delivery.profileId === profileIds[0]) throw Object.assign(new Error('550 no such user'), { code: 'EENVELOPE', responseCode: 550 })
        if (calls < 4) throw Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNECTION' })
      },
      onBounce: async () => { bounced++ },
    }, 1)
    assert.equal(bounced, 1)
    assert.equal(stats.failed, 1)
    assert.equal(stats.sent, 1)
    assert.ok(stats.retried >= 1)
    assert.equal((await deliveries.findOne({ _id: `${EDITION}:${profileIds[0]}` })).reason, 'bounce')
  })
})

describe('digest: the weekly run', { skip: !HAS_DB && 'no MONGODB_URI' }, () => {
  const FRIDAY = '2026-10-16'
  const inside = new Date('2026-10-16T18:00:00Z')

  test('idle outside the window; done inside it; what is left expires after', async () => {
    const { runWeeklyDigest } = await import('@/src/lib/digest/run')
    const { digestCollections } = await import('@/src/lib/digest/db')
    const { prefs, editions, deliveries } = await digestCollections()
    await Promise.all([prefs.deleteMany({}), editions.deleteMany({}), deliveries.deleteMany({})])

    assert.equal((await runWeeklyDigest({ deadline: Date.now() + 20_000, now: new Date('2026-10-15T12:00:00Z') })).status, 'idle')

    const now = new Date()
    const ids = ['aaa', 'aab', 'aac', 'aad'].map((s) => s.padStart(24, '0'))
    await prefs.insertMany(ids.map((_id, i) => ({ _id, userId: 'u', enabled: true, locale: 'en', created_at: now, updated_at: now, hard_bounces: 0, ...(i === 3 ? { paused_reason: 'bounced' } : {}) })))
    // The shared snapshot is already there (no TMDB in unit tests).
    await editions.insertOne({ _id: FRIDAY, opens_at: inside, closes_at: inside, in_ramadan: false, phase: 'snapshot', enqueue_cursor: null, shared: { en: { newThisWeek: [], tunisian: [], moment: null, sequels: null, pick: null, built_at: now } }, counts: {}, created_at: now, expires_at: new Date(Date.now() + 86400000) })

    const sent = []
    const engine = { prepare: async (d) => ({ message: d.profileId }), reserve: async () => true, transport: async (d, m) => { sent.push(m) } }
    const result = await runWeeklyDigest({ deadline: Date.now() + 20_000, now: inside, engine })
    assert.equal(result.more, false)
    assert.equal(result.sent, 3, 'the paused profile is not enqueued')
    assert.equal(result.enqueued, 3)
    const again = await runWeeklyDigest({ deadline: Date.now() + 20_000, now: inside, engine })
    assert.equal(again.sent, 0, 'nothing twice')
    assert.equal(sent.length, 3)

    // One more turned on late, then the window closes before it goes.
    await deliveries.insertOne({ _id: `${FRIDAY}:late`, edition: FRIDAY, profileId: 'late', userId: 'u', status: 'queued', attempts: 0, created_at: now, updated_at: now, expires_at: now })
    const closed = await runWeeklyDigest({ deadline: Date.now() + 20_000, now: new Date('2026-10-19T16:00:00Z') })
    assert.equal(closed.expired, 1)
    assert.equal((await editions.findOne({ _id: FRIDAY })).phase, 'closed')
    assert.equal((await runWeeklyDigest({ deadline: Date.now() + 20_000, now: new Date('2026-10-19T16:10:00Z') })).status, 'idle')
  })

  test('not configured (no EMAIL_TOKEN_SECRET): always idle', async () => {
    const { runWeeklyDigest } = await import('@/src/lib/digest/run')
    const saved = process.env.EMAIL_TOKEN_SECRET
    delete process.env.EMAIL_TOKEN_SECRET
    try {
      const result = await runWeeklyDigest({ deadline: Date.now() + 20_000, now: inside })
      assert.equal(result.status, 'idle')
      assert.equal(result.configured, false)
    } finally {
      process.env.EMAIL_TOKEN_SECRET = saved
    }
  })
})
