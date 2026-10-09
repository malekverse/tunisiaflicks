// Signing a TV in with a phone (a device-code flow, like the big streaming apps):
// 1. The TV asks for a pairing (POST /api/tv/pair): a secret deviceCode it keeps, and a short
//    userCode it shows (and a QR code of /activate?code=…).
// 2. On the phone, a signed-in grown-up looks the code up (it counts: 5 lookups burn it), says
//    "yes, that's my TV", picks a profile and approves: pending → approved, atomically.
// 3. The TV, polling with its deviceCode, sees 'approved' and signs in with the 'tv-pair' provider
//    (src/lib/auth.ts): approved → used, atomically, and a revocable tvSessions entry is made.
// A pairing lives 10 minutes (TTL index). Nothing about the TV is kept but a device family label
// from a fixed list: never its user agent, never its IP.
import { randomBytes, randomInt } from 'node:crypto'

/** The swipe-room alphabet: no 0/O, 1/I, so a code read off a TV is never ambiguous. */
export const USER_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const USER_CODE_LENGTH = 6
export const PAIRING_TTL_MS = 10 * 60 * 1000
/** The lookup that burns a code (the 5th). */
export const MAX_LOOKUPS = 5

export type PairingStatus = 'pending' | 'approved' | 'denied' | 'used'

export const DEVICE_LABELS = ['app', 'androidTv', 'googleTv', 'fireTv', 'samsungTv', 'lgTv', 'sonyTv', 'xiaomiTv', 'tvBox', 'computer', 'phone', 'other'] as const
export type DeviceLabel = (typeof DEVICE_LABELS)[number]

export type TvPairing = {
  _id: string               // deviceCode: 32 random bytes, base64url (43 characters)
  userCode: string          // 6 characters from USER_CODE_ALPHABET, unique among live pairings
  status: PairingStatus
  deviceLabel: DeviceLabel
  locale: string
  lookups: number
  createdAt: Date
  expiresAt: Date           // TTL
  userId?: string
  profileId?: string
  approvedAt?: Date
  usedAt?: Date
}

// ---------------------------------------------------------------------------------------------
// Pure helpers (unit-tested).

export function newDeviceCode(): string {
  return randomBytes(32).toString('base64url')
}

export const isDeviceCode = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value)

export function newUserCode(): string {
  return Array.from({ length: USER_CODE_LENGTH }, () => USER_CODE_ALPHABET[randomInt(USER_CODE_ALPHABET.length)]).join('')
}

/**
 * A code as typed on a phone ('abc 234', 'ABC-234', 'abc234'), uppercased and without separators,
 * or null when it can't be a code. O and I are read as 0/1 never: those letters don't exist in
 * the alphabet, so a code with them is simply invalid.
 */
export function normalizeUserCode(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const code = value.toUpperCase().replace(/[\s\-–—.]/g, '')
  if (code.length !== USER_CODE_LENGTH) return null
  for (const char of code) if (!USER_CODE_ALPHABET.includes(char)) return null
  return code
}

/** 'ABC234' → 'ABC 234' (how a code is shown: two groups of three). */
export const formatUserCode = (code: string) => `${code.slice(0, 3)} ${code.slice(3)}`

/** The device family, from a fixed list (the only thing kept about the TV). */
export function deviceLabelFromUa(ua: string | null | undefined): DeviceLabel {
  const s = ua ?? ''
  if (/TunisiaFlicksTV\//.test(s)) return 'app'
  if (/AFT[A-Z]|Fire ?TV/i.test(s)) return 'fireTv'
  if (/GoogleTV|Google TV|Chromecast/i.test(s)) return 'googleTv'
  if (/BRAVIA/i.test(s)) return 'sonyTv'
  if (/Tizen|Samsung.*SMART-?TV|SMART-?TV.*Samsung/i.test(s)) return 'samsungTv'
  if (/Web0S|webOS|NetCast/i.test(s)) return 'lgTv'
  if (/MiTV|Mi ?Box/i.test(s)) return 'xiaomiTv'
  if (/Android ?TV/i.test(s)) return 'androidTv'
  if (/TV ?Box|Amlogic|HbbTV|SMART-?TV|\bSTB\b/i.test(s)) return 'tvBox'
  if (/iPhone|iPad|Android|Mobile/i.test(s)) return 'phone'
  if (/Windows|Macintosh|Mac OS X|CrOS|Linux|X11/i.test(s)) return 'computer'
  return 'other'
}

export const isDeviceLabel = (value: unknown): value is DeviceLabel => typeof value === 'string' && (DEVICE_LABELS as readonly string[]).includes(value)

/** Whole minutes since the pairing was asked for (0 under a minute). */
export const minutesAgo = (createdAt: Date, now = Date.now()) => Math.max(0, Math.floor((now - createdAt.getTime()) / 60_000))

// ---------------------------------------------------------------------------------------------
// Storage. The database module is imported lazily so the helpers above load without one.

let indexes: Promise<unknown> | null = null

async function pairings() {
  const client = await (await import('@/src/lib/mongodb')).default
  const collection = client.db().collection<TvPairing>('tvPairings')
  indexes ??= Promise.all([
    collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    collection.createIndex({ userCode: 1 }, { unique: true }),
  ]).catch((error) => {
    indexes = null
    console.error('tvPairings indexes:', error)
  })
  await indexes
  return collection
}

/** A new pending pairing for the TV that asked (POST /api/tv/pair). */
export async function createPairing({ userAgent, locale }: { userAgent: string | null; locale: string }): Promise<{ deviceCode: string; userCode: string; expiresAt: Date }> {
  const collection = await pairings()
  const now = new Date()
  // The unique index settles the (rare) clash between two live codes: try another one.
  for (let attempt = 0; attempt < 5; attempt++) {
    const doc: TvPairing = {
      _id: newDeviceCode(),
      userCode: newUserCode(),
      status: 'pending',
      deviceLabel: deviceLabelFromUa(userAgent),
      locale,
      lookups: 0,
      createdAt: now,
      expiresAt: new Date(now.getTime() + PAIRING_TTL_MS),
    }
    try {
      await collection.insertOne(doc)
      return { deviceCode: doc._id, userCode: doc.userCode, expiresAt: doc.expiresAt }
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error
    }
  }
  throw new Error('Could not find a free pairing code')
}

/** What the TV sees while it waits ('expired' once the 10 minutes are up or the pairing is gone). */
export async function pairingStatus(deviceCode: string): Promise<{ status: PairingStatus | 'expired'; expiresAt: Date | null }> {
  const doc = await (await pairings()).findOne({ _id: deviceCode }, { projection: { status: 1, expiresAt: 1 } })
  if (!doc) return { status: 'expired', expiresAt: null }
  if (doc.expiresAt.getTime() <= Date.now() && doc.status !== 'used') return { status: 'expired', expiresAt: doc.expiresAt }
  return { status: doc.status, expiresAt: doc.expiresAt }
}

export type LookupResult =
  | { ok: true; deviceLabel: DeviceLabel; requestedMinutesAgo: number }
  | { ok: false; reason: 'not_found' | 'burned' }

/**
 * The phone looks a code up (only live, pending codes match). Every lookup counts; the 5th burns
 * the code (denied), so a code can't be tried over and over.
 */
export async function lookupPairing(code: string): Promise<LookupResult> {
  const collection = await pairings()
  const now = new Date()
  const result = await collection.findOneAndUpdate(
    { userCode: code, status: 'pending', expiresAt: { $gt: now } },
    { $inc: { lookups: 1 } },
    { returnDocument: 'after' },
  )
  // mongodb 5 driver: the document is in `.value`.
  const doc = result.value
  if (!doc) return { ok: false, reason: 'not_found' }
  if (doc.lookups >= MAX_LOOKUPS) {
    await collection.updateOne({ _id: doc._id, status: 'pending' }, { $set: { status: 'denied' } })
    return { ok: false, reason: 'burned' }
  }
  return { ok: true, deviceLabel: doc.deviceLabel, requestedMinutesAgo: minutesAgo(doc.createdAt) }
}

/**
 * The phone's answer. Approving pins the pairing to one profile of the account: pending → approved
 * in one atomic update (a code can only ever be approved once). Declining burns it.
 */
export async function answerPairing(code: string, answer: { approve: true; userId: string; profileId: string } | { approve: false }): Promise<boolean> {
  const collection = await pairings()
  const now = new Date()
  const live = { userCode: code, status: 'pending' as const, expiresAt: { $gt: now }, lookups: { $lt: MAX_LOOKUPS } }
  const update = answer.approve
    ? { $set: { status: 'approved' as const, userId: answer.userId, profileId: answer.profileId, approvedAt: now } }
    : { $set: { status: 'denied' as const } }
  const result = await collection.updateOne(live, update)
  return result.modifiedCount === 1
}

/** The TV signs in: approved → used, atomically (a deviceCode signs in once). The pairing, or null. */
export async function consumePairing(deviceCode: string): Promise<TvPairing | null> {
  const collection = await pairings()
  const now = new Date()
  const result = await collection.findOneAndUpdate(
    { _id: deviceCode, status: 'approved', expiresAt: { $gt: now } },
    { $set: { status: 'used', usedAt: now } },
    { returnDocument: 'after' },
  )
  return result.value ?? null
}
