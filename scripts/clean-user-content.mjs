#!/usr/bin/env node
// One-off, idempotent clean-up of favorites, bookmarks and watch history (`userContent`) written
// before POST /api/user-content validated its input:
//
//   node scripts/clean-user-content.mjs --uri "mongodb://127.0.0.1:27017/some_db"           (dry run)
//   node scripts/clean-user-content.mjs --uri "mongodb://127.0.0.1:27017/some_db" --apply   (write)
//
// Same rules as the route (src/app/api/user-content/route.ts):
// - id: 1 to 9 digits (a numeric id is turned into its string), media_type 'movie' or 'tv', and a
//   non-empty title (spaces collapsed, at most 200 characters). Items that fail these are removed.
// - poster_path: null or a TMDB path (/abc123.jpg). Anything else is dropped (the item stays).
// - season and episode: integers from 0 to 999, together. Otherwise both are dropped.
// - progress: a number from 0 to 100, otherwise dropped.
// Then one entry per title is kept (the first, which is the newest).
//
// A list is only rewritten if nobody changed it since it was read; re-running it changes nothing.
// The URI must be passed explicitly (no .env loading) so it is never run against production by accident.
import { MongoClient } from 'mongodb'

const args = process.argv.slice(2)
const uriIndex = args.indexOf('--uri')
const uri = uriIndex >= 0 ? args[uriIndex + 1] : undefined
const apply = args.includes('--apply')
if (!uri) {
  console.error('Usage: node scripts/clean-user-content.mjs --uri <mongodb uri with database> [--apply]')
  process.exit(1)
}

const cleanText = (value, max) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '')
const isEpisodeNumber = (value) => Number.isInteger(value) && value >= 0 && value <= 999

/** The cleaned item, or null when it has to go. `changed` says whether anything was fixed. */
function cleanItem(raw, counts) {
  if (!raw || typeof raw !== 'object') return null
  const id = typeof raw.id === 'number' ? String(raw.id) : raw.id
  if (typeof id !== 'string' || !/^[0-9]{1,9}$/.test(id)) return null
  if (raw.media_type !== 'movie' && raw.media_type !== 'tv') return null
  const title = cleanText(raw.title, 200)
  if (!title) return null

  const item = { ...raw, id, title }
  const fixes = []
  if (raw.id !== id) fixes.push('id')
  if (raw.title !== title) fixes.push('title')
  if (raw.poster_path !== undefined && raw.poster_path !== null && (typeof raw.poster_path !== 'string' || !/^[/][A-Za-z0-9._-]+$/.test(raw.poster_path))) {
    delete item.poster_path
    fixes.push('poster_path')
  }
  if ((raw.season !== undefined || raw.episode !== undefined) && !(isEpisodeNumber(raw.season) && isEpisodeNumber(raw.episode))) {
    delete item.season
    delete item.episode
    fixes.push('episode')
  }
  if (raw.progress !== undefined && !(typeof raw.progress === 'number' && Number.isFinite(raw.progress) && raw.progress >= 0 && raw.progress <= 100)) {
    delete item.progress
    fixes.push('progress')
  }
  for (const fix of fixes) counts[fix] = (counts[fix] ?? 0) + 1
  return item
}

const client = new MongoClient(uri)
await client.connect()
const db = client.db()
const lists = db.collection('userContent')

const report = {
  database: db.databaseName,
  mode: apply ? 'apply' : 'dry-run',
  lists: 0,
  items: 0,
  itemsRemoved: 0,
  duplicatesRemoved: 0,
  itemsFixed: 0,
  fixes: {},
  listsToRewrite: 0,
  listsRewritten: 0,
  listsChangedMeanwhile: 0,
}

try {
  for await (const doc of lists.find({}, { projection: { items: 1 } })) {
    report.lists++
    const original = Array.isArray(doc.items) ? doc.items : []
    report.items += original.length

    const seen = new Set()
    const cleaned = []
    let changed = !Array.isArray(doc.items)
    for (const raw of original) {
      const fixesBefore = Object.values(report.fixes).reduce((sum, n) => sum + n, 0)
      const item = cleanItem(raw, report.fixes)
      if (!item) {
        report.itemsRemoved++
        changed = true
        continue
      }
      const key = `${item.media_type}-${item.id}`
      if (seen.has(key)) {
        report.duplicatesRemoved++
        changed = true
        continue
      }
      seen.add(key)
      if (Object.values(report.fixes).reduce((sum, n) => sum + n, 0) > fixesBefore) {
        report.itemsFixed++
        changed = true
      }
      cleaned.push(item)
    }
    if (!changed) continue

    report.listsToRewrite++
    if (apply) {
      // Only if the list is exactly as it was read (no concurrent add or remove in between).
      const result = await lists.updateOne({ _id: doc._id, items: doc.items }, { $set: { items: cleaned } })
      if (result.modifiedCount === 1) report.listsRewritten++
      else report.listsChangedMeanwhile++
    }
  }
} finally {
  await client.close()
}

console.log(JSON.stringify(report, null, 2))
if (!apply && report.listsToRewrite > 0) console.log('Dry run: nothing was written. Re-run with --apply to clean these lists.')
