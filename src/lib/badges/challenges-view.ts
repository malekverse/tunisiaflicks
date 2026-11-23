// What /challenges shows (./challenges has the rules): this month's challenges and how far the
// profile has got, the months before (how many it finished), and how its friends are doing, for
// friends whose badges they may see (their privacy settings, as on their page). Everything comes
// from the private play logs and the title facts the badges already keep.
import 'server-only'
import { friendRows, otherSide } from '@/src/lib/social/friends'
import { getIdentities } from '@/src/lib/social/identity'
import { normalizePrivacy } from '@/src/lib/social/privacy'
import { canSeeWith } from '@/src/lib/social/rules'
import { socialDb } from '@/src/lib/social/db'
import type { ProfileRef, PublicIdentity } from '@/src/lib/social/types'
import { badgesDb } from './db'
import { loadFacts } from './facts'
import { dayOf, tunisToday } from './time'
import type { ActivityDay, TitleKey } from './metrics'
import {
  challengesFor, daysLeft, FIRST_MONTH, monthOf, monthProgress, monthTitles, previousMonth, type ChallengeProgress,
} from './challenges'

/** Months before this one shown with their score. */
const PAST_MONTHS = 6
/** Friends shown, at most (the ones most recently in touch first). */
const MAX_FRIENDS = 24
const BUDGET_MS = 2500

export type ChallengeFriend = { identity: PublicIdentity, values: number[] }
export type PastMonth = { month: string, done: number, total: number }

export type ChallengesView = {
  month: string
  daysLeft: number
  /** 'Badges and streak' is off: no log, nothing to measure. */
  enabled: boolean
  challenges: ChallengeProgress[]
  /** Some titles' facts weren't fetched in time: a value may still go up on the next visit. */
  incomplete: boolean
  past: PastMonth[]
  /** Null: the profile has no page, so no friends. */
  friends: ChallengeFriend[] | null
}

async function loadLog(profileIds: string[], months: string[]): Promise<Map<string, ActivityDay[]>> {
  const { activity } = await badgesDb()
  const docs = await activity.find({ profileId: { $in: profileIds }, month: { $in: months } }).toArray()
  const byProfile = new Map<string, ActivityDay[]>()
  for (const doc of docs) {
    const days = byProfile.get(doc.profileId) ?? []
    for (const day of doc.days ?? []) {
      if (Number.isInteger(day?.d) && Array.isArray(day.k)) days.push({ day: dayOf(doc.month, day.d), k: day.k })
    }
    byProfile.set(doc.profileId, days)
  }
  return byProfile
}

/** The friends (with a page) whose badges this profile may see. */
async function visibleFriends(ref: ProfileRef): Promise<ProfileRef[]> {
  const rows = await friendRows(ref.profileId, MAX_FRIENDS * 2)
  const friends = rows.map((row) => otherSide(row, ref.profileId))
  if (!friends.length) return []
  const { profiles } = await socialDb()
  const docs = new Map((await profiles.find({ _id: { $in: friends.map((friend) => friend.profileId) } }, { projection: { privacy: 1, userId: 1 } }).toArray()).map((doc) => [doc._id, doc]))
  const allowed: ProfileRef[] = []
  for (const friend of friends) {
    const doc = docs.get(friend.profileId)
    if (!doc || doc.userId !== friend.userId) continue
    // Already friends, and friendRows has left out blocked accounts.
    const ok = await canSeeWith(
      { viewer: ref, owner: friend, what: 'badges', privacy: normalizePrivacy(doc.privacy), keyMatches: false },
      { blocked: async () => false, friends: async () => true },
    )
    if (ok) allowed.push(friend)
    if (allowed.length >= MAX_FRIENDS) break
  }
  return allowed
}

export async function getChallengesView(ref: ProfileRef, opts: { friends: boolean, now?: Date }): Promise<ChallengesView> {
  const today = tunisToday(opts.now)
  const month = monthOf(today)
  const months = [month]
  for (let m = previousMonth(month); months.length <= PAST_MONTHS && m >= FIRST_MONTH; m = previousMonth(m)) months.push(m)

  const { badges } = await badgesDb()
  const doc = await badges.findOne({ _id: ref.profileId, userId: ref.userId }, { projection: { disabled: 1 } })
  const enabled = doc?.disabled !== true

  const friends = opts.friends ? await visibleFriends(ref) : []
  const logs = await loadLog([ref.profileId, ...friends.map((friend) => friend.profileId)], months)
  const mine = enabled ? logs.get(ref.profileId) ?? [] : []

  // Facts: this month's titles (mine and my friends'), then the earlier months'.
  const titles = new Set<string>(monthTitles(mine, month))
  for (const friend of friends) for (const title of monthTitles(logs.get(friend.profileId) ?? [], month)) titles.add(title)
  for (const past of months.slice(1)) for (const title of monthTitles(mine, past)) titles.add(title)
  const { facts, incomplete } = await loadFacts([...titles] as TitleKey[], { budgetMs: BUDGET_MS })

  const challenges = monthProgress(month, mine, facts)
  const past = months.slice(1).map((m) => ({ month: m, done: monthProgress(m, mine, facts).filter((c) => c.done).length, total: challengesFor(m).length }))

  let friendViews: ChallengeFriend[] | null = null
  if (opts.friends) {
    const identities = await getIdentities(friends.map((friend) => friend.profileId))
    friendViews = friends.flatMap((friend) => {
      const identity = identities.get(friend.profileId)
      const days = logs.get(friend.profileId) ?? []
      if (!identity || !days.some((day) => monthOf(day.day) === month)) return []
      return [{ identity, values: monthProgress(month, days, facts).map((challenge) => challenge.value) }]
    })
  }

  return { month, daysLeft: daysLeft(month, today), enabled, challenges, incomplete, past, friends: friendViews }
}
