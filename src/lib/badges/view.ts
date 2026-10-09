// What the shelf shows: a profile's badges as its owner sees them (earned, unseen, up next, the
// streak) or as anyone else may (earned public badges and the streak number, nothing more). Also
// the owner's own actions: marking a badge seen, turning badges off and on, and the account
// pipeline's export and deletion.
import 'server-only'
import { withTimeout } from '@/src/lib/with-timeout'
import { deleteSupportData, exportSupportData, getSupporter } from '@/src/lib/support'
import type { ProfileRef } from '@/src/lib/social/types'
import type { BadgeId } from './catalogue'
import { computeAndStore, loadProfileInfo, needsRefresh, type ProfileInfo } from './compute'
import { badgesDb } from './db'
import { toView, type BadgesView } from './present'

export type { BadgeCard, BadgesView } from './present'

/**
 * A profile's badges for the shelf. `refresh: 'auto'` recomputes when the profile played since,
 * on a new day, with a new catalogue, when TMDB facts were missing, or after 6 hours; within
 * `budgetMs`, after which the stored badges are shown as they are.
 */
export async function getBadgesView(owner: ProfileRef, opts: { refresh?: 'auto' | 'force' | 'never'; budgetMs?: number; view?: 'owner' | 'public'; info?: ProfileInfo | null } = {}): Promise<BadgesView | null> {
  const info = opts.info !== undefined ? opts.info : await loadProfileInfo(owner)
  if (!info) return null
  const view = opts.view ?? 'owner'
  const { badges } = await badgesDb()
  let doc = await badges.findOne({ _id: owner.profileId })
  if (doc && doc.userId !== owner.userId) return null
  const refresh = opts.refresh ?? 'auto'
  if (refresh === 'force' || (refresh === 'auto' && needsRefresh(doc))) {
    const budgetMs = Math.max(500, opts.budgetMs ?? 2500)
    // The facts budget leaves room for the reads and the write around it.
    const fresh = await withTimeout(computeAndStore(owner, { budgetMs: Math.max(300, budgetMs - 700), info }), budgetMs, null)
    if (fresh) doc = fresh
  }
  const supporterPublic = view === 'public' && !!doc?.earned?.supporter
    ? (await getSupporter(owner.userId))?.badgePublic === true
    : false
  return toView(doc, { view, kids: info.kids, supporterPublic })
}

/** The owner opened a badge: its dot goes away (until the next level). */
export async function markSeen(ref: ProfileRef, id: BadgeId): Promise<boolean> {
  const { badges } = await badgesDb()
  const doc = await badges.findOne({ _id: ref.profileId, userId: ref.userId }, { projection: { [`earned.${id}`]: 1 } })
  const level = doc?.earned?.[id]?.level
  if (!level) return false
  await badges.updateOne({ _id: ref.profileId, userId: ref.userId }, { $max: { [`earned.${id}.seenLevel`]: level } })
  return true
}

export async function badgesEnabled(ref: ProfileRef): Promise<boolean> {
  const { badges } = await badgesDb()
  const doc = await badges.findOne({ _id: ref.profileId, userId: ref.userId }, { projection: { disabled: 1 } })
  return doc?.disabled !== true
}

/**
 * 'Badges and streak'. Off: the daily log is deleted and nothing more is written, the shelf is
 * hidden (earned levels are kept, out of sight). On again: a fresh log from today.
 */
export async function setBadgesEnabled(ref: ProfileRef, enabled: boolean): Promise<void> {
  const { badges, activity } = await badgesDb()
  if (enabled) {
    await badges.updateOne(
      { _id: ref.profileId, userId: ref.userId },
      { $unset: { disabled: '' }, $set: { dirtyAt: new Date() } },
    )
    return
  }
  await badges.updateOne(
    { _id: ref.profileId },
    {
      $set: { disabled: true, userId: ref.userId, progress: {}, streak: { current: 0, best: 0, thisWeek: false } },
      $unset: { dirtyAt: '', pendingAnnounce: '', factsIncomplete: '' },
      $setOnInsert: { kids: false, earned: {}, version: 0, computedDay: '', computedAt: new Date(0) },
    },
    { upsert: true },
  )
  await activity.deleteMany({ profileId: ref.profileId, userId: ref.userId })
}

/**
 * Account and profile deletion. With a profile id: that profile's badges and log. Without: the
 * whole account's, and its supporter record.
 */
export async function deleteBadgeData(userId: string, profileId?: string): Promise<void> {
  const { badges, activity } = await badgesDb()
  if (profileId) {
    await Promise.all([badges.deleteMany({ _id: profileId, userId }), activity.deleteMany({ profileId, userId })])
    return
  }
  await Promise.all([badges.deleteMany({ userId }), activity.deleteMany({ userId }), deleteSupportData(userId)])
}

/** For "download my data": each profile's badges and daily log, and the supporter record. */
export async function exportBadgeData(userId: string): Promise<unknown> {
  const { badges, activity } = await badgesDb()
  const [docs, months, supporter] = await Promise.all([
    badges.find({ userId }).toArray(),
    activity.find({ userId }, { projection: { userId: 0, expireAt: 0 } }).sort({ month: 1 }).toArray(),
    exportSupportData(userId),
  ])
  return {
    badges: docs.map((doc) => ({
      profileId: doc._id,
      disabled: doc.disabled === true,
      earned: Object.fromEntries(Object.entries(doc.earned ?? {}).map(([id, badge]) => [id, { level: badge?.level, at: badge?.at, levelAt: badge?.levelAt }])),
      streak: doc.streak,
    })),
    dailyLog: months.map((month) => ({ profileId: month.profileId, month: month.month, days: month.days })),
    supporter,
  }
}

