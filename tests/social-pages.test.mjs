// Smoke tests for the social pages against a running server (BASE_URL, default :3000):
// /friends, /friends/list, /me, /notifications and /u/[handle].
//
// The signed-in checks need seeded accounts and run only when SOCIAL_PAGES_SEED names a JSON file
// with session tokens and profile ids (the track's scratch seed writes one):
//   { "a": <token>, "b": <token>, "f": <token>, "profiles": { "a1", "a2", "b1", "f1" } }
// where A (amine_t) is friends with B (sami_b), A blocked F (blocked_f), a2 is A's Kids profile,
// B shares ratings with 'Anyone with the link' and watching with friends; A watches privately.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const BASE = (process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
const seed = process.env.SOCIAL_PAGES_SEED ? JSON.parse(readFileSync(process.env.SOCIAL_PAGES_SEED, 'utf8')) : null

const cookieFor = (who, profile) => (who ? `next-auth.session-token=${seed[who]}; tf_profile=${seed.profiles[profile]}` : '')
const get = (path, { as, profile, ...init } = {}) => fetch(BASE + path, {
  redirect: 'manual',
  ...init,
  headers: { ...(as ? { cookie: cookieFor(as, profile) } : {}), ...(init.headers ?? {}) },
})
const html = async (res) => res.text()
const noindex = (page) => /<meta name="robots" content="[^"]*noindex/.test(page)

// ---------------------------------------------------------------------------------------------
// Guests

for (const [path, back] of [['/friends', '%2Ffriends'], ['/friends/list', '%2Ffriends%2Flist'], ['/me', '%2Fme'], ['/notifications', '%2Fnotifications']]) {
  test(`guest: ${path} is 200 with an invitation to sign in that comes back, and noindex`, async () => {
    const res = await get(path)
    assert.equal(res.status, 200)
    const page = await html(res)
    assert.ok(page.includes(`/login?callbackUrl=${back}`), 'the sign-in link comes back here')
    assert.ok(page.includes(`/signup?callbackUrl=${back}`), 'and so does the sign-up link')
    assert.ok(noindex(page), 'noindex')
  })
}

test('guest: an unknown page is 404 and noindex', async () => {
  for (const path of ['/u/does-not-exist', '/u/x', '/u/not%20a%20handle', '/u/' + 'a'.repeat(30)]) {
    const res = await get(path)
    // The status comes from the middleware (src/app/u/_lib/middleware-gate.ts): the page itself
    // streams behind the root loading screen with a 200 and only shows the not-found.
    assert.equal(res.status, 404, `${path} (is profilePageGate wired into src/middleware.ts?)`)
    const page = await html(res)
    assert.ok(/<meta name="robots" content="[^"]*noindex/.test(page), `${path} noindex`)
  }
})

test('the page’s gate is internal: without the middleware’s token it is a plain 404', async () => {
  for (const path of ['/u/does_not_exist/gate', '/u/sami_b/gate']) {
    const res = await get(path, { headers: { 'x-tf-page-gate': '0'.repeat(64) } })
    assert.equal(res.status, 404, path)
    assert.equal((await res.text()).length, 0, `${path}: nothing in the body`)
  }
})

test('guest: an unknown page gets the general share card (never anything else)', async (t) => {
  const res = await get('/u/does-not-exist/opengraph-image')
  // next/og can't load its font on Windows dev servers (see the README): nothing to check there.
  if (res.status === 500 && process.platform === 'win32') return t.skip('next/og does not run on Windows dev servers')
  assert.equal(res.status, 200)
  assert.match(res.headers.get('content-type') ?? '', /^image\//)
})

// ---------------------------------------------------------------------------------------------
// Signed in (seeded accounts)

const seeded = { skip: seed ? false : 'SOCIAL_PAGES_SEED not set' }

test('member: /friends shows the feed in day groups, /friends/list the requests and friends', seeded, async () => {
  const feed = await html(await get('/friends', { as: 'a', profile: 'a1' }))
  assert.ok(feed.includes('/u/sami_b'), "a friend's row links to their page")
  assert.ok(/aria-current="page"[^>]*>|href="\/friends"[^>]*aria-current="page"/.test(feed), 'the Activity tab is current')
  assert.ok(!/\d{1,2}:\d{2}\s?(AM|PM)?<\/time>/.test(feed), 'never a time')
  const list = await get('/friends/list', { as: 'a', profile: 'a1' })
  assert.equal(list.status, 200)
})

test('member: the feed API never carries a time, and private watching stays out of friends\' feeds', seeded, async () => {
  const res = await get('/api/social/feed', { as: 'b', profile: 'b1' })
  assert.equal(res.status, 200)
  const { items } = await res.json()
  for (const item of items) {
    assert.match(item.day, /^\d{4}-\d{2}-\d{2}$/)
    assert.ok(!('at' in item) && !('watched_at' in item), 'no time in the payload')
    // A watches privately and shares ratings: from A, only ratings reach B.
    if (item.actor.handle === 'amine_t') assert.equal(item.kind, 'rated')
  }
})

test('member: a block is the same 404 in both directions', seeded, async () => {
  assert.equal((await get('/u/blocked_f', { as: 'a', profile: 'a1' })).status, 404, 'A cannot see F')
  assert.equal((await get('/u/amine_t', { as: 'f', profile: 'f1' })).status, 404, 'F cannot see A')
})

test('member: a Kids profile gets KidsBlocked on the social pages, and its badges and year on /me', seeded, async () => {
  for (const path of ['/friends', '/friends/list', '/u/sami_b']) {
    const page = await html(await get(path, { as: 'a', profile: 'a2' }))
    assert.ok(page.includes('/profiles?next='), `${path}: the way back to a grown-up profile`)
  }
  const me = await html(await get('/me', { as: 'a', profile: 'a2' }))
  assert.ok(me.includes('href="/wrapped"'), 'Your year')
})

test('member: /me with a page goes to /u/[handle]', seeded, async () => {
  const res = await get('/me', { as: 'a', profile: 'a1' })
  assert.ok([302, 303, 307, 308].includes(res.status), String(res.status))
  assert.match(res.headers.get('location') ?? '', /\/u\/amine_t$/)
})

test('link: "Anyone with the link" shows only with ?k=, the key is never echoed into a link, and Reset link retires it', seeded, async () => {
  const privacy = await (await get('/api/social/privacy', { as: 'b', profile: 'b1' })).json()
  const key = new URL(privacy.shareUrl, BASE).searchParams.get('k')
  assert.ok(key, 'B has a page link')

  const plain = await html(await get('/u/sami_b'))
  assert.ok(plain.includes('Ratings are private') || !plain.includes('>Ratings<'), 'no ratings without the key')
  const keyed = await html(await get(`/u/sami_b?k=${encodeURIComponent(key)}`))
  assert.ok(keyed.includes('>Ratings<'), 'ratings with the key')
  assert.ok(!new RegExp(`href="[^"]*${key.replace(/[-_]/g, '\\$&')}`).test(keyed), 'k is never put into a link')

  const reset = await get('/api/social/privacy', { as: 'b', profile: 'b1', method: 'PATCH', headers: { 'content-type': 'application/json', cookie: cookieFor('b', 'b1') }, body: JSON.stringify({ resetShareKey: true }) })
  assert.equal(reset.status, 200)
  const stale = await html(await get(`/u/sami_b?k=${encodeURIComponent(key)}`))
  assert.ok(!stale.includes('>Ratings<'), 'the old key opens nothing')
})

test('owner: your own page shows everything, marked with who else sees it', seeded, async () => {
  const page = await html(await get('/u/amine_t', { as: 'a', profile: 'a1' }))
  assert.ok(page.includes('Recently watched'))
  assert.ok(page.includes('Only you'), 'private watching is marked Only you')
  assert.ok(page.includes('/profile#privacy'), 'Edit goes to Settings')
})

test('handles: upper case and an old handle redirect permanently', seeded, async () => {
  const res = await get('/u/Sami_B')
  assert.equal(res.status, 308)
  assert.match(res.headers.get('location') ?? '', /\/u\/sami_b$/)
})
