// Crowd-sourced health of the stream sources, without probing them from a server (they are
// browser-only players that often block server requests anyway): a viewer's player reports "worked"
// after 90 seconds on a source, and "broken" when they press "Not working?". Daily counters per
// source, kept two weeks; only the last 3 days count.
import clientPromise from '@/src/lib/mongodb'

export type SourceHealth = { ok: number, broken: number, status: 'good' | 'down' | 'unknown' }

const WINDOW_DAYS = 3
const day = (offset = 0) => new Date(Date.now() - offset * 86400000).toISOString().slice(0, 10)

type HealthDoc = { _id: string, name: string, date: string, ok: number, broken: number, expires_at: Date }

async function healthCollection() {
  const collection = (await clientPromise).db().collection<HealthDoc>('streamHealth')
  await collection.createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 }).catch(() => {})
  return collection
}

export async function recordSourceReport(name: string, ok: boolean) {
  const date = day()
  await (await healthCollection()).updateOne(
    { _id: `${name}:${date}` },
    {
      $inc: { [ok ? 'ok' : 'broken']: 1, [ok ? 'broken' : 'ok']: 0 },
      $setOnInsert: { name, date, expires_at: new Date(Date.now() + 14 * 86400000) },
    },
    { upsert: true },
  )
}

/** "down" = several reports and mostly broken; "good" = enough plays and mostly fine. */
export function classify(ok: number, broken: number): SourceHealth['status'] {
  const total = ok + broken
  if (broken >= 5 && broken / total >= 0.7) return 'down'
  if (ok >= 3 && ok / total >= 0.7) return 'good'
  return 'unknown'
}

export async function getSourceHealth(): Promise<Record<string, SourceHealth>> {
  const since = day(WINDOW_DAYS - 1)
  const rows = await (await healthCollection()).aggregate<{ _id: string, ok: number, broken: number }>([
    { $match: { date: { $gte: since } } },
    { $group: { _id: '$name', ok: { $sum: '$ok' }, broken: { $sum: '$broken' } } },
  ]).toArray()
  return Object.fromEntries(rows.map((row) => [row._id, { ok: row.ok, broken: row.broken, status: classify(row.ok, row.broken) }]))
}

// ---- per title ----------------------------------------------------------------------------------
// The same reports, kept per title too ("movie:550", "tv:1399"): a source can play one film and not
// another. One document per title, counters per source, forgotten 90 days after the last report.

type TitleDoc = { _id: string, sources: Record<string, { ok?: number, broken?: number }>, updatedAt: Date }

/** Source names as field names (no dots or dollars in a MongoDB field). */
export const fieldOf = (name: string) => name.replace(/[.$]/g, '_')

let titleIndex: Promise<unknown> | null = null
async function titleCollection() {
  const collection = (await clientPromise).db().collection<TitleDoc>('streamHealthTitles')
  titleIndex ??= collection.createIndex({ updatedAt: 1 }, { expireAfterSeconds: 90 * 86400 }).catch(() => { titleIndex = null })
  await titleIndex
  return collection
}

export async function recordTitleReport(title: string, name: string, ok: boolean) {
  const field = `sources.${fieldOf(name)}.${ok ? 'ok' : 'broken'}`
  await (await titleCollection()).updateOne({ _id: title }, { $inc: { [field]: 1 }, $set: { updatedAt: new Date() } }, { upsert: true })
}

/** What viewers reported for one title, by source name (`names`: the known sources). */
export async function getTitleHealth(title: string, names: readonly string[]): Promise<Record<string, { ok: number, broken: number }>> {
  const doc = await (await titleCollection()).findOne({ _id: title })
  if (!doc) return {}
  return Object.fromEntries(names.flatMap((name) => {
    const counts = doc.sources?.[fieldOf(name)]
    return counts ? [[name, { ok: counts.ok ?? 0, broken: counts.broken ?? 0 }]] : []
  }))
}
