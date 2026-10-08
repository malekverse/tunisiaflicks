// Smoke tests for the social layer against a running server (BASE_URL, default :3000):
// what a signed-out visitor gets from every social API, and that the pages carrying the shell
// still render. Signed-in flows need seeded accounts and live in the track's scratch scripts.
import { test } from 'node:test'
import assert from 'node:assert/strict'

const BASE = (process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
const hasTmdb = !!process.env.TMDB_API_KEY

const call = (path, init) => fetch(BASE + path, { redirect: 'manual', ...init, headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) } })

async function json(res) {
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    assert.fail(`not JSON: ${text.slice(0, 120)}`)
  }
}

test('guest: the friends feed is 401 with a code', async () => {
  const res = await call('/api/social/feed')
  assert.equal(res.status, 401)
  assert.equal((await json(res)).code, 'unauthorized')
  assert.match(res.headers.get('cache-control') ?? '', /no-store/)
})

test('guest: ratings can be read (mine is null) but not written', async () => {
  const read = await call('/api/ratings?type=movie&id=550')
  assert.equal(read.status, 200)
  const body = await json(read)
  assert.equal(body.mine, null)
  assert.deepEqual(body.friends, [])
  assert.ok('average' in body && 'countLabel' in body)
  const write = await call('/api/ratings', { method: 'PUT', body: JSON.stringify({ type: 'movie', id: '550', rating: 4 }) })
  assert.equal(write.status, 401)
  const clear = await call('/api/ratings?type=movie&id=550', { method: 'DELETE' })
  assert.equal(clear.status, 401)
})

test('ratings: a malformed title is 400', async () => {
  assert.equal((await call('/api/ratings?type=person&id=1')).status, 400)
  assert.equal((await call('/api/ratings?type=movie&id=abc')).status, 400)
})

test('guest: notifications are 401', async () => {
  assert.equal((await call('/api/notifications')).status, 401)
  assert.equal((await call('/api/notifications', { method: 'PATCH', body: '{"all":true}' })).status, 401)
})

test('guest: every social API answers 401 with {error, code}', async () => {
  const routes = [
    ['GET', '/api/social/handle'],
    ['GET', '/api/social/handle?h=amine'],
    ['POST', '/api/social/handle', { handle: 'amine' }],
    ['PATCH', '/api/social/handle', { name: 'x' }],
    ['GET', '/api/social/privacy'],
    ['PATCH', '/api/social/privacy', { ratings: 'friends' }],
    ['GET', '/api/social/friends'],
    ['GET', '/api/social/friends?summary=1'],
    ['DELETE', '/api/social/friends?handle=amine'],
    ['POST', '/api/social/requests', { handle: 'amine' }],
    ['PATCH', '/api/social/requests', { id: '0'.repeat(24), accept: true }],
    ['POST', '/api/social/invite'],
    ['GET', '/api/social/invite'],
    ['POST', '/api/social/send', { to: ['amine'], media: { media_type: 'movie', id: '550' } }],
  ]
  for (const [method, path, body] of routes) {
    const res = await call(path, { method, body: body ? JSON.stringify(body) : undefined })
    assert.equal(res.status, 401, `${method} ${path} -> ${res.status}`)
    const data = await json(res)
    assert.equal(data.code, 'unauthorized', `${method} ${path}`)
    assert.ok(data.error, `${method} ${path} has an error message`)
  }
})

test('avatars: unknown or private pages are 404 and never cached', async () => {
  for (const path of ['/api/social/avatar/nobody_here', '/api/social/avatar/..%2F..%2Fetc']) {
    const res = await call(path)
    assert.equal(res.status, 404, path)
    assert.match(res.headers.get('cache-control') ?? '', /no-store/)
  }
})

test('push: unknown topics are ignored, friends need a grown-up profile', async () => {
  const res = await call('/api/push')
  assert.equal(res.status, 200)
  const config = await json(res)
  if (!config.enabled) return
  const endpoint = `https://push.example.test/${Date.now()}`
  const subscribe = await call('/api/push', {
    method: 'POST',
    body: JSON.stringify({ subscription: { endpoint, keys: { p256dh: 'x', auth: 'y' } }, topics: ['pick', 'friends', 'nights', 'nonsense'] }),
  })
  try {
    assert.equal(subscribe.status, 200)
    const body = await json(subscribe)
    assert.deepEqual(body.topics, ['pick'], 'a guest device keeps the daily pick only')
  } finally {
    await call('/api/push', { method: 'DELETE', body: JSON.stringify({ endpoint }) })
  }
})

test('home still renders with the new shell', { skip: !hasTmdb && 'no TMDB_API_KEY' }, async () => {
  const res = await fetch(`${BASE}/`)
  assert.equal(res.status, 200)
  const html = await res.text()
  assert.doesNotMatch(html, /Application error/)
})

test('the shell renders on a library page (the "You" tab lights up there)', async () => {
  const res = await fetch(`${BASE}/saved`)
  assert.equal(res.status, 200)
  assert.doesNotMatch(await res.text(), /Application error/)
})
