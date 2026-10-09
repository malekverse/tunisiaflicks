#!/usr/bin/env node
// Shared lists under concurrency, against a running server and a LOCAL test database:
//
//   node --env-file=.env.local scripts/shared-lists-concurrency.mjs --uri mongodb://127.0.0.1:27017/<test_db> [--base http://localhost:3000]
//
// It creates two throwaway accounts (and a third, a stranger), signs them in with session cookies
// minted with NEXTAUTH_SECRET (the server's), and checks:
//   1. an invitation link lets the second account join as an editor (a garbage token: 404/410);
//   2. 40 parallel adds by both people: all 40 land, no duplicates;
//   3. 101 adds to another list by both people (90 a few at a time, then the last 11 all at once,
//      so the race happens at the cap): exactly 100 land, the extra one answers 400 'full';
//   4. 20 parallel moves by both people: the list is still a permutation of the same 100 titles;
//   5. handing the list over makes the editor its owner and the owner an editor;
//   6. a list stored before visibility existed reads as 'link' (anyone with the link sees it);
//   7. a 'friends' list is 404 for a stranger, ?v= included; a random slug is 404.
// Everything it created is deleted at the end (also when a check fails). TMDB_API_KEY is used to
// pick real titles (the server reads every added title back from TMDB). Exit code 1 on failure.
import { createRequire } from 'node:module'
import { randomBytes } from 'node:crypto'
import { MongoClient, ObjectId } from 'mongodb'

const require = createRequire(import.meta.url)
const { encode } = require('next-auth/jwt')

const args = process.argv.slice(2)
const arg = (name) => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined }
const uri = arg('--uri')
const BASE = (arg('--base') ?? process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
if (!uri || !/^mongodb:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(uri)) {
  console.error('Usage: node --env-file=.env.local scripts/shared-lists-concurrency.mjs --uri mongodb://127.0.0.1:27017/<test db> [--base http://localhost:3000]')
  console.error('Only a local database is accepted.')
  process.exit(1)
}
if (!process.env.NEXTAUTH_SECRET || !process.env.TMDB_API_KEY) {
  console.error('NEXTAUTH_SECRET and TMDB_API_KEY must be set (the server\'s values): use --env-file=.env.local')
  process.exit(1)
}

const client = await new MongoClient(uri).connect()
const db = client.db()
const run = randomBytes(3).toString('hex')
const created = { users: [], slugs: [] }
let failures = 0
const check = (ok, label, detail = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? `  (${detail})` : ''}`)
  if (!ok) failures++
}

async function account(name) {
  const _id = new ObjectId()
  const profile = new ObjectId().toHexString()
  const email = `lists-${run}-${name.toLowerCase()}@example.test`
  await db.collection('users').insertOne({ _id, email, name: `${name} Concurrency`, emailVerified: new Date(), profiles: [{ id: profile, name, color: '#0ea5e9', kids: false, createdAt: new Date() }] })
  created.users.push(_id)
  const token = await encode({ token: { id: String(_id), email, name, loginAt: Date.now(), sub: String(_id) }, secret: process.env.NEXTAUTH_SECRET, maxAge: 3600 })
  return { _id, profile, cookie: `next-auth.session-token=${token}; tf_profile=${profile}` }
}

async function call(who, method, path, body) {
  const response = await fetch(BASE + path, {
    method,
    headers: { 'content-type': 'application/json', ...(who ? { cookie: who.cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(600_000),
  })
  const text = await response.text()
  let json = null
  try { json = text ? JSON.parse(text) : null } catch { json = { raw: text.slice(0, 200) } }
  return { status: response.status, body: json }
}

/** Real titles: TMDB's popular movies (the server checks every added title against TMDB). */
async function titles(count) {
  const out = []
  for (let page = 1; out.length < count && page <= 12; page++) {
    const data = await fetch(`https://api.themoviedb.org/3/movie/popular?page=${page}&api_key=${process.env.TMDB_API_KEY}`).then((r) => r.json())
    for (const movie of data.results ?? []) if (!out.some((entry) => entry.id === String(movie.id))) out.push({ media_type: 'movie', id: String(movie.id), title: movie.title, poster_path: movie.poster_path })
  }
  return out.slice(0, count)
}

const keyOf = (item) => `${item.media_type}-${item.id}`

/** 'status:code' counts, to say what went wrong when something did. */
const tally = (results) => Object.entries(results.reduce((counts, result) => {
  const key = `${result.status}${result.body?.code ? `:${result.body.code}` : ''}`
  counts[key] = (counts[key] ?? 0) + 1
  return counts
}, {})).map(([key, count]) => `${key}=${count}`).join(' ')

/** Runs `tasks` (functions returning promises) `width` at a time, in order. */
async function inBatches(tasks, width) {
  const out = []
  for (let index = 0; index < tasks.length; index += width) out.push(...await Promise.all(tasks.slice(index, index + width).map((task) => task())))
  return out
}

try {
  const owner = await account('Owner')
  const editor = await account('Editor')
  const stranger = await account('Stranger')
  const pool = await titles(141)
  check(pool.length === 141, 'picked 141 titles from TMDB', String(pool.length))

  // 1. An invitation link, and joining with it.
  const made = await call(owner, 'POST', '/api/lists', { title: `Concurrency ${run}` })
  check(made.status === 201 && made.body?.list?.visibility === 'private', 'a new list is private', `${made.status} ${made.body?.list?.visibility}`)
  const slug = made.body.list.slug
  created.slugs.push(slug)
  const garbage = await call(editor, 'POST', `/api/lists/${slug}/collaborators`, { token: 'not-a-real-token-xxxxxx' })
  check(garbage.status === 404 || garbage.status === 410, 'a garbage token is 404 or 410', String(garbage.status))
  const link = await call(owner, 'POST', `/api/lists/${slug}/collaborators`, { invite: 'link' })
  check(link.status === 201 && typeof link.body?.url === 'string', 'the owner makes an invitation link', String(link.status))
  const token = new URL(link.body.url, BASE).searchParams.get('invite')
  const joined = await call(editor, 'POST', `/api/lists/${slug}/collaborators`, { token })
  check(joined.status === 200 && joined.body?.joined === true, 'the link lets the editor join', `${joined.status} ${JSON.stringify(joined.body)}`)
  const editorView = await call(editor, 'GET', `/api/lists/${slug}`)
  check(editorView.body?.list?.role === 'editor', 'the editor is an editor', editorView.body?.list?.role)

  // 2. 40 parallel adds, by both people.
  const forty = pool.slice(0, 40)
  const adds = await Promise.all(forty.map((item, index) => call(index % 2 ? editor : owner, 'PATCH', `/api/lists/${slug}`, { add: { media_type: item.media_type, id: item.id } })))
  check(adds.every((result) => result.status === 200), '40 parallel adds all answer 200', tally(adds))
  const after40 = (await call(owner, 'GET', `/api/lists/${slug}`)).body.list
  const keys40 = after40.items.map(keyOf)
  check(after40.items.length === 40 && new Set(keys40).size === 40 && forty.every((item) => keys40.includes(keyOf(item))), '40 titles in the list, each once', String(after40.items.length))

  // 3. 101 adds: capped at 100. The last 11 race for the last 10 places.
  const big = await call(owner, 'POST', '/api/lists', { title: `Cap ${run}` })
  const bigSlug = big.body.list.slug
  created.slugs.push(bigSlug)
  const bigLink = await call(owner, 'POST', `/api/lists/${bigSlug}/collaborators`, { invite: 'link' })
  const bigJoin = await call(editor, 'POST', `/api/lists/${bigSlug}/collaborators`, { token: new URL(bigLink.body.url, BASE).searchParams.get('invite') })
  check(bigJoin.status === 200 && bigJoin.body?.joined === true, 'the editor joins the second list too', `${bigJoin.status} ${JSON.stringify(bigJoin.body)}`)
  const hundredOne = pool.slice(40, 141)
  const addTo = (item, index) => () => call(index % 2 ? editor : owner, 'PATCH', `/api/lists/${bigSlug}`, { add: { media_type: item.media_type, id: item.id } })
  const first90 = await inBatches(hundredOne.slice(0, 90).map(addTo), 15)
  const last11 = await Promise.all(hundredOne.slice(90).map((item, index) => addTo(item, 90 + index)()))
  const capped = [...first90, ...last11]
  const full = capped.filter((result) => result.status === 400 && result.body?.code === 'full').length
  const afterCap = (await call(owner, 'GET', `/api/lists/${bigSlug}`)).body.list
  check(afterCap.items.length === 100, '101 adds: exactly 100 titles', String(afterCap.items.length))
  check(full === 1 && capped.filter((result) => result.status === 200).length === 100, 'one add answers 400 full, 100 answer 200', tally(capped))

  // 4. 20 parallel moves: still a permutation.
  const before = afterCap.items.map(keyOf)
  const moves = await Promise.all(Array.from({ length: 20 }, (_, index) => {
    const key = before[(index * 7) % before.length]
    return call(index % 2 ? editor : owner, 'PATCH', `/api/lists/${bigSlug}`, { move: { key, to: (index * 13) % before.length } })
  }))
  const moved = moves.filter((result) => result.status === 200).length
  const conflicts = moves.filter((result) => result.status === 409 && result.body?.list).length
  check(moved + conflicts === 20, '20 moves answer 200, or 409 with the list', tally(moves))
  const afterMoves = (await call(owner, 'GET', `/api/lists/${bigSlug}`)).body.list.items.map(keyOf)
  check(afterMoves.length === 100 && new Set(afterMoves).size === 100 && before.every((key) => afterMoves.includes(key)), 'after 20 moves: the same 100 titles, each once')

  // 5. Handing the list over.
  const people = await call(owner, 'GET', `/api/lists/${slug}/collaborators`)
  const heir = people.body?.members?.find((member) => member.role === 'editor')
  const handed = await call(owner, 'PATCH', `/api/lists/${slug}/collaborators`, { member: heir?.id, role: 'owner' })
  check(handed.status === 200, 'the owner hands the list over', String(handed.status))
  const asNewOwner = (await call(editor, 'GET', `/api/lists/${slug}`)).body?.list
  const asOldOwner = (await call(owner, 'GET', `/api/lists/${slug}`)).body?.list
  check(asNewOwner?.role === 'owner' && asOldOwner?.role === 'editor', 'roles swapped', `${asNewOwner?.role}/${asOldOwner?.role}`)
  const stored = await db.collection('lists').findOne({ slug })
  check(stored?.userId === String(editor._id) && stored?.ownerProfileId === editor.profile, 'the list now belongs to the new owner\'s account and profile')

  // 6. A list from before visibility existed reads as 'link'.
  const legacySlug = `legacy${run}`
  await db.collection('lists').insertOne({ slug: legacySlug, userId: String(owner._id), ownerName: 'Owner', title: 'Old list', description: '', items: [{ ...pool[0], added_at: new Date() }], createdAt: new Date(), updatedAt: new Date() })
  created.slugs.push(legacySlug)
  const legacy = await call(null, 'GET', `/api/lists/${legacySlug}`)
  check(legacy.status === 200 && legacy.body?.list?.visibility === 'link', 'an old list reads as link (a guest sees it)', `${legacy.status} ${legacy.body?.list?.visibility}`)

  // 7. 'friends' is 404 for a stranger, ?v= included; so is a random slug.
  await call(owner, 'PATCH', `/api/lists/${bigSlug}`, { visibility: 'friends' })
  const version = (await call(owner, 'GET', `/api/lists/${bigSlug}`)).body.list.version
  const strangerGet = await call(stranger, 'GET', `/api/lists/${bigSlug}`)
  const strangerPoll = await call(stranger, 'GET', `/api/lists/${bigSlug}?v=${version}`)
  const guestPoll = await call(null, 'GET', `/api/lists/${bigSlug}?v=${version}`)
  check(strangerGet.status === 404 && strangerPoll.status === 404 && guestPoll.status === 404, "a 'friends' list is 404 for a stranger and a guest, ?v= too", `${strangerGet.status}/${strangerPoll.status}/${guestPoll.status}`)
  const memberPoll = await call(editor, 'GET', `/api/lists/${bigSlug}?v=${version}`)
  check(memberPoll.status === 204, 'a member polling an unchanged list gets 204', String(memberPoll.status))
  const random = await call(stranger, 'GET', `/api/lists/${randomBytes(8).toString('base64url')}`)
  check(random.status === 404 && random.body?.code === 'not_found', 'a random slug is 404, the same answer', String(random.status))
} catch (error) {
  failures++
  console.error('FAIL (error)', error)
} finally {
  await db.collection('lists').deleteMany({ $or: [{ slug: { $in: created.slugs } }, { userId: { $in: created.users.map(String) } }] })
  await db.collection('invites').deleteMany({ targetId: { $in: created.slugs } })
  await db.collection('notifications').deleteMany({ userId: { $in: created.users.map(String) } })
  await db.collection('users').deleteMany({ _id: { $in: created.users } })
  await client.close()
}
console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed')
process.exit(failures ? 1 : 0)
