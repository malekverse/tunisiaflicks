// Claiming and changing handles. A handle is unique across the site; an old one keeps pointing to
// its owner for 30 days, and nobody else can take it for 90.
import 'server-only'
import { MongoServerError } from 'mongodb'
import { socialDb, DAYS } from './db'
import { HANDLE_HOLD_DAYS } from './identity'
import { checkHandle, handleIdeas, normalizeHandle } from './rules'

export type Availability = { available: boolean; reason: 'invalid' | 'reserved' | 'taken' | null }

export const isDuplicateKey = (error: unknown) => error instanceof MongoServerError && error.code === 11000

/** Whether `profileId` may take `raw` (its own old handle comes back to it). */
export async function handleAvailability(raw: unknown, profileId: string): Promise<Availability & { handle: string | null }> {
  const handle = normalizeHandle(raw)
  if (!handle) return { handle: null, available: false, reason: 'invalid' }
  const problem = checkHandle(handle)
  if (problem) return { handle, available: false, reason: problem }
  const { handles } = await socialDb()
  const doc = await handles.findOne({ _id: handle })
  if (!doc) return { handle, available: true, reason: null }
  if (doc.profileId === profileId) return { handle, available: true, reason: null }
  // A held handle whose hold ended (the TTL monitor runs about once a minute) is free again.
  if (!doc.current && doc.until && new Date(doc.until).getTime() <= Date.now()) return { handle, available: true, reason: null }
  return { handle, available: false, reason: 'taken' }
}

/** Three free handles close to what was typed (or to the name). */
export async function suggestHandles(typed: string, name: string): Promise<string[]> {
  const ideas = handleIdeas(typed, name)
  if (ideas.length === 0) return []
  const { handles } = await socialDb()
  const taken = new Set((await handles.find({ _id: { $in: ideas } }, { projection: { _id: 1 } }).toArray()).map((doc) => doc._id))
  return ideas.filter((idea) => !taken.has(idea)).slice(0, 3)
}

/**
 * Makes `handle` the profile's current handle: takes it (or takes back its own old one), and
 * turns the previous one into a held redirect. False when someone else got it first.
 */
export async function takeHandle(handle: string, owner: { userId: string; profileId: string }, previous: string | null): Promise<boolean> {
  const { handles } = await socialDb()
  const now = new Date()
  const existing = await handles.findOne({ _id: handle })
  if (existing && existing.profileId !== owner.profileId) {
    const expired = !existing.current && existing.until && new Date(existing.until).getTime() <= now.getTime()
    if (!expired) return false
    await handles.deleteOne({ _id: handle, current: false })
  }
  try {
    if (existing?.profileId === owner.profileId) {
      await handles.updateOne({ _id: handle }, { $set: { current: true }, $unset: { changedAt: '', until: '' } })
    } else {
      await handles.insertOne({ _id: handle, profileId: owner.profileId, userId: owner.userId, current: true })
    }
  } catch (error) {
    if (isDuplicateKey(error)) return false
    throw error
  }
  if (previous && previous !== handle) {
    await handles.updateOne(
      { _id: previous, profileId: owner.profileId },
      { $set: { current: false, changedAt: now, until: new Date(now.getTime() + DAYS(HANDLE_HOLD_DAYS)) } },
    )
  }
  return true
}

/** Undoes takeHandle when the rest of a claim failed. */
export async function releaseHandle(handle: string, profileId: string) {
  const { handles } = await socialDb()
  await handles.deleteOne({ _id: handle, profileId, current: true })
}
