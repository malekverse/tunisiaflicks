// The nightly badges job (/api/cron/badges, 03:10 in Tunis): every profile that pressed play in the
// last two days (or has a level waiting to be announced) is recomputed and its new levels go to
// its inbox. 50 profiles a run at most, inside the scheduler's deadline; `more` asks for another.
import 'server-only'
import type { CronResult } from '@/src/lib/cron'
import { refreshAndAnnounce } from './announce'
import { badgesDb } from './db'

export const BATCH = 50
export const DIRTY_WINDOW_MS = 2 * 86_400_000
const RETRY_AFTER_MS = 30 * 60_000
/** One profile: up to 3s of TMDB, plus its reads, writes and inbox rows. */
const PER_PROFILE_MS = 4500

export async function runBadgesCron({ deadline, now = new Date() }: { deadline: number; now?: Date }): Promise<CronResult> {
  const { badges } = await badgesDb()
  const due = await badges
    .find(
      {
        disabled: { $ne: true },
        $or: [{ dirtyAt: { $gte: new Date(now.getTime() - DIRTY_WINDOW_MS) } }, { pendingAnnounce: true }],
        // Still waiting on TMDB from a run moments ago: not again in the same loop.
        $nor: [{ factsIncomplete: true, computedAt: { $gt: new Date(now.getTime() - RETRY_AFTER_MS) } }],
      },
      { projection: { _id: 1, userId: 1 } },
    )
    .sort({ dirtyAt: 1 })
    .limit(BATCH + 1)
    .toArray()
  if (due.length === 0) return { status: 'idle', profiles: 0, announced: 0 }

  let profiles = 0
  let announced = 0
  let incomplete = 0
  let failed = 0
  let stopped = false
  for (const doc of due.slice(0, BATCH)) {
    const left = deadline - Date.now()
    if (left < PER_PROFILE_MS) {
      stopped = true
      break
    }
    try {
      const result = await refreshAndAnnounce({ userId: doc.userId, profileId: doc._id }, { budgetMs: Math.min(3000, left - 1500) })
      profiles++
      if (result) {
        announced += result.announced
        if (result.incomplete) incomplete++
      }
    } catch (error) {
      failed++
      console.error('badges cron: one profile failed', error)
    }
  }
  // Profiles whose facts are still incomplete stay dirty: the next call carries on with them.
  return { profiles, announced, incomplete, failed, more: stopped || due.length > BATCH }
}
