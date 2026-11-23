// Gifting TunisiaFlicks+ (lib/plus-rules has the codes). A grown-up makes a gift on /plus and pays
// for it on Ko-fi with its GIFT- code in the message (lib/support processKofi): every payment with
// the code adds a month to that gift. Once paid, the giver sends the gift's link (/gift/<token>) to
// a friend, who redeems it: the months become their Plus. Payments that come after it's redeemed
// (a Ko-fi membership with the code) go straight to the friend.
//
// plusGifts {_id: 'GIFT-XXXXXXXX', token, fromUserId, fromName, createdAt, months, paidAt,
//            redeemedBy, redeemedAt, expireAt (unpaid only: +30 days)}
import 'server-only'
import { randomBytes } from 'crypto'
import type { Collection } from 'mongodb'
import clientPromise from '@/src/lib/mongodb'
import { addPlusDays } from '@/src/lib/plus'
import {
  GIFT_UNPAID_DAYS, MAX_OPEN_GIFTS, PLUS_DAYS, cleanFromName, giftCodeFrom, isGiftCode, isGiftToken,
} from '@/src/lib/plus-rules'

type GiftDoc = {
  _id: string
  token: string
  fromUserId: string | null
  fromName: string
  createdAt: Date
  months: number
  paidAt: Date | null
  redeemedBy: string | null
  redeemedAt: Date | null
  expireAt?: Date
}

/** A gift as its giver sees it: the link only once it's paid. */
export type GiftView = { code: string, link: string | null, months: number, paid: boolean, redeemedAt: string | null, createdAt: string }

/** A gift as the friend with its link sees it (never who the giver's account is, only the name they wrote). */
export type GiftPage =
  | { status: 'unpaid' | 'ready', months: number, fromName: string }
  | { status: 'redeemed', months: number, fromName: string, mine: boolean }

const isDuplicateKey = (error: unknown) => (error as { code?: number })?.code === 11000

let ready: Promise<unknown> | null = null
async function giftsDb(): Promise<Collection<GiftDoc>> {
  const gifts = (await clientPromise).db().collection<GiftDoc>('plusGifts')
  ready ??= Promise.all([
    gifts.createIndex({ token: 1 }, { unique: true }),
    gifts.createIndex({ fromUserId: 1, createdAt: -1 }),
    gifts.createIndex({ expireAt: 1 }, { expireAfterSeconds: 0 }),
  ]).catch((error) => {
    ready = null
    console.error('plus-gifts: creating indexes failed', error)
  })
  await ready
  return gifts
}

const viewOf = (gift: GiftDoc, linkBase: string): GiftView => ({
  code: gift._id,
  link: gift.paidAt ? `${linkBase}/gift/${gift.token}` : null,
  months: gift.months,
  paid: !!gift.paidAt,
  redeemedAt: gift.redeemedAt ? gift.redeemedAt.toISOString() : null,
  createdAt: gift.createdAt.toISOString(),
})

export type CreateResult = { ok: true, gift: GiftView } | { ok: false, error: 'too_many' }

/** A new gift, waiting for its payment (at most MAX_OPEN_GIFTS unpaid ones per account). */
export async function createGift(userId: string, fromName: unknown, linkBase: string, now: Date = new Date()): Promise<CreateResult> {
  const gifts = await giftsDb()
  const open = await gifts.countDocuments({ fromUserId: userId, paidAt: null })
  if (open >= MAX_OPEN_GIFTS) return { ok: false, error: 'too_many' }
  for (let attempt = 0; attempt < 5; attempt++) {
    const gift: GiftDoc = {
      _id: giftCodeFrom(randomBytes(8)),
      token: randomBytes(16).toString('base64url'),
      fromUserId: userId,
      fromName: cleanFromName(fromName),
      createdAt: now,
      months: 0,
      paidAt: null,
      redeemedBy: null,
      redeemedAt: null,
      expireAt: new Date(now.getTime() + GIFT_UNPAID_DAYS * 86_400_000),
    }
    try {
      await gifts.insertOne(gift)
      return { ok: true, gift: viewOf(gift, linkBase) }
    } catch (error) {
      if (!isDuplicateKey(error)) throw error
    }
  }
  throw new Error('plus-gifts: no free code')
}

/** The account's gifts, newest first (the last 20). */
export async function listGifts(userId: string, linkBase: string): Promise<GiftView[]> {
  const gifts = await giftsDb()
  const list = await gifts.find({ fromUserId: userId }).sort({ createdAt: -1 }).limit(20).toArray()
  return list.map((gift) => viewOf(gift, linkBase))
}

/** Cancels a gift that isn't paid yet. */
export async function cancelGift(userId: string, code: string): Promise<boolean> {
  if (!isGiftCode(code)) return false
  const gifts = await giftsDb()
  return (await gifts.deleteOne({ _id: code, fromUserId: userId, paidAt: null })).deletedCount === 1
}

/** Who made the gift a Ko-fi message names (they get the supporter's thanks), or null for no such gift. */
export async function giftGiver(code: string): Promise<{ fromUserId: string | null } | null> {
  if (!isGiftCode(code)) return null
  const gifts = await giftsDb()
  const gift = await gifts.findOne({ _id: code }, { projection: { fromUserId: 1 } })
  return gift ? { fromUserId: gift.fromUserId } : null
}

/**
 * One Ko-fi payment for a gift (lib/support, once per transaction): a month more on it. Already
 * redeemed, the month goes to the friend's Plus. Atomic with redeemGift: a month is never counted
 * twice, nor lost.
 */
export async function creditGift(code: string, at: Date): Promise<void> {
  const gifts = await giftsDb()
  const gift = (await gifts.findOneAndUpdate({ _id: code }, { $inc: { months: 1 }, $unset: { expireAt: '' } }, { returnDocument: 'after' })).value
  if (!gift) return
  if (!gift.paidAt) await gifts.updateOne({ _id: code, paidAt: null }, { $set: { paidAt: at } })
  if (gift.redeemedBy) await addPlusDays(gift.redeemedBy, PLUS_DAYS, 'gift', at)
}

/** What the gift's link shows. */
export async function giftByToken(token: string, viewerId: string | null): Promise<GiftPage | null> {
  if (!isGiftToken(token)) return null
  const gifts = await giftsDb()
  const gift = await gifts.findOne({ token })
  if (!gift) return null
  if (gift.redeemedBy || gift.redeemedAt) return { status: 'redeemed', months: gift.months, fromName: gift.fromName, mine: !!viewerId && gift.redeemedBy === viewerId }
  return { status: gift.paidAt && gift.months > 0 ? 'ready' : 'unpaid', months: gift.months, fromName: gift.fromName }
}

export type RedeemResult = { ok: true, months: number, until: Date } | { ok: false, error: 'not_found' | 'unpaid' | 'used' }

/** The friend takes the gift: its months become their Plus. Once. */
export async function redeemGift(userId: string, token: string, now: Date = new Date()): Promise<RedeemResult> {
  if (!isGiftToken(token)) return { ok: false, error: 'not_found' }
  const gifts = await giftsDb()
  const gift = (await gifts.findOneAndUpdate(
    { token, paidAt: { $ne: null }, months: { $gt: 0 }, redeemedBy: null, redeemedAt: null },
    { $set: { redeemedBy: userId, redeemedAt: now } },
    { returnDocument: 'after' },
  )).value
  if (!gift) {
    const found = await gifts.findOne({ token }, { projection: { paidAt: 1, redeemedAt: 1 } })
    return { ok: false, error: !found ? 'not_found' : found.redeemedAt ? 'used' : 'unpaid' }
  }
  let until = now
  for (let month = 0; month < gift.months; month++) until = await addPlusDays(userId, PLUS_DAYS, 'gift', now)
  return { ok: true, months: gift.months, until }
}

/** Export: the gifts made, and how many were received. */
export async function exportGiftData(userId: string): Promise<unknown> {
  const gifts = await giftsDb()
  const [made, received] = await Promise.all([
    gifts.find({ fromUserId: userId }, { projection: { token: 0, redeemedBy: 0 } }).toArray(),
    gifts.countDocuments({ redeemedBy: userId }),
  ])
  return { giftsMade: made.map((g) => ({ code: g._id, fromName: g.fromName, createdAt: g.createdAt, months: g.months, paidAt: g.paidAt, redeemedAt: g.redeemedAt })), giftsReceived: received }
}

/**
 * Account deletion: unpaid gifts go; paid ones still work for the friend (they're paid for), but no
 * longer name the account; a received one forgets who took it.
 */
export async function deleteGiftData(userId: string): Promise<void> {
  const gifts = await giftsDb()
  await gifts.deleteMany({ fromUserId: userId, paidAt: null })
  await gifts.updateMany({ fromUserId: userId }, { $set: { fromUserId: null, fromName: '' } })
  await gifts.updateMany({ redeemedBy: userId }, { $set: { redeemedBy: null } })
}
