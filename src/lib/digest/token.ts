// The unsubscribe link of a digest e-mail: a token naming the profile, signed so nobody can make
// one for someone else's profile.
//
//   'v1.' + base64url(profileId) + '.' + base64url(first 16 bytes of HMAC-SHA256(key, 'unsub:v1:' + profileId))
//
// The key is EMAIL_TOKEN_SECRET, its own secret (never derived from NEXTAUTH_SECRET, so rotating
// the sign-in secret doesn't break links already in people's inboxes). EMAIL_TOKEN_SECRET_PREVIOUS
// is still accepted while a new key rolls out. Without EMAIL_TOKEN_SECRET there are no links, so
// the digest can't be turned on (GET /api/digest says available: false).
import { createHmac, timingSafeEqual } from 'crypto'

const VERSION = 'v1'
const MAC_BYTES = 16
/** Shorter keys are ignored (they'd be guessable). */
const MIN_KEY_LENGTH = 16

const keys = (): string[] =>
  [process.env.EMAIL_TOKEN_SECRET, process.env.EMAIL_TOKEN_SECRET_PREVIOUS]
    .map((key) => key?.trim() ?? '')
    .filter((key) => key.length >= MIN_KEY_LENGTH)

/** Whether links can be signed (EMAIL_TOKEN_SECRET is set). */
export const emailTokensConfigured = () => (process.env.EMAIL_TOKEN_SECRET?.trim().length ?? 0) >= MIN_KEY_LENGTH

const mac = (key: string, profileId: string) =>
  createHmac('sha256', key).update(`unsub:${VERSION}:${profileId}`, 'utf8').digest().subarray(0, MAC_BYTES)

const isProfileId = (value: string) => /^[a-f0-9]{24}$/.test(value)

/** The signed token for a profile (null when EMAIL_TOKEN_SECRET isn't set). */
export function unsubscribeToken(profileId: string): string | null {
  if (!emailTokensConfigured() || !isProfileId(profileId)) return null
  const key = process.env.EMAIL_TOKEN_SECRET!.trim()
  return `${VERSION}.${Buffer.from(profileId, 'utf8').toString('base64url')}.${mac(key, profileId).toString('base64url')}`
}

/** The profile a token names, when its signature checks out with the current or the previous key. */
export function verifyUnsubscribeToken(token: unknown): string | null {
  if (typeof token !== 'string' || token.length > 120) return null
  const parts = token.split('.')
  if (parts.length !== 3 || parts[0] !== VERSION) return null
  const [, encodedId, encodedMac] = parts
  if (!/^[A-Za-z0-9_-]+$/.test(encodedId) || !/^[A-Za-z0-9_-]+$/.test(encodedMac)) return null
  const profileId = Buffer.from(encodedId, 'base64url').toString('utf8')
  if (!isProfileId(profileId)) return null
  const given = Buffer.from(encodedMac, 'base64url')
  if (given.length !== MAC_BYTES) return null
  let ok = false
  for (const key of keys()) {
    if (timingSafeEqual(given, mac(key, profileId))) ok = true
  }
  return ok ? profileId : null
}

/** The link in the e-mail's footer (the page asks before doing anything). */
export const unsubscribePageUrl = (appUrl: string, token: string) => `${appUrl}/unsubscribe?t=${encodeURIComponent(token)}`
/** The List-Unsubscribe target: a POST there unsubscribes in one click (RFC 8058). */
export const oneClickUrl = (appUrl: string, token: string) => `${appUrl}/api/unsubscribe?t=${encodeURIComponent(token)}`
