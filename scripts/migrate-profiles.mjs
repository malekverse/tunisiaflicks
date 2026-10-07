#!/usr/bin/env node
// One-off, idempotent migration to viewer profiles.
//
//   node scripts/migrate-profiles.mjs --uri "mongodb://127.0.0.1:27017/some_db"           (dry run)
//   node scripts/migrate-profiles.mjs --uri "mongodb://127.0.0.1:27017/some_db" --apply   (write)
//
// For every user without profiles it creates their default profile (named after them), then moves
// every userContent list without a `profileId` (favorites / saved / history) to that user's first
// profile. If the profile already has a list of that type, the two are merged (newest entry per
// title wins), so nothing is lost. Re-running it changes nothing. The app does the same lazily on
// first use (src/lib/profiles.ts), so running this is optional, but it settles everyone at once.
//
// The URI must be passed explicitly (no .env loading) so it is never run against production by accident.
import { MongoClient, ObjectId } from 'mongodb'

const args = process.argv.slice(2)
const uriIndex = args.indexOf('--uri')
const uri = uriIndex >= 0 ? args[uriIndex + 1] : undefined
const apply = args.includes('--apply')
if (!uri) {
  console.error('Usage: node scripts/migrate-profiles.mjs --uri <mongodb uri with database> [--apply]')
  process.exit(1)
}

const DEFAULT_COLOR = '#dc2626'

const firstName = (name) => {
  const value = String(name ?? '').split(' ')[0].replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 20)
  return value || 'Me'
}

const stamp = (item) => new Date(item?.watched_at ?? item?.added_at ?? 0).getTime() || 0

/** Union of two item arrays, one entry per title (the most recent), newest first. */
function mergeItems(a = [], b = []) {
  const byId = new Map()
  for (const item of [...a, ...b]) {
    const key = `${item.media_type}-${item.id}`
    const current = byId.get(key)
    if (!current || stamp(item) > stamp(current)) byId.set(key, item)
  }
  return [...byId.values()].sort((x, y) => stamp(y) - stamp(x))
}

const client = new MongoClient(uri)
await client.connect()
const db = client.db()
const users = db.collection('users')
const lists = db.collection('userContent')

const report = {
  database: db.databaseName,
  mode: apply ? 'apply' : 'dry-run',
  users: 0,
  profilesCreated: 0,
  listsAdopted: 0,
  listsMerged: 0,
  orphanListsWithoutUser: 0,
  droppedIndexes: [],
}

for await (const user of users.find({}, { projection: { name: 1, profiles: 1 } })) {
  report.users++
  const userId = user._id.toString()
  let profiles = Array.isArray(user.profiles) ? user.profiles : []

  if (profiles.length === 0) {
    const profile = { id: new ObjectId().toHexString(), name: firstName(user.name), color: DEFAULT_COLOR, kids: false, createdAt: new Date() }
    report.profilesCreated++
    if (apply) {
      await users.updateOne(
        { _id: user._id, $or: [{ profiles: { $exists: false } }, { profiles: { $size: 0 } }] },
        { $set: { profiles: [profile] } }
      )
      profiles = (await users.findOne({ _id: user._id }, { projection: { profiles: 1 } }))?.profiles ?? [profile]
    } else {
      profiles = [profile]
    }
  }

  const defaultId = profiles[0].id
  const orphans = await lists.find({ userId, profileId: { $exists: false } }).toArray()
  for (const orphan of orphans) {
    const target = await lists.findOne({ userId, profileId: defaultId, type: orphan.type })
    if (target) {
      report.listsMerged++
      if (apply) {
        await lists.updateOne({ _id: target._id }, { $set: { items: mergeItems(target.items, orphan.items) } })
        await lists.deleteOne({ _id: orphan._id })
      }
    } else {
      report.listsAdopted++
      if (apply) await lists.updateOne({ _id: orphan._id }, { $set: { profileId: defaultId } })
    }
  }
}

// Lists whose user no longer exists are left alone (nothing can read them), just counted.
const knownIds = new Set((await users.find({}, { projection: { _id: 1 } }).toArray()).map((user) => user._id.toString()))
for await (const list of lists.find({ profileId: { $exists: false } }, { projection: { userId: 1 } })) {
  if (!knownIds.has(String(list.userId))) report.orphanListsWithoutUser++
}

// One list per (user, profile, type): a unique index on (userId, type) alone would now be wrong.
const indexes = await lists.indexes().catch(() => [])
for (const index of indexes) {
  const keys = Object.keys(index.key ?? {})
  if (index.unique && keys.length === 2 && keys.includes('userId') && keys.includes('type')) {
    report.droppedIndexes.push(index.name)
    if (apply) await lists.dropIndex(index.name)
  }
}
if (apply) await lists.createIndex({ userId: 1, profileId: 1, type: 1 }, { name: 'userId_profileId_type' })

console.log(JSON.stringify(report, null, 2))
await client.close()
