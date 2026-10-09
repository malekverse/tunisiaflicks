// Smoke tests for movie nights against a running server (BASE_URL, default :3000).
//
// Signed out: /movie-night invites you in, an unknown night is a 404 (page, API and calendar file),
// every API refuses you (the vote included), and the nights cron wants its secret.
//
// With the server's database (MONGODB_URI) and NEXTAUTH_SECRET in this process too (CI sets both),
// the tests seed two throwaway accounts and one night of their own, and remove them afterwards:
// someone else's night stays a 404 for you (page, API, vote, .ics), its host gets a well-formed
// calendar file, the vote works for the host, and a Kids profile is turned away. They only seed a
// local database (127.0.0.1 / localhost) unless CI is set.
import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'

const BASE = (process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
const CRON_SECRET = process.env.CRON_SECRET?.trim() || ''
const MONGODB_URI = process.env.MONGODB_URI?.trim() || ''
const LOCAL_DB = /^mongodb:\/\/(127\.0\.0\.1|localhost)[:/]/.test(MONGODB_URI)
const CAN_SEED = !!MONGODB_URI && (process.env.NEXTAUTH_SECRET?.trim().length ?? 0) > 0 && (LOCAL_DB || !!process.env.CI)
// A well-formed id nobody has (the alphabet skips 0, O, 1 and I).
const UNKNOWN = 'ZZZZ2222ZZ'

const call = (path, init = {}) => fetch(BASE + path, {
  redirect: 'manual',
  ...init,
  headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
})

/**
 * The page's 404. Every page streams behind the root loading screen (src/app/loading.tsx), which
 * can go out with a 200 before the page has decided: its notFound() then changes what is shown
 * (the 404 screen, noindex), not the status. So: a 404, or a 200 that is the 404 screen. Either
 * way, none of the night's own words (`secrets`) are in it.
 */
async function assertNotFoundPage(res, label, secrets = []) {
  const html = await res.text()
  assert.ok(res.status === 404 || (res.status === 200 && /NEXT_NOT_FOUND/.test(html) && /name="robots" content="noindex/.test(html)), `${label}: ${res.status}`)
  for (const secret of secrets) assert.doesNotMatch(html, new RegExp(secret, 'i'), `${label} shows nothing of the night`)
}

async function json(res) {
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    assert.fail(`not JSON (${res.status}): ${text.slice(0, 160)}`)
  }
}

describe('signed out', () => {
  test('/movie-night renders (an invitation to sign in, no error)', async () => {
    const res = await call('/movie-night')
    assert.equal(res.status, 200)
    const html = await res.text()
    assert.doesNotMatch(html, /Application error/)
    assert.match(html, /href="\/login[^"]*"/, 'a way in: the sign-in link')
  })

  test('an unknown or malformed night is a 404 page', async () => {
    for (const id of [UNKNOWN, 'abc', 'ZZZZ2222Z0']) await assertNotFoundPage(await call(`/movie-night/${id}`), id)
    await assertNotFoundPage(await call(`/movie-night/${UNKNOWN}/edit`), `${UNKNOWN}/edit`)
  })

  test('the night APIs: 401 without an account, 404 for a night that does not exist', async () => {
    assert.equal((await call('/api/movie-night')).status, 401)
    assert.equal((await call('/api/movie-night?next=1')).status, 401)
    const create = await call('/api/movie-night', { method: 'POST', body: '{}' })
    assert.ok([400, 401].includes(create.status), String(create.status))
    const body = await json(create)
    assert.ok(body.code, 'answers with a code')
    assert.match(create.headers.get('cache-control') ?? '', /no-store/)

    const read = await call(`/api/movie-night/${UNKNOWN}`)
    assert.equal(read.status, 404)
    assert.match(read.headers.get('cache-control') ?? '', /no-store/)
    assert.equal((await call('/api/movie-night/not-an-id')).status, 404)
  })

  test('voting, closing the vote and every other action need an account', async () => {
    for (const body of [
      { action: 'vote', key: 'movie:550' },
      { action: 'vote', key: null },
      { action: 'closeVote' },
      { action: 'rsvp', going: true },
      { action: 'join', token: 'x'.repeat(22) },
      { action: 'room' },
      {},
    ]) {
      const res = await call(`/api/movie-night/${UNKNOWN}`, { method: 'POST', body: JSON.stringify(body) })
      assert.equal(res.status, 401, JSON.stringify(body))
      assert.equal((await json(res)).code, 'unauthorized')
    }
  })

  test('the calendar file of an unknown night is a 404, never cached', async () => {
    for (const id of [UNKNOWN, 'nope']) {
      const res = await call(`/api/movie-night/${id}/ics`)
      assert.equal(res.status, 404, id)
      assert.match(res.headers.get('cache-control') ?? '', /no-store/)
      assert.doesNotMatch(res.headers.get('content-type') ?? '', /calendar/)
    }
  })
})

describe('the nights cron', () => {
  test('no secret or a wrong one: 401', async () => {
    for (const headers of [{}, { authorization: 'Bearer wrong-secret-0123456789abcdef0123456789' }, { authorization: 'Bearer ' }]) {
      const res = await call('/api/cron/nights', { headers })
      assert.equal(res.status, 401, JSON.stringify(Object.keys(headers)))
      assert.equal((await json(res)).ok, false)
    }
  })

  test('with the secret it answers 200 and says what it did', { skip: !CRON_SECRET && 'no CRON_SECRET' }, async () => {
    const res = await call('/api/cron/nights', { headers: { authorization: `Bearer ${CRON_SECRET}`, 'x-cron-source': 'cron-job' } })
    assert.equal(res.status, 200)
    const body = await json(res)
    assert.equal(body.ok, true)
    assert.equal(body.job, 'nights')
    assert.equal(typeof body.more, 'boolean')
  })
})

describe('someone else\'s night', { skip: !CAN_SEED && 'needs MONGODB_URI (local) and NEXTAUTH_SECRET' }, () => {
  let client
  let db
  const stamp = randomBytes(6).toString('hex')
  // Ids as the app makes them: 24 hex characters for accounts and profiles.
  const hex = (n) => `${stamp}${String(n).padStart(12, '0')}`
  const host = { user: hex(1), profile: hex(101), kids: hex(102), email: `mn-host-${stamp}@example.test` }
  const other = { user: hex(2), profile: hex(201), email: `mn-other-${stamp}@example.test` }
  // A night id (10 characters of A-Z2-9 without 0, O, 1 and I) that is unlikely to exist already.
  const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const id = [...randomBytes(10)].map((byte) => ALPHABET[byte % ALPHABET.length]).join('')
  const cookies = {}
  const as = (who, profile) => ({ cookie: `next-auth.session-token=${cookies[who]}; tf_profile=${profile}; tf-locale=en` })

  before(async () => {
    const { MongoClient, ObjectId } = await import('mongodb')
    const { encode } = await import('next-auth/jwt')
    client = await new MongoClient(MONGODB_URI).connect()
    db = client.db()
    const now = new Date()
    for (const person of [host, other]) {
      const profiles = [{ id: person.profile, name: 'Smoke', color: '#3B82F6', kids: false, createdAt: now }]
      if (person.kids) profiles.push({ id: person.kids, name: 'Kid', color: '#2BB673', kids: true, createdAt: now })
      await db.collection('users').insertOne({ _id: new ObjectId(person.user), email: person.email, name: 'Smoke test', emailVerified: now, profiles })
      cookies[person === host ? 'host' : 'other'] = await encode({
        token: { id: person.user, sub: person.user, email: person.email, name: 'Smoke test', loginAt: now.getTime() },
        secret: process.env.NEXTAUTH_SECRET,
        maxAge: 3600,
      })
    }
    const starts = new Date(Date.now() + 3 * 86400000)
    const ends = new Date(starts.getTime() + 3 * 3600000)
    const film = { key: 'movie:550', media: { media_type: 'movie', id: '550', title: 'Fight Club', poster_path: null }, backdrop_path: null, year: '1999', added_by: host.profile, added_at: now }
    await db.collection('movieNights').insertOne({
      _id: id, version: 3, rev: 1, host: { userId: host.user, profileId: host.profile }, title: 'Smoke night, with; commas',
      starts_at: starts, ends_at: ends, tz: 'Africa/Tunis', place: 'A secret place', note: '', guests: [], declined: [],
      candidates: [film, { ...film, key: 'movie:155', media: { ...film.media, id: '155', title: 'The Dark Knight' } }],
      votes: {}, vote_at: {}, vote_closes_at: new Date(starts.getTime() - 2 * 3600000), vote_closed_at: null,
      chosen: null, chosen_by: null, chosen_at: null, room: null, status: 'planned', cancelled_at: null,
      reminded: { day: false, hour: false }, created_at: now, updated_at: now, expires_at: new Date(ends.getTime() + 14 * 86400000),
    })
  })

  after(async () => {
    if (!db) return
    const { ObjectId } = await import('mongodb')
    await db.collection('movieNights').deleteOne({ _id: id })
    await db.collection('users').deleteMany({ _id: { $in: [new ObjectId(host.user), new ObjectId(other.user)] } })
    await db.collection('notifications').deleteMany({ userId: { $in: [host.user, other.user] } }).catch(() => {})
    await db.collection('rateLimits').deleteMany({ _id: { $regex: `^night:act:(${host.user}|${other.user})` } }).catch(() => {})
    await client.close()
  })

  test('to anyone else it does not exist: page, API, vote and calendar file are 404', async () => {
    const secrets = ['Smoke night', 'secret place', 'Fight Club']
    await assertNotFoundPage(await call(`/movie-night/${id}`, { headers: as('other', other.profile) }), 'page', secrets)
    await assertNotFoundPage(await call(`/movie-night/${id}/edit`, { headers: as('other', other.profile) }), 'edit page', secrets)
    assert.equal((await call(`/api/movie-night/${id}`, { headers: as('other', other.profile) })).status, 404, 'API')
    const vote = await call(`/api/movie-night/${id}`, { method: 'POST', headers: as('other', other.profile), body: JSON.stringify({ action: 'vote', key: 'movie:550' }) })
    assert.equal(vote.status, 404, 'vote')
    const ics = await call(`/api/movie-night/${id}/ics`, { headers: as('other', other.profile) })
    assert.equal(ics.status, 404, 'ics')
    assert.doesNotMatch(await ics.text(), /secret place/i)
    // Signed out, the same.
    assert.equal((await call(`/api/movie-night/${id}/ics`)).status, 404)
    await assertNotFoundPage(await call(`/movie-night/${id}`), 'signed out', secrets)
  })

  test('its host gets the calendar file: CRLF, UID, SEQUENCE, a reminder an hour before', async () => {
    const res = await call(`/api/movie-night/${id}/ics`, { headers: as('host', host.profile) })
    assert.equal(res.status, 200)
    assert.match(res.headers.get('content-type') ?? '', /text\/calendar/)
    assert.match(res.headers.get('cache-control') ?? '', /no-store/)
    const ics = await res.text()
    assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'), 'CRLF line ends')
    assert.doesNotMatch(ics.replace(/\r\n/g, ''), /\n/, 'no bare LF')
    assert.match(ics, new RegExp(`UID:night-${id}@tunisiaflicks`))
    assert.match(ics, /\r\nSEQUENCE:3\r\n/)
    assert.match(ics, /BEGIN:VALARM[\s\S]*TRIGGER:-PT(1H|60M)\r\n[\s\S]*END:VALARM/)
    assert.match(ics, /SUMMARY:Smoke night\\, with\\; commas/, 'text is escaped')
    for (const line of ics.split('\r\n')) assert.ok(Buffer.byteLength(line) <= 75, `folded: ${line.slice(0, 40)}`)
  })

  test('the host votes, changes the vote, and sees the count', async () => {
    const vote = (key) => call(`/api/movie-night/${id}`, { method: 'POST', headers: as('host', host.profile), body: JSON.stringify({ action: 'vote', key }) })
    assert.equal((await vote('movie:550')).status, 200)
    assert.equal((await vote('movie:155')).status, 200)
    const unknown = await vote('movie:13')
    assert.ok([400, 404, 409].includes(unknown.status), `a film that is not on the ballot: ${unknown.status}`)
    const res = await call(`/api/movie-night/${id}`, { headers: as('host', host.profile) })
    assert.equal(res.status, 200)
    const view = await json(res)
    const counts = Object.fromEntries(view.candidates.map((candidate) => [candidate.key, candidate.votes]))
    assert.deepEqual(counts, { 'movie:550': 0, 'movie:155': 1 }, 'one vote each, changeable')
    assert.equal(view.chosen, null)
  })

  test('a Kids profile is turned away (page and API)', async () => {
    const page = await call('/movie-night', { headers: as('host', host.kids) })
    assert.equal(page.status, 200)
    assert.doesNotMatch(await page.text(), /Smoke night/)
    const api = await call(`/api/movie-night/${id}`, { headers: as('host', host.kids) })
    assert.equal(api.status, 403)
    assert.equal((await call('/api/movie-night?next=1', { headers: as('host', host.kids) })).status, 403)
  })
})
