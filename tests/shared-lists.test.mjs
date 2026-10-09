// Smoke tests for shared lists against a running server (BASE_URL, default :3000): what a guest
// gets from every lists API, that a list nobody may see answers exactly like one that doesn't
// exist (API, ?v= polling and page), and that a list stored before visibility existed is still
// open to anyone with its link. With a LOCAL MONGODB_URI (127.0.0.1/localhost) it also stores two
// lists to check that; otherwise those tests are skipped. Signed-in flows and concurrency live in
// scripts/shared-lists-concurrency.mjs.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'

const BASE = (process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
const LOCAL_DB = /^mongodb:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(process.env.MONGODB_URI ?? '') ? process.env.MONGODB_URI : null

const call = (path, init) => fetch(BASE + path, { redirect: 'manual', ...init, headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) } })
const slug = () => randomBytes(8).toString('base64url')

async function json(res) {
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    assert.fail(`not JSON: ${text.slice(0, 120)}`)
  }
}

test('guest: every lists API that needs an account answers 401 {error, code}', async () => {
  const s = slug()
  const routes = [
    ['GET', '/api/lists'],
    ['GET', '/api/lists?editable=1&contains=movie-550'],
    ['POST', '/api/lists', { title: 'x' }],
    ['PATCH', `/api/lists/${s}`, { title: 'x' }],
    ['DELETE', `/api/lists/${s}`],
    ['GET', `/api/lists/${s}/collaborators`],
    ['POST', `/api/lists/${s}/collaborators`, { token: 'A'.repeat(22) }],
    ['POST', `/api/lists/${s}/collaborators`, { invite: 'link' }],
    ['POST', `/api/lists/${s}/collaborators`, { to: ['amine'] }],
    ['DELETE', `/api/lists/${s}/collaborators?member=abc`],
    ['PATCH', `/api/lists/${s}/collaborators`, { muted: true }],
    ['POST', `/api/lists/${s}/seen`, {}],
  ]
  for (const [method, path, body] of routes) {
    const res = await call(path, { method, body: body ? JSON.stringify(body) : undefined })
    assert.equal(res.status, 401, `${method} ${path} -> ${res.status}`)
    const data = await json(res)
    assert.equal(data.code, 'unauthorized', `${method} ${path}`)
    assert.match(res.headers.get('cache-control') ?? '', /no-store/, `${method} ${path} is never cached`)
  }
})

test('a random slug is 404 with a neutral answer, polling included', async () => {
  for (const path of [`/api/lists/${slug()}`, `/api/lists/${slug()}?v=0`, '/api/lists/..%2F..%2Fetc', '/api/lists/x']) {
    const res = await call(path)
    assert.equal(res.status, 404, path)
    assert.deepEqual(await json(res), { error: 'List not found', code: 'not_found' }, path)
  }
})

test('a random list page is 404, with or without an invitation token', async () => {
  for (const path of [`/lists/${slug()}`, `/lists/${slug()}?invite=${'A'.repeat(22)}`, `/lists/${slug()}?invite=garbage`]) {
    const res = await call(path, { headers: { accept: 'text/html' } })
    assert.equal(res.status, 404, path)
  }
})

test('stored lists: friends-only is 404 to a guest (also ?v= and the page); an old list reads as link', { skip: !LOCAL_DB && 'needs a local MONGODB_URI' }, async () => {
  const { MongoClient } = await import('mongodb')
  const client = await new MongoClient(LOCAL_DB).connect()
  const lists = client.db().collection('lists')
  const friends = `smk${slug()}`
  const legacy = `smk${slug()}`
  const item = { id: '550', media_type: 'movie', title: 'Fight Club', poster_path: null, added_at: new Date() }
  try {
    await lists.insertMany([
      { slug: friends, userId: '000000000000000000000001', ownerProfileId: '000000000000000000000002', ownerName: 'Smoke', title: 'Friends only', description: '', items: [item], visibility: 'friends', members: [], version: 3, createdAt: new Date(), updatedAt: new Date() },
      { slug: legacy, userId: '000000000000000000000001', ownerName: 'Smoke', title: 'From before', description: '', items: [item], createdAt: new Date(), updatedAt: new Date() },
    ])
    for (const path of [`/api/lists/${friends}`, `/api/lists/${friends}?v=3`, `/api/lists/${friends}?v=0`]) {
      const res = await call(path)
      assert.equal(res.status, 404, path)
      assert.deepEqual(await json(res), { error: 'List not found', code: 'not_found' }, `${path} looks like a missing list`)
    }
    assert.equal((await call(`/lists/${friends}`, { headers: { accept: 'text/html' } })).status, 404, 'the page too')

    const old = await call(`/api/lists/${legacy}`)
    assert.equal(old.status, 200)
    const body = await json(old)
    assert.equal(body.list.visibility, 'link')
    assert.equal(body.list.role, 'viewer')
    assert.equal(body.list.ownerName, 'Smoke')
    assert.deepEqual(body.list.members, [], 'a guest never sees who is in a list')
    assert.equal((await call(`/api/lists/${legacy}?v=0`)).status, 204, 'unchanged since version 0')
  } finally {
    await lists.deleteMany({ slug: { $in: [friends, legacy] } })
    await client.close()
  }
})
