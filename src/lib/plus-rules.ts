// TunisiaFlicks+ and invite rewards: the pure rules (tests/plus.unit.test.mts), safe on the client.
//
// Plus is time: every Ko-fi coffee adds a month, a Ko-fi monthly membership adds a month at every
// payment (so it stays on while the membership runs), and every three friends who join through
// your link (and verify their e-mail) add a month. Time adds up from whichever is later: now, or
// the end of the Plus you already have.

export const PLUS_DAYS = 31
/** Friends who join (verified) per free month. */
export const FRIENDS_PER_MONTH = 3
/** At most this many months from invites, ever. */
export const INVITE_MONTHS_MAX = 12

export const ACCENTS = ['red', 'gold', 'emerald', 'ocean', 'violet', 'rose'] as const
export type Accent = typeof ACCENTS[number]
export const isAccent = (value: unknown): value is Accent => typeof value === 'string' && (ACCENTS as readonly string[]).includes(value)
export const ACCENT_COOKIE = 'tf-accent'

/** What a Plus account gets beyond the usual limits. */
export const LIMITS = {
  profiles: { free: 5, plus: 8 },
  lists: { free: 50, plus: 150 },
} as const
export const limitFor = (what: keyof typeof LIMITS, plus: boolean) => LIMITS[what][plus ? 'plus' : 'free']

const DAY = 86_400_000

/** The new end of Plus after adding `days` at `at`. */
export function extendUntil(until: Date | null | undefined, days: number, at: Date = new Date()): Date {
  const from = until && until.getTime() > at.getTime() ? until.getTime() : at.getTime()
  return new Date(from + days * DAY)
}

export const isActive = (until: Date | string | null | undefined, now: Date = new Date()) => !!until && new Date(until).getTime() > now.getTime()

/** Whole days left (rounded up), 0 once it's over. */
export const daysLeft = (until: Date | string | null | undefined, now: Date = new Date()) =>
  until ? Math.max(0, Math.ceil((new Date(until).getTime() - now.getTime()) / DAY)) : 0

/** Months earned from `friends` verified friends, and how many are still to grant. */
export function inviteMonths(friends: number, granted: number): { earned: number, due: number } {
  const earned = Math.min(INVITE_MONTHS_MAX, Math.floor(Math.max(0, friends) / FRIENDS_PER_MONTH))
  return { earned, due: Math.max(0, earned - Math.max(0, granted)) }
}

/** Progress towards the next free month: friends counted so far in this round (0, 1 or 2). */
export const towardsNext = (friends: number) => (Math.floor(friends / FRIENDS_PER_MONTH) >= INVITE_MONTHS_MAX ? FRIENDS_PER_MONTH : friends % FRIENDS_PER_MONTH)

// ---- the invite link -----------------------------------------------------------------------------

const REF_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'
export const REF_RE = /^[a-hjkmnp-z2-9]{8}$/
export const isRefCode = (value: unknown): value is string => typeof value === 'string' && REF_RE.test(value)

/** A new code from random bytes (8 characters, no look-alikes like 0/o or 1/l). */
export function refCodeFrom(bytes: Uint8Array): string {
  return Array.from(bytes.slice(0, 8), (byte) => REF_ALPHABET[byte % REF_ALPHABET.length]).join('')
}

/** A friend's account can take an invite only while it's new (and only once). */
export const CLAIM_WINDOW_DAYS = 3
export const isNewAccount = (createdAt: Date, now: Date = new Date()) => now.getTime() - createdAt.getTime() <= CLAIM_WINDOW_DAYS * DAY

/** A ref link stays remembered on the device this long. */
export const REF_KEEP_DAYS = 30

// ---- gifts ---------------------------------------------------------------------------------------
//
// A gift has two codes. GIFT-XXXXXXXX goes in the Ko-fi message, which Ko-fi may show publicly: it
// only says which gift a payment is for. The link the friend opens carries a separate secret
// (22 url-safe characters) that only the giver's account ever sees.

const GIFT_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const GIFT_CODE_RE = /^GIFT-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/
const GIFT_IN_TEXT_RE = /\bGIFT-([A-Z0-9]{8})\b/i
export const GIFT_TOKEN_RE = /^[A-Za-z0-9_-]{22}$/
/** Gifts made but not paid yet, per account. */
export const MAX_OPEN_GIFTS = 5
/** An unpaid gift is forgotten after this. */
export const GIFT_UNPAID_DAYS = 30
export const GIFT_FROM_MAX = 30

export const isGiftCode = (value: unknown): value is string => typeof value === 'string' && GIFT_CODE_RE.test(value)
export const isGiftToken = (value: unknown): value is string => typeof value === 'string' && GIFT_TOKEN_RE.test(value)

/** A new gift code from random bytes. */
export function giftCodeFrom(bytes: Uint8Array): string {
  return `GIFT-${Array.from(bytes.slice(0, 8), (byte) => GIFT_ALPHABET[byte % GIFT_ALPHABET.length]).join('')}`
}

/** A gift code written somewhere in a Ko-fi message ('gift-ab3cd5ef' works too), normalized, or null. */
export function findGiftCode(text: unknown): string | null {
  if (typeof text !== 'string') return null
  const match = GIFT_IN_TEXT_RE.exec(text)
  if (!match) return null
  const code = `GIFT-${match[1].toUpperCase()}`
  return isGiftCode(code) ? code : null
}

/** The giver's name on the gift: one line, no control characters, at most 30 characters, or ''. */
export function cleanFromName(value: unknown): string {
  if (typeof value !== 'string') return ''
  const name = value.normalize('NFC').replace(/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim()
  return [...name].slice(0, GIFT_FROM_MAX).join('')
}

// ---- family --------------------------------------------------------------------------------------
//
// A Ko-fi payment from the membership tier named Family (or Famille, عائلة) gives the payer's own
// Plus as usual, and a month of family sharing: up to FAMILY_SEATS other accounts join through the
// account's family link and have Plus while the family does.

export const FAMILY_SEATS = 3
export const FAMILY_TOKEN_RE = /^[A-Za-z0-9_-]{22}$/
export const isFamilyToken = (value: unknown): value is string => typeof value === 'string' && FAMILY_TOKEN_RE.test(value)

/** A Ko-fi tier name that means the Family membership. */
export function isFamilyTier(name: unknown): boolean {
  if (typeof name !== 'string' || name.length > 100) return false
  return /\bfamil(y|le|ia)\b/i.test(name) || /عائل|عايل/.test(name)
}
