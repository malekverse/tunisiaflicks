// Unit tests for the shared lists' pure rules (no server, no database):
//   npm run test:unit
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  accessFor, isLive, isWidening, itemKey, livePending, moveItem, pollDelay, reorder, shouldNotifyMember, unreadCount,
  updateBucket, visibilityOf, POLL_STEPS_MS, SEEN_QUIET_MS, UPDATE_BUCKET_MS,
} from '@/src/lib/shared-lists/rules'

const owner = { userId: 'u-owner', profileId: 'p-owner', kids: false }
const sibling = { userId: 'u-owner', profileId: 'p-sibling', kids: false }
const kidsOwnProfile = { userId: 'u-owner', profileId: 'p-owner-kids', kids: true }
const editor = { userId: 'u-editor', profileId: 'p-editor', kids: false }
const friend = { userId: 'u-friend', profileId: 'p-friend', kids: false }
const stranger = { userId: 'u-stranger', profileId: 'p-stranger', kids: false }
const invited = { userId: 'u-invited', profileId: 'p-invited', kids: false }

const listWith = (visibility) => ({
  userId: 'u-owner',
  ...(visibility ? { visibility } : {}),
  members: [{ profileId: 'p-owner', role: 'owner' }, { profileId: 'p-editor', role: 'editor' }],
  pending: [{ profileId: 'p-invited' }],
})
const access = (visibility, viewer, extra = {}) =>
  accessFor({ list: listWith(visibility), ownerProfileId: 'p-owner', viewer, friends: false, blocked: false, ...extra })

test('visibility: a list stored before visibility existed reads as link', () => {
  assert.equal(visibilityOf({}), 'link')
  assert.equal(visibilityOf({ visibility: 'nonsense' }), 'link')
  assert.equal(visibilityOf({ visibility: 'private' }), 'private')
  assert.equal(access(undefined, null), 'viewer', 'a guest with the link sees an old list')
})

test('access: guests see link lists only', () => {
  assert.equal(access('link', null), 'viewer')
  assert.equal(access('friends', null), 'none')
  assert.equal(access('private', null), 'none')
})

test('access: the owner account owns it (every grown-up profile of it), members edit', () => {
  for (const visibility of ['private', 'friends', 'link']) {
    assert.equal(access(visibility, owner), 'owner', visibility)
    assert.equal(access(visibility, sibling), 'owner', `${visibility}: another grown-up profile of the account`)
    assert.equal(access(visibility, editor), 'editor', visibility)
  }
})

test('access: private = the people in it; friends = plus the owner\'s friends; link = anyone', () => {
  assert.equal(access('private', stranger), 'none')
  assert.equal(access('private', friend, { friends: true }), 'none', 'friendship alone opens nothing private')
  assert.equal(access('friends', stranger), 'none')
  assert.equal(access('friends', friend, { friends: true }), 'viewer')
  assert.equal(access('link', stranger), 'viewer')
})

test('access: someone invited (by name or with a working link) may look before joining', () => {
  assert.equal(access('private', invited), 'viewer', 'invited by name')
  assert.equal(access('private', stranger, { invited: true }), 'viewer', 'holds a working link')
})

test('access: a block with the owner hides the list, whatever its visibility', () => {
  for (const visibility of ['private', 'friends', 'link']) {
    assert.equal(access(visibility, stranger, { blocked: true }), 'none', visibility)
    assert.equal(access(visibility, friend, { blocked: true, friends: true }), 'none', visibility)
  }
})

test('access: Kids see only their own profile\'s lists', () => {
  assert.equal(access('link', kidsOwnProfile), 'none', 'not even a sibling profile\'s link list')
  assert.equal(access('private', { ...editor, kids: true }), 'none', 'never a shared list, even one they are in')
  assert.equal(accessFor({ list: listWith('private'), ownerProfileId: 'p-owner-kids', viewer: kidsOwnProfile, friends: false, blocked: false }), 'owner')
})

const items = (keys) => keys.map((key) => { const [media_type, id] = key.split('-'); return { media_type, id, title: key } })
const keys = (list) => list.map(itemKey)

test('moveItem: moves one title, clamps the position, never adds or drops anything', () => {
  const list = items(['movie-1', 'movie-2', 'tv-3', 'movie-4'])
  assert.deepEqual(keys(moveItem(list, 'movie-1', 2)), ['movie-2', 'tv-3', 'movie-1', 'movie-4'])
  assert.deepEqual(keys(moveItem(list, 'movie-4', 0)), ['movie-4', 'movie-1', 'movie-2', 'tv-3'])
  assert.deepEqual(keys(moveItem(list, 'tv-3', 99)), ['movie-1', 'movie-2', 'movie-4', 'tv-3'])
  assert.deepEqual(keys(moveItem(list, 'tv-3', -5)), ['tv-3', 'movie-1', 'movie-2', 'movie-4'])
  assert.equal(moveItem(list, 'movie-9', 0), null)
  assert.deepEqual(keys(list), ['movie-1', 'movie-2', 'tv-3', 'movie-4'], 'the input is untouched')
})

test('moveItem: any sequence of moves stays a permutation', () => {
  let list = items(Array.from({ length: 30 }, (_, index) => `movie-${index + 1}`))
  const all = new Set(keys(list))
  for (let step = 0; step < 200; step++) {
    const key = itemKey(list[(step * 7) % list.length])
    list = moveItem(list, key, (step * 13) % 31) ?? list
  }
  assert.equal(list.length, 30)
  assert.deepEqual(new Set(keys(list)), all)
})

test('reorder: by key, unknown keys ignored, the rest keep their order at the end', () => {
  const list = items(['movie-1', 'movie-2', 'tv-3', 'movie-4'])
  assert.deepEqual(keys(reorder(list, ['tv-3', 'nope', 'movie-1'])), ['tv-3', 'movie-1', 'movie-2', 'movie-4'])
  assert.deepEqual(keys(reorder(list, [])), keys(list))
  assert.deepEqual(keys(reorder(list, ['movie-2', 'movie-2', 42])), ['movie-2', 'movie-1', 'tv-3', 'movie-4'])
})

test('visibility widening: only when more people can see it', () => {
  assert.equal(isWidening('private', 'friends'), true)
  assert.equal(isWidening('friends', 'link'), true)
  assert.equal(isWidening('private', 'link'), true)
  assert.equal(isWidening('link', 'friends'), false)
  assert.equal(isWidening('friends', 'friends'), false)
})

test('notifications: one per 3-hour window; nobody muted or looking right now', () => {
  const now = Date.parse('2026-10-09T12:00:00Z')
  assert.equal(updateBucket(now), updateBucket(now + UPDATE_BUCKET_MS - (now % UPDATE_BUCKET_MS) - 1))
  assert.notEqual(updateBucket(now), updateBucket(now + UPDATE_BUCKET_MS))
  assert.equal(shouldNotifyMember({ muted: true, lastSeenAt: new Date(0) }, now), false)
  assert.equal(shouldNotifyMember({ lastSeenAt: new Date(now - 30_000) }, now), false, 'looked 30s ago')
  assert.equal(shouldNotifyMember({ lastSeenAt: new Date(now - SEEN_QUIET_MS - 1000) }, now), true)
  assert.equal(shouldNotifyMember({}, now), true)
})

test('invitations by name expire after 30 days', () => {
  const now = Date.parse('2026-10-09T12:00:00Z')
  const pending = [{ profileId: 'a', at: new Date(now - 29 * 864e5) }, { profileId: 'b', at: new Date(now - 31 * 864e5) }]
  assert.deepEqual(livePending(pending, now).map((entry) => entry.profileId), ['a'])
  assert.deepEqual(livePending(undefined, now), [])
})

test('unread: titles others added since my last look, still in the list, each once', () => {
  const seen = '2026-10-09T10:00:00Z'
  const later = '2026-10-09T11:00:00Z'
  const earlier = '2026-10-09T09:00:00Z'
  const list = items(['movie-1', 'movie-2', 'movie-3'])
  const activity = [
    { kind: 'add', by: 'sami', at: later, item: { media_type: 'movie', id: '1' } },
    { kind: 'add', by: 'sami', at: later, item: { media_type: 'movie', id: '1' } },
    { kind: 'add', by: 'me', at: later, item: { media_type: 'movie', id: '2' } },
    { kind: 'add', by: 'amel', at: earlier, item: { media_type: 'movie', id: '3' } },
    { kind: 'add', by: 'amel', at: later, item: { media_type: 'movie', id: '9' } },
    { kind: 'move', by: 'amel', at: later, item: { media_type: 'movie', id: '3' } },
  ]
  assert.equal(unreadCount(activity, list, 'me', seen), 1)
  assert.equal(unreadCount(activity, list, 'me', null), 0, 'never looked: nothing counts as new')
})

test('polling: 6s, then 20s, then a minute while nothing changes; only lists worth watching', () => {
  assert.equal(pollDelay(0), POLL_STEPS_MS[0])
  assert.equal(pollDelay(4), 6_000)
  assert.equal(pollDelay(5), 20_000)
  assert.equal(pollDelay(10), 20_000)
  assert.equal(pollDelay(11), 60_000)
  assert.equal(pollDelay(500), 60_000)
  assert.equal(isLive({ memberCount: 1, pendingCount: 0 }), false)
  assert.equal(isLive({ memberCount: 2, pendingCount: 0 }), true)
  assert.equal(isLive({ memberCount: 1, pendingCount: 1 }), true)
})
