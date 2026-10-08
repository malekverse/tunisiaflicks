// The social layer's pure rules: handle and text checks, who may see what, notification keys and
// merges, block lookups. No database, no Next.js, no Node-only modules: the server libraries use
// them, the client reuses the text checks, and tests/social.unit.test.mjs runs them as they are.
import { HANDLE_RE, RESERVED_HANDLES, RESERVED_SUBSTRINGS } from './types'
import type { MediaRef, NotificationKind, PrivacySettings, ProfileRef, Visibility } from './types'

// ---------------------------------------------------------------------------------------------
// Handles and display names

/** Digits people use to dodge a word filter ('4dm1n'). 1 reads as l or i, so both are tried. */
const DIGIT_FOLD: Record<string, string> = { 0: 'o', 1: 'l', 3: 'e', 4: 'a', 5: 's', 7: 't' }

/**
 * The forms a handle or a name is checked in: NFKC, accents and separators removed, lower case,
 * look-alike digits folded into letters (two variants when a 1 is involved).
 */
export function foldForReserved(value: string): string[] {
  const base = value
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '')
  const primary = base.replace(/[013457]/g, (digit) => DIGIT_FOLD[digit])
  const alternate = base.replace(/[013457]/g, (digit) => (digit === '1' ? 'i' : DIGIT_FOLD[digit]))
  return primary === alternate ? [primary] : [primary, alternate]
}

/** True when the text, folded, contains a word that would pass for the site or its staff. */
export const hasReservedSubstring = (value: string) =>
  foldForReserved(value).some((folded) => RESERVED_SUBSTRINGS.some((word) => folded.includes(word)))

/** '@Amine_TN ' -> 'amine_tn' (what people type into the handle field); null for non-strings. */
export function normalizeHandle(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  return raw.trim().replace(/^@+/, '').toLowerCase()
}

export type HandleProblem = 'invalid' | 'reserved'

/** Why a (normalized) handle can't be claimed, or null when it may be (availability aside). */
export function checkHandle(handle: string): HandleProblem | null {
  if (!HANDLE_RE.test(handle)) return 'invalid'
  if (RESERVED_HANDLES.has(handle)) return 'reserved'
  const folded = foldForReserved(handle)
  if (folded.some((form) => RESERVED_HANDLES.has(form))) return 'reserved'
  if (hasReservedSubstring(handle)) return 'reserved'
  return null
}

/**
 * Up to `count` handle ideas built from what was typed and the person's name, all well-formed and
 * unreserved (availability is checked by the caller against the database).
 */
export function handleIdeas(typed: string, name: string, seed = Date.now()): string[] {
  const slug = (value: string) => value
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
  const bases = Array.from(new Set([slug(typed), slug(name), slug(name).replace(/_/g, '')].filter((base) => base.length >= 2)))
  // When what was typed can't be used at all (a reserved word), film words still give ideas.
  bases.push('cinephile', 'movie_fan', 'series_fan')
  const ideas: string[] = []
  const push = (value: string) => {
    const handle = value.slice(0, 20)
    if (!ideas.includes(handle) && checkHandle(handle) === null) ideas.push(handle)
  }
  let n = seed
  const next = () => {
    n = (n * 1103515245 + 12345) % 2147483648
    return n
  }
  for (const base of bases) {
    const trimmed = base.slice(0, 16)
    push(trimmed.length >= 3 ? trimmed : `${trimmed}_tn`)
    push(`${trimmed}_tn`)
    push(`${trimmed}${(next() % 90) + 10}`)
    push(`the_${trimmed}`.slice(0, 20))
    push(`${trimmed}_${(next() % 900) + 100}`)
  }
  return ideas
}

// ---------------------------------------------------------------------------------------------
// Text people write that other people will read (names, bios, notes)

const CONTROL = /[\u0000-\u001f\u007f-\u009f]/g
/** Direction overrides and isolates: they can flip how the text around them reads. */
const BIDI = /[؜‎‏‪-‮⁦-⁩]/g
/** Links, bare domains included ('watch-free.xyz/abc'): notes and bios are not a way to spread links. */
const LINK = /(?:https?:\/\/|www\.)\S*|\b[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)*\.(?:com|net|org|io|me|tn|fr|co|xyz|app|link|ly|gg|tv|info|biz|site|online|ru|de|uk|us|live|top|club|shop|store|vip|pro|cc|to|sh|ai)\b(?:\/\S*)?/giu

/** Plain, single-line text of at most `max` characters: no control or direction marks, no links. */
export function cleanUserText(value: unknown, max: number): string {
  if (typeof value !== 'string') return ''
  const text = value
    .replace(CONTROL, ' ')
    .replace(BIDI, '')
    .replace(LINK, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return Array.from(text).slice(0, max).join('').trim()
}

export const NAME_MAX = 40
export const BIO_MAX = 160
export const NOTE_MAX = 140

/** A display name (1 to 40 characters), or null when nothing usable is left or it imitates the site. */
export function cleanDisplayName(value: unknown): string | null {
  const name = cleanUserText(value, NAME_MAX)
  if (!name || hasReservedSubstring(name)) return null
  return name
}

export const cleanBio = (value: unknown) => cleanUserText(value, BIO_MAX)
export const cleanNote = (value: unknown) => cleanUserText(value, NOTE_MAX)

// ---------------------------------------------------------------------------------------------
// Who may see what

export type SeeWhat = 'activity' | 'ratings' | 'badges'

/** The setting that applies: activity is only ever private or friends (a link never shows it). */
export function settingFor(privacy: PrivacySettings, what: SeeWhat): Visibility {
  if (what === 'activity') return privacy.activity === 'friends' ? 'friends' : 'private'
  const value = privacy[what]
  return value === 'friends' || value === 'link' ? value : 'private'
}

/** The relations canSee looks up lazily (only when the answer depends on them). */
export type SeeRelations = {
  blocked: () => Promise<boolean>
  friends: () => Promise<boolean>
}

/**
 * canSee, without the database: the owner always sees; nobody else sees a paused or private
 * section, or anything of someone they block or who blocks them. 'friends' means friends; 'link'
 * means friends, or holding the page's private link (`keyMatches`), except for activity.
 */
export async function canSeeWith(input: {
  viewer: ProfileRef | null
  owner: ProfileRef
  what: SeeWhat
  privacy: PrivacySettings | null
  keyMatches: boolean
}, relations: SeeRelations): Promise<boolean> {
  const { viewer, owner, what, privacy } = input
  if (viewer && viewer.profileId === owner.profileId) return true
  if (!privacy || privacy.paused) return false
  const setting = settingFor(privacy, what)
  if (setting === 'private') return false
  if (viewer && (await relations.blocked())) return false
  if (setting === 'link' && input.keyMatches) return true
  if (!viewer) return false
  return relations.friends()
}

// ---------------------------------------------------------------------------------------------
// Friendships and blocks

/** One key per pair of profiles, whatever the order. */
export const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`)

/** The block documents that separate a and b: either profile blocking the other, or either account. */
export function blockFilter(a: ProfileRef, b: ProfileRef) {
  return {
    $or: [
      { blockerProfileId: a.profileId, blockedProfileId: b.profileId },
      { blockerProfileId: b.profileId, blockedProfileId: a.profileId },
      { blockerUserId: a.userId, blockedUserId: b.userId },
      { blockerUserId: b.userId, blockedUserId: a.userId },
    ],
  }
}

/** isBlockedEitherWay over any collection-like object (the real one, or a stub in tests). */
export async function isBlockedWith(
  blocks: { findOne: (filter: Record<string, unknown>, options?: Record<string, unknown>) => Promise<unknown> },
  a: ProfileRef,
  b: ProfileRef,
): Promise<boolean> {
  if (a.userId === b.userId) return false
  return !!(await blocks.findOne(blockFilter(a, b), { projection: { _id: 1 } }))
}

// ---------------------------------------------------------------------------------------------
// Notifications

/** Fits the existing unique index {userId, event_key}: one event per kind, recipient profile and key. */
export const eventKey = (kind: NotificationKind, profileId: string, key: string) => `${kind}:${profileId}:${key}`

/** What merges: the same kind about the same title. */
export const mergeKeyFor = (kind: NotificationKind, media: MediaRef) => `${kind}:${media.media_type}:${media.id}`

export const MERGE_WINDOW_MS = 24 * 60 * 60 * 1000

/** A notification may merge into another only when asked to, about a title, and without a note. */
export function mergeEligible(input: { merge?: boolean; note?: string | null; media?: MediaRef | null }): boolean {
  return !!input.merge && !input.note && !!input.media
}

/** Whether `existing` can take `incoming` in: same profile and merge key, still unread, under 24h old. */
export function canMergeInto(
  existing: { profileId: string | null; merge_key?: string | null; read: boolean; created_at: Date },
  incoming: { profileId: string; merge_key: string },
  now = Date.now(),
): boolean {
  return existing.profileId === incoming.profileId
    && !!existing.merge_key
    && existing.merge_key === incoming.merge_key
    && !existing.read
    && now - new Date(existing.created_at).getTime() < MERGE_WINDOW_MS
}

// ---------------------------------------------------------------------------------------------
// Ratings and dates

/** Averages are shown to the nearest half star. */
export const roundHalf = (value: number) => Math.round(value * 2) / 2

/** How many accounts an average stands on, in rounded bands (never the exact number). */
export function countLabelFor(accounts: number): string | null {
  if (accounts >= 500) return '500+'
  if (accounts >= 100) return '100+'
  if (accounts >= 50) return '50+'
  if (accounts >= 20) return '20+'
  return null
}

const TUNIS_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Tunis', year: 'numeric', month: '2-digit', day: '2-digit' })

/** YYYY-MM-DD in Africa/Tunis: the only time friends ever see. */
export const tunisDay = (date: Date | string | number) => TUNIS_DAY.format(new Date(date))

// ---------------------------------------------------------------------------------------------
// Rate-limit keys

/** An IPv4 address as is; an IPv6 address by its /64 (one household or phone gets many). */
export function ipKey(ip: string): string {
  const value = ip.trim().toLowerCase()
  if (!value.includes(':')) return value
  const [head, tail = ''] = value.split('::')
  const left = head ? head.split(':') : []
  const right = value.includes('::') && tail ? tail.split(':') : []
  const groups = value.includes('::')
    ? [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill('0'), ...right]
    : left
  return `${groups.slice(0, 4).map((group) => group.replace(/^0+(?=.)/, '')).join(':')}::/64`
}
