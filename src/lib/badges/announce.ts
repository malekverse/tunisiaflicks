// The only way a badge is announced: one badge_earned row in the profile's inbox, per new level
// (no toast, no push, no e-mail). The nightly cron sends them for every profile that played in the
// last two days; a new supporter hears right away. A level already opened on the shelf is not
// announced again.
import 'server-only'
import { ObjectId } from 'mongodb'
import clientPromise from '@/src/lib/mongodb'
import { createTranslator } from '@/src/lib/i18n'
import { notify } from '@/src/lib/notify'
import type { ProfileRef } from '@/src/lib/social/types'
import { KIDS_BADGES, BADGES, badgeArtPath, badgeDef, tierOf, type BadgeId, type Level } from './catalogue'
import { applicableIds, computeAndStore, loadProfileInfo, type ProfileInfo } from './compute'
import { badgesDb, type BadgesDoc } from './db'

/** 'Marathon (Silver)' in the profile's language; single-level badges by name alone. */
export function badgeLabel(t: ReturnType<typeof createTranslator>, id: BadgeId, level: number): string {
  const name = t(`badges.name.${id}` as never)
  const tier = tierOf(level as Level)
  return badgeDef(id).thresholds && tier ? t('badges.inbox.badgeTier', { name, tier: t(`badges.tier.${tier}` as never) }) : name
}

/**
 * Files a badge_earned row for every level above what was announced (the highest one only, when a
 * profile jumped several), then records it. Returns how many rows went out.
 */
export async function announceNew(ref: ProfileRef, doc: BadgesDoc, info: ProfileInfo): Promise<number> {
  if (doc.disabled) return 0
  const { badges } = await badgesDb()
  const allowed = applicableIds(info.kids)
  const t = createTranslator(info.locale)
  let sent = 0
  const max: Record<string, number> = {}
  for (const badge of BADGES) {
    const earned = doc.earned?.[badge.id]
    if (!earned || !allowed.has(badge.id)) continue
    const level = earned.level
    if (level <= (earned.announcedLevel ?? 0)) continue
    if ((earned.seenLevel ?? 0) < level) {
      const result = await notify({
        to: ref,
        kind: 'badge_earned',
        key: `${badge.id}:${level}`,
        href: '/me#badges',
        text: { key: 'badges.inbox.earned', vars: { badge: badgeLabel(t, badge.id, level), badgeId: badge.id, level } },
        image: badgeArtPath(badge.id, level),
        kidsVisible: KIDS_BADGES.has(badge.id),
        push: false,
      })
      if (result.created) sent++
    }
    max[`earned.${badge.id}.announcedLevel`] = level
  }
  await badges.updateOne(
    { _id: ref.profileId, userId: ref.userId },
    { ...(Object.keys(max).length ? { $max: max } : {}), $unset: { pendingAnnounce: '' } },
  )
  return sent
}

/** Recomputes and announces one profile (the cron's unit of work). */
export async function refreshAndAnnounce(ref: ProfileRef, opts: { budgetMs?: number } = {}): Promise<{ announced: number; incomplete: boolean } | null> {
  const info = await loadProfileInfo(ref)
  const doc = await computeAndStore(ref, { budgetMs: opts.budgetMs, info })
  if (!doc || !info) return null
  return { announced: await announceNew(ref, doc, info), incomplete: doc.factsIncomplete === true }
}

/** A coffee was linked to this account: the Supporter badge on its first grown-up profile, now. */
export async function announceSupporter(userId: string): Promise<void> {
  if (!ObjectId.isValid(userId)) return
  const user = await (await clientPromise).db().collection('users').findOne({ _id: new ObjectId(userId) }, { projection: { profiles: 1 } })
  const profile = (user?.profiles ?? []).find((p: { kids?: unknown }) => p?.kids !== true)
  if (!profile?.id) return
  await refreshAndAnnounce({ userId, profileId: String(profile.id) }, { budgetMs: 1500 })
}
