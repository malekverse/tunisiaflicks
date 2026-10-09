// Ko-fi and supporter helpers that need no database: reading Ko-fi's form post, checking its token,
// hashing an e-mail, support codes and credit names. Re-exported by src/lib/support.ts; kept apart so
// the unit tests run them without MongoDB.
import { createHmac, randomInt, timingSafeEqual } from 'crypto'

export const LIST_NAME_MAX = 30
export const MAX_WEBHOOK_BYTES = 64 * 1024

// No 0/O, 1/I/L: a code read out loud or typed from a phone stays unambiguous.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const SUPPORT_CODE_RE = /^TF-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{5}$/
const CODE_IN_TEXT_RE = /\bTF-([A-Z0-9]{5})\b/i

/** Equal tokens, compared in constant time (lengths first). */
export function tokenMatches(given: unknown, expected: string): boolean {
  if (typeof given !== 'string' || !expected) return false
  const a = Buffer.from(given, 'utf8')
  const b = Buffer.from(expected, 'utf8')
  return a.length === b.length && timingSafeEqual(a, b)
}

export const normalizeEmail = (email: string) => email.trim().toLowerCase()

/** HMAC-SHA256(SUPPORT_HASH_SECRET, normalized e-mail), hex: how an e-mail is remembered. */
export function emailKey(email: string, secret: string): string {
  return createHmac('sha256', secret).update(normalizeEmail(email), 'utf8').digest('hex')
}

/** 'TF-' and five letters or digits from an unambiguous alphabet. */
export function newSupportCode(): string {
  let code = 'TF-'
  for (let i = 0; i < 5; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]
  return code
}

/** A support code written somewhere in a message ('tf-ab3cd' works too), normalized, or null. */
export function findSupportCode(text: unknown): string | null {
  if (typeof text !== 'string') return null
  const match = CODE_IN_TEXT_RE.exec(text)
  if (!match) return null
  const code = `TF-${match[1].toUpperCase()}`
  return SUPPORT_CODE_RE.test(code) ? code : null
}

export type KofiPayload = {
  verification_token?: unknown
  kofi_transaction_id?: unknown
  message_id?: unknown
  timestamp?: unknown
  type?: unknown
  message?: unknown
  email?: unknown
}

/**
 * The `data` field of Ko-fi's form post, parsed: null when the body isn't a form with a JSON
 * object in `data`, or is bigger than 64KB.
 */
export function parseKofiBody(raw: string): KofiPayload | null {
  if (typeof raw !== 'string' || Buffer.byteLength(raw, 'utf8') > MAX_WEBHOOK_BYTES) return null
  let data: string | null
  try {
    data = new URLSearchParams(raw).get('data')
  } catch {
    return null
  }
  if (!data) return null
  try {
    const parsed = JSON.parse(data)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as KofiPayload : null
  } catch {
    return null
  }
}

/** A name for the credits: one line, no controls, at most 30 characters. */
export function cleanListName(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const name = value.normalize('NFC').replace(/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim()
  return [...name].length <= LIST_NAME_MAX ? name : null
}
