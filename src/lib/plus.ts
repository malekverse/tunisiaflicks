// TunisiaFlicks+ and invite rewards on the server (lib/plus-rules has the rules).
//
// plus       {_id: userId, until, grants: [{at, days, source}] (last 50), inviteMonths, accent, showBadge}
// referrals  {_id: newUserId, referrerId, at, qualifiedAt}  (one referrer per account, ever)
// users.refCode  8 characters (sparse unique index): the invite link's ?ref=
// Gifts (a month of Plus paid for a friend) are in lib/plus-gifts.
import 'server-only'
import { cache } from 'react'
import { randomBytes } from 'crypto'
import { ObjectId, type Collection } from 'mongodb'
import clientPromise from '@/src/lib/mongodb'
import {
  PLUS_DAYS, extendUntil, inviteMonths, isAccent, isActive, isNewAccount, isRefCode, refCodeFrom,
  type Accent,
} from '@/src/lib/plus-rules'

export type PlusSource = 'coffee' | 'membership' | 'invite' | 'gift'
export type PlusDoc = {
  _id: string
  until: Date | null
  grants: { at: Date, days: number, source: PlusSource }[]
  inviteMonths: number
  accent?: Accent
  showBadge?: boolean
}
type ReferralDoc = { _id: string, referrerId: string, at: Date, qualifiedAt: Date | null }

let ready: Promise<unknown> | null = null
async function plusDb(): Promise<{ plus: Collection<PlusDoc>, referrals: Collection<ReferralDoc>, users: Collection }> {
  const db = (await clientPromise).db()
  const plus = db.collection<PlusDoc>('plus')
  const referrals = db.collection<ReferralDoc>('referrals')
  const users = db.collection('users')
  ready ??= Promise.all([
    referrals.createIndex({ referrerId: 1, qualifiedAt: 1 }),
    users.createIndex({ refCode: 1 }, { unique: true, sparse: true }),
  ]).catch((error) => {
    ready = null
    console.error('plus: creating indexes failed', error)
  })
  await ready
  return { plus, referrals, users }
}

/** Adds Plus time (a coffee, a membership payment, an invite month). */
export async function addPlusDays(userId: string, days: number, source: PlusSource, at: Date = new Date()): Promise<Date> {
  const { plus } = await plusDb()
  const current = await plus.findOne({ _id: userId }, { projection: { until: 1 } })
  const until = extendUntil(current?.until ?? null, days, at)
  await plus.updateOne(
    { _id: userId },
    {
      $set: { until },
      $push: { grants: { $each: [{ at, days, source }], $slice: -50 } },
      $setOnInsert: { inviteMonths: 0 },
    },
    { upsert: true },
  )
  return until
}

/** A Ko-fi coffee or membership payment (lib/support credit): a month of Plus from when it was paid. */
export const creditKofi = (userId: string, at: Date, membership: boolean) => addPlusDays(userId, PLUS_DAYS, membership ? 'membership' : 'coffee', at)

export type PlusState = { active: boolean, until: Date | null, accent: Accent, showBadge: boolean, membership: boolean }

export const getPlus = cache(async (userId: string): Promise<PlusState> => {
  const { plus } = await plusDb()
  const doc = await plus.findOne({ _id: userId })
  const active = isActive(doc?.until)
  const lastMembership = [...(doc?.grants ?? [])].reverse().find((grant) => grant.source === 'membership')
  return {
    active,
    until: doc?.until ?? null,
    accent: active && isAccent(doc?.accent) ? doc!.accent! : 'red',
    showBadge: active && doc?.showBadge === true,
    // A membership paid in the last 35 days: it renews by itself.
    membership: !!lastMembership && Date.now() - new Date(lastMembership.at).getTime() < 35 * 86_400_000,
  }
})

export const isPlus = async (userId: string | null | undefined) => (userId ? (await getPlus(userId)).active : false)

export async function setPlusPrefs(userId: string, prefs: { accent?: Accent, showBadge?: boolean }) {
  const { plus } = await plusDb()
  const set: Partial<PlusDoc> = {}
  if (prefs.accent) set.accent = prefs.accent
  if (typeof prefs.showBadge === 'boolean') set.showBadge = prefs.showBadge
  if (Object.keys(set).length) await plus.updateOne({ _id: userId }, { $set: set })
}

// ---- invites -------------------------------------------------------------------------------------

/** The account's invite code, made on first use. */
export async function ensureRefCode(userId: string): Promise<string | null> {
  if (!ObjectId.isValid(userId)) return null
  const { users } = await plusDb()
  const _id = new ObjectId(userId)
  const current = await users.findOne({ _id }, { projection: { refCode: 1 } })
  if (!current) return null
  if (isRefCode(current.refCode)) return current.refCode
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = refCodeFrom(randomBytes(8))
    try {
      const result = await users.updateOne({ _id, refCode: { $exists: false } }, { $set: { refCode: code } })
      if (result.modifiedCount === 1) return code
      const again = await users.findOne({ _id }, { projection: { refCode: 1 } })
      if (isRefCode(again?.refCode)) return again.refCode
    } catch (error) {
      if ((error as { code?: number })?.code !== 11000) throw error
    }
  }
  return null
}

export type ClaimResult = 'claimed' | 'invalid' | 'self' | 'not_new' | 'already'

/** A new account says who invited it (once; only while the account is a few days old). */
export async function claimReferral(newUserId: string, code: string, now: Date = new Date()): Promise<ClaimResult> {
  if (!isRefCode(code) || !ObjectId.isValid(newUserId)) return 'invalid'
  const { users, referrals } = await plusDb()
  const referrer = await users.findOne({ refCode: code }, { projection: { _id: 1 } })
  if (!referrer) return 'invalid'
  const referrerId = String(referrer._id)
  if (referrerId === newUserId) return 'self'
  // The account's age from its id: every account has one, however it signed up.
  if (!isNewAccount(new ObjectId(newUserId).getTimestamp(), now)) return 'not_new'
  try {
    await referrals.insertOne({ _id: newUserId, referrerId, at: now, qualifiedAt: null })
  } catch (error) {
    if ((error as { code?: number })?.code === 11000) return 'already'
    throw error
  }
  await qualifyReferral(newUserId)
  return 'claimed'
}

/**
 * A referred account counts once its e-mail is verified (Google sign-ins are): then the friend who
 * invited it gets the months it adds up to. Safe to call any number of times.
 */
export async function qualifyReferral(newUserId: string): Promise<void> {
  if (!ObjectId.isValid(newUserId)) return
  const { users, referrals, plus } = await plusDb()
  const referral = await referrals.findOne({ _id: newUserId })
  if (!referral || referral.qualifiedAt) return
  const user = await users.findOne({ _id: new ObjectId(newUserId) }, { projection: { emailVerified: 1 } })
  if (!user?.emailVerified) return
  const marked = await referrals.updateOne({ _id: newUserId, qualifiedAt: null }, { $set: { qualifiedAt: new Date() } })
  if (marked.modifiedCount !== 1) return

  const friends = await referrals.countDocuments({ referrerId: referral.referrerId, qualifiedAt: { $ne: null } })
  const doc = await plus.findOne({ _id: referral.referrerId }, { projection: { inviteMonths: 1 } })
  const { earned, due } = inviteMonths(friends, doc?.inviteMonths ?? 0)
  if (!due) return
  // Claim the months first (only one caller wins), then add the time.
  const claimed = await plus.updateOne(
    { _id: referral.referrerId, $or: [{ inviteMonths: doc?.inviteMonths ?? 0 }, { inviteMonths: { $exists: false } }] },
    { $set: { inviteMonths: earned }, $setOnInsert: { until: null, grants: [] } },
    { upsert: !doc },
  ).catch((error) => {
    if ((error as { code?: number })?.code === 11000) return { modifiedCount: 0, upsertedCount: 0 }
    throw error
  })
  if (claimed.modifiedCount + claimed.upsertedCount !== 1) return
  for (let month = 0; month < due; month++) await addPlusDays(referral.referrerId, PLUS_DAYS, 'invite')
}

/** How the inviting is going: verified friends, friends still to verify, months earned. */
export async function inviteProgress(userId: string): Promise<{ code: string | null, friends: number, waiting: number, months: number }> {
  const { referrals, plus } = await plusDb()
  const [code, friends, waiting, doc] = await Promise.all([
    ensureRefCode(userId),
    referrals.countDocuments({ referrerId: userId, qualifiedAt: { $ne: null } }),
    referrals.countDocuments({ referrerId: userId, qualifiedAt: null }),
    plus.findOne({ _id: userId }, { projection: { inviteMonths: 1 } }),
  ])
  return { code, friends, waiting, months: doc?.inviteMonths ?? 0 }
}

/** Everything kept about Plus, invites and gifts for an account (export). */
export async function exportPlusData(userId: string): Promise<unknown> {
  const { plus, referrals } = await plusDb()
  const { exportGiftData } = await import('@/src/lib/plus-gifts')
  const [doc, invited, invitedBy, gifts] = await Promise.all([
    plus.findOne({ _id: userId }),
    referrals.countDocuments({ referrerId: userId }),
    referrals.findOne({ _id: userId }, { projection: { at: 1 } }),
    exportGiftData(userId),
  ])
  return { plus: doc ? { until: doc.until, grants: doc.grants, inviteMonths: doc.inviteMonths, accent: doc.accent ?? null, showBadge: doc.showBadge ?? false } : null, friendsInvited: invited, joinedThroughAnInvite: !!invitedBy, gifts }
}

/** Account deletion: Plus, the account's place in invites (as the invited one and the inviter), and its gifts. */
export async function deletePlusData(userId: string): Promise<void> {
  const { plus, referrals } = await plusDb()
  const { deleteGiftData } = await import('@/src/lib/plus-gifts')
  await Promise.all([plus.deleteOne({ _id: userId }), referrals.deleteMany({ $or: [{ _id: userId }, { referrerId: userId }] }), deleteGiftData(userId)])
}
