// The private daily log behind the badges (watchActivity): for each day a profile pressed play,
// what it played and, for grown-ups, whether it was at night (00:00 to 04:59) or early (05:00 to
// 08:59). No hours, no times: day flags only, kept 13 months. Written from POST /api/user-content
// (history), forgotten title by title from DELETE, and dropped entirely when badges are turned off.
import 'server-only'
import { ObjectId } from 'mongodb'
import clientPromise from '@/src/lib/mongodb'
import type { ProfileRef } from '@/src/lib/social/types'
import { badgesDb } from './db'
import { playKey, type PlayRef } from './metrics'
import { activityExpiry, hourFlags, localDay, safeTimeZone } from './time'

/** A day keeps at most this many plays (a day of bingeing stays a bounded document). */
export const MAX_PLAYS_PER_DAY = 80

const isDuplicateKey = (error: unknown) => (error as { code?: number })?.code === 11000

async function isKidsProfile(ref: ProfileRef): Promise<boolean> {
  if (!ObjectId.isValid(ref.userId)) return false
  const user = await (await clientPromise).db().collection('users').findOne(
    { _id: new ObjectId(ref.userId) },
    { projection: { profiles: 1 } },
  )
  const profile = (user?.profiles ?? []).find((p: { id?: unknown }) => String(p?.id) === ref.profileId)
  return profile?.kids === true
}

/**
 * Files one play under today (where the person is) and marks the badges for recomputation.
 * Skipped when the profile turned badges off. Never throws: a play must never fail because of a
 * badge.
 */
export async function recordPlay(ref: ProfileRef, item: PlayRef, opts: { timeZone?: string; kids?: boolean; now?: Date } = {}): Promise<void> {
  try {
    const { badges, activity } = await badgesDb()
    const state = await badges.findOne({ _id: ref.profileId }, { projection: { disabled: 1, userId: 1 } })
    if (state?.disabled || (state && state.userId !== ref.userId)) return
    const kids = opts.kids ?? (await isKidsProfile(ref))
    const now = opts.now ?? new Date()
    const local = localDay(now, safeTimeZone(opts.timeZone))
    const key = playKey(item)
    const flags = kids ? {} : hourFlags(local.hour)
    const _id = `${ref.profileId}:${local.month}`

    const setFlags: Record<string, true> = {}
    if (flags.n) setFlags['days.$.n'] = true
    if (flags.e) setFlags['days.$.e'] = true

    // 1. The day is already there: add the play (and the flag).
    const addToDay = () => activity.updateOne(
      { _id, days: { $elemMatch: { d: local.d, [`k.${MAX_PLAYS_PER_DAY - 1}`]: { $exists: false } } } },
      { $addToSet: { 'days.$.k': key }, ...(Object.keys(setFlags).length ? { $set: setFlags } : {}) },
    )
    if ((await addToDay()).matchedCount === 0) {
      // 2. A new day (and maybe a new month): append it. A full day matches neither and is left alone.
      try {
        await activity.updateOne(
          { _id, 'days.d': { $ne: local.d } },
          {
            $push: { days: { d: local.d, ...flags, k: [key] } },
            $setOnInsert: { userId: ref.userId, profileId: ref.profileId, month: local.month, expireAt: activityExpiry(local.month) },
          },
          { upsert: true },
        )
      } catch (error) {
        // Two plays raced to create the month (or the day is full): the first one won; add to it.
        if (!isDuplicateKey(error)) throw error
        await addToDay()
      }
    }
    // Even a full day marks the badges: the title may be new to the history.
    const markDirty = (upsert: boolean) => badges.updateOne(
      { _id: ref.profileId },
      { $set: { dirtyAt: now }, $setOnInsert: { userId: ref.userId, kids, earned: {}, progress: {}, streak: { current: 0, best: 0, thisWeek: false }, version: 0, computedDay: '' } },
      { upsert },
    )
    await markDirty(true).catch((error) => {
      if (!isDuplicateKey(error)) throw error
      return markDirty(false)
    })
  } catch (error) {
    console.error('badges: recording a play failed', error)
  }
}

/** Removes a title from the log (it was taken out of the history): every day that played it. */
export async function forgetTitle(ref: ProfileRef, id: string, mediaType?: 'movie' | 'tv'): Promise<void> {
  if (!/^\d{1,9}$/.test(id)) return
  try {
    const { badges, activity } = await badgesDb()
    const keys: (string | RegExp)[] = []
    if (mediaType !== 'tv') keys.push(`m${id}`)
    if (mediaType !== 'movie') keys.push(`t${id}`, new RegExp(`^t${id}:`))
    const filter = { profileId: ref.profileId, userId: ref.userId }
    await activity.updateMany(filter, { $pull: { 'days.$[].k': { $in: keys } } } as never)
    // A day with nothing left in it goes (with its flags).
    await activity.updateMany(filter, { $pull: { days: { k: { $size: 0 } } } } as never)
    await activity.deleteMany({ ...filter, days: { $size: 0 } })
    await badges.updateOne({ _id: ref.profileId, userId: ref.userId }, { $set: { dirtyAt: new Date() } })
  } catch (error) {
    console.error('badges: forgetting a title failed', error)
  }
}
