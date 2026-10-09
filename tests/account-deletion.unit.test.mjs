// Deleting an account, or one profile, leaves nothing that points at it: a throwaway account is
// seeded in every collection the features write to (next to a second account that shares a list
// and movie nights with it), deleted with the app's own functions, and then every document in the
// database is searched for its ids. Runs only against a local MongoDB (MONGODB_URI on 127.0.0.1 or
// localhost), in a database of its own that is dropped afterwards.
import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'

const LOCAL = (() => {
  if (!process.env.MONGODB_URI) return false
  try {
    const url = new URL(process.env.MONGODB_URI)
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) return false
    url.pathname = `/tf_unit_account_${process.pid}`
    process.env.MONGODB_URI = url.toString()
    return true
  } catch {
    return false
  }
})()

const hex = (bytes) => randomBytes(bytes).toString('hex')
const DAY = 24 * 60 * 60 * 1000

describe('account deletion', { skip: !LOCAL && 'needs MONGODB_URI on a local MongoDB' }, () => {
  let db, ObjectId
  const A = { id: null, grown: hex(12), kids: hex(12) }
  const B = { id: null, profile: hex(12) }

  before(async () => {
    ;({ ObjectId } = await import('mongodb'))
    db = (await (await import('@/src/lib/mongodb')).default).db()
    A.id = String(new ObjectId())
    B.id = String(new ObjectId())
  })

  after(async () => {
    if (db) await db.dropDatabase()
    const client = await (await import('@/src/lib/mongodb')).default
    await client.close()
  })

  async function seed() {
    const now = new Date()
    const a = { userId: A.id, profileId: A.grown }
    const b = { userId: B.id, profileId: B.profile }
    await db.collection('users').insertMany([
      { _id: new ObjectId(A.id), email: `a-${A.id}@example.test`, name: 'Amel', supportCode: 'TF-AAAA', profiles: [{ id: A.grown, name: 'Amel' }, { id: A.kids, name: 'Kid', kids: true }] },
      { _id: new ObjectId(B.id), email: `b-${B.id}@example.test`, name: 'Bilel', profiles: [{ id: B.profile, name: 'Bilel' }] },
    ])
    await db.collection('userContent').insertOne({ userId: A.id, profileId: A.grown, type: 'favorite', id: 550 })
    await db.collection('notifications').insertOne({ userId: A.id, profileId: A.grown, created_at: now })
    await db.collection('pushSubscriptions').insertOne({ userId: A.id, endpoint: 'https://push.example.test/1' })
    // A list A owns that B helps build (goes to B), and a list only A uses (deleted).
    const member = (ref, role) => ({ id: hex(6), ...ref, role, joinedAt: now, lastSeenAt: now })
    await db.collection('lists').insertMany([
      {
        slug: `shared${hex(3)}`, userId: A.id, ownerName: 'Amel', ownerProfileId: A.grown, title: 'Shared', description: '', visibility: 'private', version: 1,
        items: [{ id: '550', media_type: 'movie', title: 'Fight Club', added_at: now, by: A.grown }, { id: '603', media_type: 'movie', title: 'The Matrix', added_at: now, by: B.profile }],
        members: [member(a, 'owner'), member(b, 'editor')], pending: [], activity: [{ id: hex(4), at: now, kind: 'add', by: A.grown }],
        createdAt: new Date(now.getTime() - DAY), updatedAt: now,
      },
      { slug: `alone${hex(3)}`, userId: A.id, ownerName: 'Amel', ownerProfileId: A.grown, title: 'Mine', description: '', items: [], createdAt: now, updatedAt: now },
    ])
    // A night A hosts with B invited, and one B hosts where A voted.
    const night = (id, host, guest, votes) => ({
      _id: id, version: 1, rev: 1, host, title: 'Friday', starts_at: new Date(now.getTime() + 2 * DAY), ends_at: new Date(now.getTime() + 2 * DAY + 3 * 3600e3), tz: 'Africa/Tunis',
      place: '', note: '', guests: [{ ref: guest, status: 'going', invited_at: now, responded_at: now, via: 'host' }], declined: [], candidates: [],
      votes, vote_at: Object.fromEntries(Object.keys(votes).map((key) => [key, now])), vote_closes_at: new Date(now.getTime() + DAY), vote_closed_at: null,
      chosen: null, chosen_by: null, chosen_at: null, room: null, status: 'planned', cancelled_at: null, reminded: { day: false, hour: false },
      created_at: now, updated_at: now, expires_at: new Date(now.getTime() + 20 * DAY),
    })
    await db.collection('movieNights').insertMany([
      night('AAAAAAAAA2', a, b, {}),
      night('BBBBBBBBB2', b, a, { [A.grown]: 'movie:550' }),
    ])
    // Friends, the digest, badges and support, a signed-in TV.
    await db.collection('socialProfiles').insertOne({ _id: A.grown, userId: A.id, handle: 'amel_t' })
    await db.collection('handles').insertOne({ _id: 'amel_t', userId: A.id, profileId: A.grown })
    await db.collection('friendships').insertOne({ _id: `${A.grown}:${B.profile}`, users: [A.id, B.id], profiles: [A.grown, B.profile] })
    await db.collection('ratings').insertOne({ userId: A.id, profileId: A.grown, key: 'movie:550', value: 5 })
    await db.collection('digestPrefs').insertOne({ _id: A.grown, userId: A.id, enabled: true })
    await db.collection('digestDeliveries').insertOne({ userId: A.id, profileId: A.grown, at: now })
    await db.collection('badges').insertMany([{ _id: A.grown, userId: A.id }, { _id: A.kids, userId: A.id }])
    await db.collection('watchActivity').insertOne({ _id: `${A.grown}:2026-10`, userId: A.id, profileId: A.grown, days: {} })
    await db.collection('supporters').insertOne({ _id: A.id, since: now })
    await db.collection('supportEvents').insertOne({ _id: hex(8), userId: A.id, at: now })
    await db.collection('tvSessions').insertMany([
      { _id: hex(16), userId: A.id, profileId: A.grown, deviceLabel: 'android-tv', createdAt: now, lastSeenAt: now, revokedAt: null },
      { _id: hex(16), userId: A.id, profileId: A.kids, deviceLabel: 'other', createdAt: now, lastSeenAt: now, revokedAt: null },
    ])
  }

  /** Every document (outside B's own user document) that still mentions one of `needles`. */
  async function mentions(needles) {
    const found = []
    for (const { name } of await db.listCollections().toArray()) {
      if (name.startsWith('system.')) continue
      for (const doc of await db.collection(name).find({}).toArray()) {
        const text = JSON.stringify(doc)
        const hit = needles.find((needle) => text.includes(needle))
        if (hit) found.push({ collection: name, id: String(doc._id), hit })
      }
    }
    return found
  }

  test('a deleted profile leaves no trace, and the account keeps its other profile', async () => {
    await seed()
    const { onProfileRemovedFromLists } = await import('@/src/lib/shared-lists/account')
    const { forgetProfileInNights } = await import('@/src/lib/movie-night')
    const { deleteBadgeData } = await import('@/src/lib/badges/view')
    const { revokeTvSessionsForProfile } = await import('@/src/lib/tv-sessions')
    // The same order as DELETE /api/profiles/[id] (the social and digest parts are covered by their own tests).
    await onProfileRemovedFromLists(A.id, A.kids)
    await forgetProfileInNights(A.id, A.kids)
    await deleteBadgeData(A.id, A.kids)
    await revokeTvSessionsForProfile(A.id, A.kids)
    assert.equal(await db.collection('badges').countDocuments({ _id: A.kids }), 0)
    assert.equal(await db.collection('badges').countDocuments({ _id: A.grown }), 1)
    assert.equal(await db.collection('tvSessions').countDocuments({ profileId: A.kids, revokedAt: null }), 0)
    assert.equal(await db.collection('tvSessions').countDocuments({ profileId: A.grown, revokedAt: null }), 1)
  })

  test('a deleted account leaves no document that names it; what it shared goes to the others', async () => {
    const { deleteUserData, exportUserData } = await import('@/src/lib/account')
    // The export first: it must not carry the other account's ids.
    const exported = JSON.stringify(await exportUserData(A.id))
    assert.ok(!exported.includes(B.id), 'the export carries the other account id')
    assert.ok(!exported.includes(B.profile), 'the export carries the other profile id')

    await deleteUserData(A.id)
    assert.deepEqual(await mentions([A.id, A.grown, A.kids]), [])

    const shared = await db.collection('lists').findOne({ title: 'Shared' })
    assert.ok(shared, 'the list B helps build survives')
    assert.equal(shared.userId, B.id)
    assert.equal(shared.ownerProfileId, B.profile)
    assert.equal(await db.collection('lists').countDocuments({ title: 'Mine' }), 0)

    const hosted = await db.collection('movieNights').findOne({ _id: 'AAAAAAAAA2' })
    assert.ok(!hosted || hosted.status === 'cancelled', 'the night A hosted is cancelled or gone')
    const guestOf = await db.collection('movieNights').findOne({ _id: 'BBBBBBBBB2' })
    assert.ok(guestOf, 'B\'s night survives')
    assert.equal(guestOf.guests.length, 0)
    assert.deepEqual(guestOf.votes, {})
  })
})
