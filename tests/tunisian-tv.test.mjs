// Smoke tests for Tunisian TV against a running server (BASE_URL, default :3000):
//   BASE_URL=http://localhost:3300 node --import ./tests/register.mjs --test tests/tunisian-tv.test.mjs
//
// - The cron refuses a call without the secret (401). With CRON_SECRET in this process too: it
//   answers within cron-job.org's 22 seconds, a second run stores nothing twice, and of two runs
//   at once one answers "busy".
// - The pages answer 200 whatever the database or YouTube says (an empty hub says it is warming
//   up), an unknown or reserved channel is a 404, Derja is right-to-left, and nothing in the HTML
//   loads from YouTube's or Google's servers before Play (thumbnails are our own route).
// - With the server's database (MONGODB_URI, local only unless CI) and NEXTAUTH_SECRET: a Kids
//   profile gets KidsBlocked, and a live channel lights the /tunisian door and the home tile.
//   Everything seeded is removed afterwards.
import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'

const BASE = (process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
const CRON_SECRET = process.env.CRON_SECRET?.trim() || ''
const MONGODB_URI = process.env.MONGODB_URI?.trim() || ''
const LOCAL_DB = /^mongodb:\/\/(127\.0\.0\.1|localhost)[:/]/.test(MONGODB_URI)
const CAN_SEED = !!MONGODB_URI && (process.env.NEXTAUTH_SECRET?.trim().length ?? 0) > 0 && (LOCAL_DB || !!process.env.CI)
// First compiles of a page on a busy dev server can take minutes.
const TIMEOUT = { timeout: 600_000 }

const get = (path, init = {}) => fetch(BASE + path, { redirect: 'manual', ...init })

async function page(path, init) {
  const res = await get(path, init)
  assert.equal(res.status, 200, `${path} -> ${res.status}`)
  const html = await res.text()
  assert.match(html, /<html[^>]+lang=/, `${path}: not an HTML page`)
  assert.doesNotMatch(html, /Application error: a (client|server)-side exception/, `${path}: crashed`)
  return html
}

/** Nothing the browser would fetch on load points at YouTube or Google (links are fine). */
function assertNothingFromYouTube(html, path) {
  const loads = [...html.matchAll(/\b(?:src|srcSet|srcset|poster|data-src)="([^"]*)"/g)].map((match) => match[1])
  for (const url of loads) assert.doesNotMatch(url, /youtube\.com|youtube-nocookie\.com|ytimg\.com|ggpht\.com|googleusercontent\.com|googleapis\.com/, `${path}: loads ${url}`)
  assert.doesNotMatch(html, /<iframe/i, `${path}: a player before Play`)
  assert.doesNotMatch(html, /<link[^>]+href="[^"]*(?:youtube|ytimg|ggpht)/i, `${path}: preloads from YouTube`)
}

const cron = (query = '', headers = {}) => get(`/api/cron/tunisian-tv${query}`, { headers: { 'x-cron-source': 'cron-job', ...headers } })
const authorized = () => ({ authorization: `Bearer ${CRON_SECRET}` })

test('the cron needs its secret', TIMEOUT, async () => {
  for (const headers of [{}, { authorization: 'Bearer nope' }, { authorization: 'Basic x' }]) {
    const res = await cron('', headers)
    assert.equal(res.status, 401)
    assert.equal((await res.json()).ok, false)
  }
})

describe('the cron with its secret', { skip: !CRON_SECRET && 'no CRON_SECRET' }, () => {
  test('answers within cron-job.org\'s 22 seconds, with numbers only', TIMEOUT, async () => {
    const res = await cron('', authorized())
    assert.equal(res.status, 200)
    const body = await res.json()
    assert.equal(body.ok, true)
    assert.equal(body.job, 'tunisian-tv')
    assert.ok(['done', 'more', 'busy', 'idle'].includes(body.status), body.status)
    assert.ok(body.ms < 22_000 + 3_000, `took ${body.ms}ms`)
    for (const [key, value] of Object.entries(body)) {
      if (['ok', 'job', 'status', 'more', 'ms'].includes(key)) continue
      assert.ok(typeof value === 'number' || typeof value === 'boolean', `${key} is ${typeof value}`)
    }
  })

  test('a second run stores nothing twice', TIMEOUT, async () => {
    const first = await (await cron('?scope=feeds', authorized())).json()
    const second = await (await cron('?scope=feeds', authorized())).json()
    assert.equal(second.ok, true)
    // The feeds were read moments ago: nothing is due, nothing new is stored.
    assert.equal(second.feedsDue ?? 0, 0)
    assert.equal(second.videosNew ?? 0, 0)
    if (first.ttvChannels !== undefined && second.ttvChannels !== undefined) assert.equal(second.ttvChannels, first.ttvChannels)
    if (first.ttvVideos !== undefined && second.ttvVideos !== undefined) assert.ok(second.ttvVideos <= first.ttvVideos)
  })

  test('of two runs at once, one answers busy', TIMEOUT, async () => {
    const one = cron('?scope=full', authorized())
    await new Promise((resolve) => setTimeout(resolve, 1500))
    const two = cron('?scope=full', authorized())
    const answers = await Promise.all([one, two].map(async (pending) => (await pending).json()))
    assert.ok(answers.every((body) => body.ok === true))
    assert.equal(answers.filter((body) => body.status === 'busy').length, 1, JSON.stringify(answers.map((body) => body.status)))
  })
})

test('/tunisian/tv answers, and loads nothing from YouTube', TIMEOUT, async () => {
  const html = await page('/tunisian/tv')
  assert.match(html, /Tunisian TV/)
  // Either the hub or the warming-up state, never an error page.
  assert.ok(/aria-label="Featured series"|id="channels"|Tunisian TV is warming up|Live now|New episodes/.test(html), 'the hub or its empty state')
  assert.match(html, /official YouTube pages/, 'the footer says where episodes play from')
  assertNothingFromYouTube(html, '/tunisian/tv')
})

test('a channel page answers, and loads nothing from YouTube', TIMEOUT, async () => {
  const html = await page('/tunisian/tv/watania-2')
  assert.match(html, /Watania 2/)
  assert.match(html, /Official channel/)
  assert.match(html, /href="https:\/\/www\.youtube\.com\/(%40|@)Watania2Replay"/)
  assertNothingFromYouTube(html, '/tunisian/tv/watania-2')
  // ?v= with anything but a video id is ignored.
  await page('/tunisian/tv/watania-2?v=%3Cscript%3E')
})

test('unknown, reserved and malformed channels are 404s', TIMEOUT, async () => {
  for (const path of ['/tunisian/tv/nope', '/tunisian/tv/series', '/tunisian/tv/live', '/tunisian/tv/WATANIA-1']) {
    const res = await get(path)
    assert.equal(res.status, 404, path)
    await res.body?.cancel()
  }
  assert.equal((await get('/tunisian/tv/nope/avatar')).status, 404)
})

test('Derja renders Tunisian TV right-to-left', TIMEOUT, async () => {
  const html = await page('/tunisian/tv', { headers: { cookie: 'tf-locale=tn' } })
  assert.match(html, /<html[^>]*lang="ar-TN"[^>]*dir="rtl"/)
  assert.match(html, /التلفزة التونسية/)
})

test('/tunisian has its three doors, and /ramadan its way to Tunisian TV', TIMEOUT, async () => {
  const html = await page('/tunisian')
  for (const href of ['/tunisian/cinema', '/tunisian/tv', '/ramadan']) assert.match(html, new RegExp(`href="${href}"`), href)
  // Stacked below xl, so their text is never cut at tablet widths.
  assert.match(html, /grid gap-3 xl:grid-cols-3/)
  const ramadan = await page('/ramadan')
  assert.match(ramadan, /href="\/tunisian\/tv"/)
  assertNothingFromYouTube(ramadan, '/ramadan')
})

describe('with the database', { skip: !CAN_SEED && 'needs MONGODB_URI (local) and NEXTAUTH_SECRET' }, () => {
  let client
  let db
  const stamp = randomBytes(6).toString('hex')
  const hex = (n) => `${stamp}${String(n).padStart(12, '0')}`
  const person = { user: hex(1), profile: hex(101), kids: hex(102), email: `ttv-${stamp}@example.test` }
  let session = ''
  let liveBefore
  const as = (profile) => ({ cookie: `next-auth.session-token=${session}; tf_profile=${profile}; tf-locale=en` })

  before(async () => {
    const { MongoClient, ObjectId } = await import('mongodb')
    const { encode } = await import('next-auth/jwt')
    client = await new MongoClient(MONGODB_URI).connect()
    db = client.db()
    const now = new Date()
    await db.collection('users').insertOne({
      _id: new ObjectId(person.user), email: person.email, name: 'TV smoke', emailVerified: now,
      profiles: [
        { id: person.profile, name: 'Grown-up', color: '#3B82F6', kids: false, createdAt: now },
        { id: person.kids, name: 'Kid', color: '#2BB673', kids: true, createdAt: now },
      ],
    })
    session = await encode({
      token: { id: person.user, sub: person.user, email: person.email, name: 'TV smoke', loginAt: now.getTime() },
      secret: process.env.NEXTAUTH_SECRET,
      maxAge: 3600,
    })
  })

  after(async () => {
    if (!db) return
    const { ObjectId } = await import('mongodb')
    await db.collection('users').deleteOne({ _id: new ObjectId(person.user) })
    if (liveBefore !== undefined) await db.collection('ttvChannels').updateOne({ _id: 'watania-1' }, { $set: { live: liveBefore } })
    await client.close()
  })

  test('a Kids profile gets KidsBlocked, a grown-up the hub', TIMEOUT, async () => {
    // Rendered markup, not strings: every page carries the whole dictionary for the client.
    const blocked = /available on Kids profiles<\/h1>/
    for (const path of ['/tunisian/tv', '/tunisian/tv/watania-2']) {
      const kids = await page(path, { headers: as(person.kids) })
      assert.match(kids, blocked, path)
      // No channel links: the hub isn't there.
      assert.doesNotMatch(kids, /href="\/tunisian\/tv\/[a-z]/, path)
    }
    const grownUp = await page('/tunisian/tv', { headers: as(person.profile) })
    assert.doesNotMatch(grownUp, blocked)
  })

  test('a live channel lights the /tunisian door and the home tile', { ...TIMEOUT, skip: !CRON_SECRET && 'no CRON_SECRET (the cron clears the cache)' }, async () => {
    const channels = db.collection('ttvChannels')
    const doc = await channels.findOne({ _id: 'watania-1' })
    if (!doc) return
    liveBefore = doc.live ?? null
    // Read just now, so the run below doesn't reread its feed; it only clears the pages' cache.
    await channels.updateOne({ _id: 'watania-1' }, { $set: { live: { videoId: 'dQw4w9WgXcQ', title: 'Diffusion en direct', since: new Date() }, feedReadAt: new Date() } })
    await (await cron('?scope=feeds', authorized())).json()
    const doors = await page('/tunisian')
    assert.match(doors, /A channel is live now/)
    const hub = await page('/tunisian/tv')
    assert.match(hub, /Live now/)
    assertNothingFromYouTube(hub, '/tunisian/tv (live)')
    const home = await page('/', { headers: as(person.profile) })
    if (/Beyond Hollywood/.test(home)) assert.match(home, /A channel is live now/)
  })
})
