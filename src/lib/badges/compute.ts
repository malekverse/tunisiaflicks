// Computing a profile's badges: its play log (13 months), its watch history, the facts about the
// titles in them, and whether the account supports us. The result is stored in `badges` (levels
// with $max, so they only ever go up) and read back by the shelf, the cron and the digest.
import 'server-only'
import { ObjectId } from 'mongodb'
import clientPromise from '@/src/lib/mongodb'
import type { Locale } from '@/src/lib/i18n/locales'
import { isLocale } from '@/src/lib/i18n/locales'
import type { ProfileRef } from '@/src/lib/social/types'
import { getSupporter } from '@/src/lib/support'
import { CATALOGUE_VERSION, badgesFor, levelFor, type BadgeId } from './catalogue'
import { badgesDb, type BadgesDoc } from './db'
import { loadFacts, FACTS_BUDGET_MS } from './facts'
import { computeMetrics, titleKeyOf, titlesInLog, type ActivityDay, type TitleKey } from './metrics'
import { dayOf, tunisToday } from './time'

/** A computation older than this is redone on the next view. */
export const STALE_MS = 6 * 60 * 60 * 1000

export type ProfileInfo = {
  kids: boolean
  /** The account's first grown-up profile: the one that carries the Supporter badge. */
  supporterProfileId: string | null
  locale: Locale
}

/** The profile as the badges need it, or null when the account no longer has it. */
export async function loadProfileInfo(ref: ProfileRef): Promise<ProfileInfo | null> {
  if (!ObjectId.isValid(ref.userId)) return null
  const user = await (await clientPromise).db().collection('users').findOne(
    { _id: new ObjectId(ref.userId) },
    { projection: { profiles: 1, locale: 1 } },
  )
  const profiles: { id?: unknown; kids?: unknown }[] = Array.isArray(user?.profiles) ? user!.profiles : []
  const profile = profiles.find((p) => String(p?.id) === ref.profileId)
  if (!profile) return null
  const firstGrownUp = profiles.find((p) => p?.kids !== true)
  return {
    kids: profile.kids === true,
    supporterProfileId: firstGrownUp ? String(firstGrownUp.id) : null,
    locale: isLocale(user?.locale) ? user!.locale : 'en',
  }
}

/** The log as days ('YYYY-MM-DD' plus flags and plays), oldest first. */
async function loadDays(ref: ProfileRef): Promise<ActivityDay[]> {
  const { activity } = await badgesDb()
  const months = await activity.find({ profileId: ref.profileId, userId: ref.userId }).sort({ month: 1 }).limit(16).toArray()
  return months.flatMap((month) => (month.days ?? [])
    .filter((day) => Number.isInteger(day?.d) && Array.isArray(day.k))
    .map((day) => ({ day: dayOf(month.month, day.d), n: day.n === true, e: day.e === true, k: day.k })))
}

/** The titles in the watch history (every title ever played, one entry each). */
async function loadHistoryTitles(ref: ProfileRef): Promise<TitleKey[]> {
  const list = await (await clientPromise).db().collection('userContent').findOne(
    { userId: ref.userId, profileId: ref.profileId, type: 'history' },
    { projection: { 'items.id': 1, 'items.media_type': 1 } },
  )
  const titles: TitleKey[] = []
  for (const item of list?.items ?? []) {
    const id = String(item?.id ?? '')
    if ((item?.media_type === 'movie' || item?.media_type === 'tv') && /^\d{1,9}$/.test(id)) titles.push(titleKeyOf({ media_type: item.media_type, id }))
  }
  return titles
}

export function needsRefresh(doc: BadgesDoc | null, now: Date = new Date()): boolean {
  if (!doc) return true
  if (doc.disabled) return false
  return doc.version !== CATALOGUE_VERSION
    || !!doc.dirtyAt
    || doc.factsIncomplete === true
    || doc.computedDay !== tunisToday(now)
    || !doc.computedAt
    || now.getTime() - new Date(doc.computedAt).getTime() > STALE_MS
}

/**
 * Recomputes one profile and stores the result. Null when the profile is gone (its document is
 * removed). A profile with badges turned off is returned untouched.
 */
export async function computeAndStore(ref: ProfileRef, opts: { budgetMs?: number; now?: Date; info?: ProfileInfo | null } = {}): Promise<BadgesDoc | null> {
  const now = opts.now ?? new Date()
  const { badges } = await badgesDb()
  const info = opts.info !== undefined ? opts.info : await loadProfileInfo(ref)
  if (!info) {
    await badges.deleteOne({ _id: ref.profileId, userId: ref.userId })
    return null
  }
  const stored = await badges.findOne({ _id: ref.profileId })
  if (stored && stored.userId !== ref.userId) return null
  if (stored?.disabled) return stored

  const isSupporterProfile = info.supporterProfileId === ref.profileId && !info.kids
  const [days, history, supporter] = await Promise.all([
    loadDays(ref),
    loadHistoryTitles(ref),
    isSupporterProfile ? getSupporter(ref.userId) : Promise.resolve(null),
  ])
  const titles = [...new Set([...history, ...titlesInLog(days)])]
  const { facts, incomplete } = await loadFacts(titles, { budgetMs: opts.budgetMs ?? FACTS_BUDGET_MS })
  const today = tunisToday(now)
  const metrics = computeMetrics({ days, titles, facts, today, supporter: !!supporter, bestStreak: stored?.streak?.best ?? 0 })

  const set: Record<string, unknown> = {
    userId: ref.userId,
    kids: info.kids,
    version: CATALOGUE_VERSION,
    computedAt: now,
    computedDay: today,
    factsIncomplete: incomplete,
    'streak.current': metrics.streak.current,
    'streak.thisWeek': metrics.streak.thisWeek,
  }
  const max: Record<string, number> = { 'streak.best': metrics.streak.best }
  const min: Record<string, Date> = {}
  let pending = false
  for (const badge of badgesFor(info.kids)) {
    const value = metrics.values[badge.id]
    set[`progress.${badge.id}`] = value
    const level = levelFor(value, badge)
    const before = stored?.earned?.[badge.id]
    if (level > (before?.level ?? 0)) {
      const path = `earned.${badge.id}`
      max[`${path}.level`] = level
      max[`${path}.seenLevel`] = 0
      max[`${path}.announcedLevel`] = 0
      set[`${path}.levelAt`] = now
      min[`${path}.at`] = now
    }
    if (Math.max(level, before?.level ?? 0) > (before?.announcedLevel ?? 0)) pending = true
  }
  if (pending) set.pendingAnnounce = true
  // Facts still missing (TMDB budget, or TMDB failing): the profile stays due, so the next run or
  // view carries on where this one stopped.
  if (incomplete) set.dirtyAt = now
  // Supporter is earned elsewhere (Ko-fi): when the account stops being the supporter profile's,
  // nothing is taken away, as with every badge.
  const supporterSince = supporter?.since
  if (supporterSince && min['earned.supporter.at']) min['earned.supporter.at'] = supporterSince

  await badges.updateOne(
    { _id: ref.profileId },
    { $set: set, $max: max, ...(Object.keys(min).length ? { $min: min } : {}), ...(pending ? {} : { $unset: { pendingAnnounce: '' } }) },
    { upsert: true },
  )
  // A play that landed while this ran keeps the profile dirty.
  if (!incomplete) await badges.updateOne({ _id: ref.profileId, dirtyAt: { $lte: now } }, { $unset: { dirtyAt: '' } })
  return badges.findOne({ _id: ref.profileId })
}

/** Badges applicable to the profile right now (a profile that became Kids keeps the rest hidden). */
export const applicableIds = (kids: boolean): Set<BadgeId> => new Set(badgesFor(kids).map((badge) => badge.id))
