// Family Plus (lib/plus-rules has the rules). A Ko-fi payment from the Family membership tier gives
// the payer (the family's holder) a month of sharing, on top of their own Plus: up to FAMILY_SEATS
// other accounts join through the holder's family link and have Plus for as long as the family
// does. The holder can remove anyone, anyone can leave, and a new link retires the old one.
//
// Kept on the holder's plus document: familyUntil, familyToken (the link's secret), family
// [{userId, at}]. An account is in one family at most; whether it has Plus through one is a
// lookup on family.userId (lib/plus getPlus).
import 'server-only'
import { randomBytes } from 'crypto'
import { ObjectId, type Collection } from 'mongodb'
import clientPromise from '@/src/lib/mongodb'
import { FAMILY_SEATS, PLUS_DAYS, extendUntil, isActive, isFamilyToken } from '@/src/lib/plus-rules'

type FamilyFields = {
  _id: string
  familyUntil?: Date | null
  familyToken?: string
  family?: { userId: string, at: Date }[]
}

export type FamilyMember = { id: string, name: string, image: string | null, at: string }

/** The family as the signed-in account sees it. */
export type FamilyState =
  | { role: 'holder', active: boolean, until: string | null, link: string | null, members: FamilyMember[], seats: number }
  | { role: 'member', holderName: string, until: string }
  | { role: 'none' }

/** What the family link shows. */
export type FamilyInvite = {
  status: 'open' | 'full' | 'ended' | 'own' | 'joined' | 'elsewhere'
  holderName: string
  seatsLeft: number
}

let ready: Promise<unknown> | null = null
async function familyDb(): Promise<{ plus: Collection<FamilyFields>, users: Collection }> {
  const db = (await clientPromise).db()
  const plus = db.collection<FamilyFields>('plus')
  ready ??= Promise.all([
    plus.createIndex({ familyToken: 1 }, { unique: true, sparse: true }),
    plus.createIndex({ 'family.userId': 1 }),
  ]).catch((error) => {
    ready = null
    console.error('plus-family: creating indexes failed', error)
  })
  await ready
  return { plus, users: db.collection('users') }
}

async function namesOf(users: Collection, ids: string[]): Promise<Map<string, { name: string, image: string | null }>> {
  const valid = ids.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id))
  const found = valid.length ? await users.find({ _id: { $in: valid } }, { projection: { name: 1, image: 1 } }).toArray() : []
  return new Map(found.map((user) => [String(user._id), { name: typeof user.name === 'string' ? user.name : '', image: typeof user.image === 'string' ? user.image : null }]))
}

/** The family that gives this account Plus right now (not its own), or null. */
export async function activeFamilyOf(userId: string, now: Date = new Date()): Promise<{ holderId: string, until: Date } | null> {
  const { plus } = await familyDb()
  const holder = await plus.findOne({ 'family.userId': userId, familyUntil: { $gt: now } }, { projection: { familyUntil: 1 } })
  return holder?.familyUntil ? { holderId: holder._id, until: holder.familyUntil } : null
}

/** One Family-tier payment (lib/support credit): a month more of sharing, from when it was paid. */
export async function creditFamily(userId: string, at: Date): Promise<Date> {
  const { plus } = await familyDb()
  const current = await plus.findOne({ _id: userId }, { projection: { familyUntil: 1 } })
  const familyUntil = extendUntil(current?.familyUntil ?? null, PLUS_DAYS, at)
  await plus.updateOne(
    { _id: userId },
    { $set: { familyUntil }, $setOnInsert: { until: null, grants: [], inviteMonths: 0 } as never },
    { upsert: true },
  )
  return familyUntil
}

/** The holder's link secret, made on first use. */
async function ensureToken(plus: Collection<FamilyFields>, userId: string, existing?: string): Promise<string> {
  if (existing && isFamilyToken(existing)) return existing
  const token = randomBytes(16).toString('base64url')
  await plus.updateOne({ _id: userId, familyToken: { $exists: false } }, { $set: { familyToken: token } })
  return (await plus.findOne({ _id: userId }, { projection: { familyToken: 1 } }))?.familyToken ?? token
}

export async function familyState(userId: string, linkBase: string, now: Date = new Date()): Promise<FamilyState> {
  const { plus, users } = await familyDb()
  const own = await plus.findOne({ _id: userId }, { projection: { familyUntil: 1, familyToken: 1, family: 1 } })
  if (own?.familyUntil) {
    const active = isActive(own.familyUntil, now)
    const family = own.family ?? []
    const names = await namesOf(users, family.map((member) => member.userId))
    const token = active ? await ensureToken(plus, userId, own.familyToken) : null
    return {
      role: 'holder',
      active,
      until: own.familyUntil.toISOString(),
      link: token ? `${linkBase}/family/${token}` : null,
      members: family.map((member) => ({ id: member.userId, name: names.get(member.userId)?.name ?? '', image: names.get(member.userId)?.image ?? null, at: member.at.toISOString() })),
      seats: FAMILY_SEATS,
    }
  }
  const family = await activeFamilyOf(userId, now)
  if (family) {
    const names = await namesOf(users, [family.holderId])
    return { role: 'member', holderName: names.get(family.holderId)?.name ?? '', until: family.until.toISOString() }
  }
  return { role: 'none' }
}

export async function familyByToken(token: string, viewerId: string | null, now: Date = new Date()): Promise<FamilyInvite | null> {
  if (!isFamilyToken(token)) return null
  const { plus, users } = await familyDb()
  const holder = await plus.findOne({ familyToken: token }, { projection: { familyUntil: 1, family: 1 } })
  if (!holder) return null
  const holderName = (await namesOf(users, [holder._id])).get(holder._id)?.name ?? ''
  const family = holder.family ?? []
  const seatsLeft = Math.max(0, FAMILY_SEATS - family.length)
  let status: FamilyInvite['status'] = 'open'
  if (viewerId === holder._id) status = 'own'
  else if (viewerId && family.some((member) => member.userId === viewerId)) status = 'joined'
  else if (!isActive(holder.familyUntil, now)) status = 'ended'
  else if (seatsLeft === 0) status = 'full'
  else if (viewerId && await activeFamilyOf(viewerId, now)) status = 'elsewhere'
  return { status, holderName, seatsLeft }
}

export type JoinResult = { ok: true, until: Date } | { ok: false, error: 'not_found' | 'ended' | 'full' | 'own' | 'elsewhere' }

/** Joins the family behind the link. Joining the one you're already in just says so. */
export async function joinFamily(userId: string, token: string, now: Date = new Date()): Promise<JoinResult> {
  if (!isFamilyToken(token)) return { ok: false, error: 'not_found' }
  const { plus } = await familyDb()
  const holder = await plus.findOne({ familyToken: token }, { projection: { familyUntil: 1, family: 1 } })
  if (!holder) return { ok: false, error: 'not_found' }
  if (holder._id === userId) return { ok: false, error: 'own' }
  if (!holder.familyUntil || !isActive(holder.familyUntil, now)) return { ok: false, error: 'ended' }
  if ((holder.family ?? []).some((member) => member.userId === userId)) return { ok: true, until: holder.familyUntil }
  const current = await activeFamilyOf(userId, now)
  if (current) return { ok: false, error: 'elsewhere' }
  // Families that have ended forget the account first: one family at a time.
  await plus.updateMany({ 'family.userId': userId, _id: { $ne: holder._id } }, { $pull: { family: { userId } } })
  const result = await plus.updateOne(
    { _id: holder._id, familyToken: token, familyUntil: { $gt: now }, 'family.userId': { $ne: userId }, [`family.${FAMILY_SEATS - 1}`]: { $exists: false } },
    { $push: { family: { userId, at: now } } },
  )
  if (result.modifiedCount !== 1) return { ok: false, error: 'full' }
  return { ok: true, until: holder.familyUntil }
}

/** The holder takes someone out of the family. */
export async function removeFromFamily(holderId: string, memberId: string): Promise<boolean> {
  const { plus } = await familyDb()
  return (await plus.updateOne({ _id: holderId }, { $pull: { family: { userId: memberId } } })).modifiedCount === 1
}

/** The account leaves the family it's in. */
export async function leaveFamily(userId: string): Promise<boolean> {
  const { plus } = await familyDb()
  return (await plus.updateMany({ 'family.userId': userId }, { $pull: { family: { userId } } })).modifiedCount > 0
}

/** A new family link: the old one stops working (who already joined stays). */
export async function newFamilyLink(holderId: string, linkBase: string): Promise<string | null> {
  const { plus } = await familyDb()
  const token = randomBytes(16).toString('base64url')
  const result = await plus.updateOne({ _id: holderId, familyUntil: { $ne: null } }, { $set: { familyToken: token } })
  return result.matchedCount === 1 ? `${linkBase}/family/${token}` : null
}

/** Export: the family the account pays for (how many joined), and whether it's in someone's. */
export async function exportFamilyData(userId: string): Promise<unknown> {
  const { plus } = await familyDb()
  const [own, inOne] = await Promise.all([
    plus.findOne({ _id: userId }, { projection: { familyUntil: 1, family: 1 } }),
    plus.countDocuments({ 'family.userId': userId }),
  ])
  return { familyUntil: own?.familyUntil ?? null, familyMembers: own?.family?.length ?? 0, inAFamily: inOne > 0 }
}

/** Account deletion: its own family goes with its plus document (lib/plus); here, its seat in others. */
export async function deleteFamilyData(userId: string): Promise<void> {
  await leaveFamily(userId)
}
