// The digest settings of one profile, as Settings shows them (GET /api/digest), and the changes
// it can make (PUT /api/digest). Also the account's release-e-mail switch, which sits in
// Settings > Following but is read and written here.
import { ObjectId } from 'mongodb'
import { isLocale, type Locale } from '@/src/lib/i18n/locales'
import type { Profile } from '@/src/lib/models/Profile'
import { deliveryExpiry, deliveryId, digestCollections } from '@/src/lib/digest/db'
import { digestConfigured } from '@/src/lib/digest/build'
import { editionFor, isOpen, nextEdition } from '@/src/lib/digest/schedule'

export type DigestNext = {
  /** When the next one opens (ISO). */
  at: string
  /** It falls in Ramadan (it opens at 21:30 instead of 17:00). */
  ramadan: boolean
  /** This week's is going out right now and this profile's hasn't gone yet. */
  sending: boolean
}

export type DigestState = {
  /** E-mail and signed links are set up (and the digest isn't switched off). */
  available: boolean
  /** This profile can't change it (a Kids profile, or a TV signed in with a code). */
  locked: boolean
  enabled: boolean
  email: string | null
  emailVerified: boolean
  locale: Locale
  pausedReason: 'bounced' | null
  /** Account-wide: release alerts also come by e-mail. */
  releaseAlerts: boolean
  next: DigestNext | null
}

const UNDO_MS = 24 * 3600 * 1000

async function account(userId: string) {
  const { users } = await digestCollections()
  return ObjectId.isValid(userId)
    ? users.findOne({ _id: new ObjectId(userId) }, { projection: { email: 1, emailVerified: 1, emailPrefs: 1 } })
    : null
}

export async function digestState({ userId, profile, limited, fallbackLocale, now = new Date() }: {
  userId: string
  profile: Profile
  limited: boolean
  fallbackLocale: Locale
  now?: Date
}): Promise<DigestState> {
  const { prefs, deliveries } = await digestCollections()
  const [pref, user] = await Promise.all([prefs.findOne({ _id: profile.id }), account(userId)])
  const enabled = !!pref?.enabled
  const current = editionFor(now)
  const upcoming = nextEdition(now)
  let sending = false
  if (enabled && isOpen(current, now)) {
    const delivery = await deliveries.findOne({ _id: deliveryId(current.id, profile.id) }, { projection: { status: 1 } })
    sending = !delivery || ['queued', 'building', 'sending'].includes(delivery.status)
  }
  return {
    available: digestConfigured(),
    locked: profile.kids || limited,
    enabled,
    email: user?.email ? String(user.email) : null,
    emailVerified: !!user?.emailVerified,
    locale: pref && isLocale(pref.locale) ? pref.locale : fallbackLocale,
    pausedReason: pref?.paused_reason ?? null,
    releaseAlerts: user?.emailPrefs?.releaseAlerts !== false,
    next: { at: upcoming.opensAt.toISOString(), ramadan: upcoming.inRamadan, sending },
  }
}

export type DigestChange = { enabled?: boolean; locale?: Locale; releaseAlerts?: boolean }

/** Applies a change. Turning the digest on needs mail set up and a confirmed address. */
export async function updateDigest({ userId, profile, change, fallbackLocale, now = new Date() }: {
  userId: string
  profile: Profile
  change: DigestChange
  fallbackLocale: Locale
  now?: Date
}): Promise<{ ok: true } | { error: 'unavailable' | 'unverified' }> {
  const { prefs, deliveries, users } = await digestCollections()

  if (change.enabled === true) {
    if (!digestConfigured()) return { error: 'unavailable' }
    const user = await account(userId)
    if (!user?.emailVerified) return { error: 'unverified' }
  }

  if (change.releaseAlerts !== undefined && ObjectId.isValid(userId)) {
    await users.updateOne({ _id: new ObjectId(userId) }, { $set: { 'emailPrefs.releaseAlerts': change.releaseAlerts } })
  }

  if (change.enabled !== undefined || change.locale !== undefined) {
    const set: Record<string, unknown> = { userId, updated_at: now }
    if (change.locale !== undefined) set.locale = change.locale
    if (change.enabled === true) Object.assign(set, { enabled: true, paused_reason: null, hard_bounces: 0, unsubscribed_at: null })
    if (change.enabled === false) set.enabled = false
    await prefs.updateOne(
      { _id: profile.id },
      {
        $set: set,
        $setOnInsert: {
          created_at: now,
          ...(change.locale === undefined ? { locale: fallbackLocale } : {}),
          ...(change.enabled === undefined ? { enabled: false } : {}),
          ...(change.enabled !== true ? { hard_bounces: 0 } : {}),
        },
      },
      { upsert: true },
    )
  }

  // Turned on while this week's is going out: it joins this week's queue.
  const current = editionFor(now)
  if (change.enabled === true && isOpen(current, now)) {
    const _id = deliveryId(current.id, profile.id)
    // Skipped earlier this week because it was off: nothing was sent, so it may go now.
    await deliveries.updateOne({ _id, status: 'skipped', reason: 'off' }, { $set: { status: 'queued', claim: null, updated_at: now } })
    await deliveries.insertOne({
      _id, edition: current.id, profileId: profile.id, userId, status: 'queued', attempts: 0,
      created_at: now, updated_at: now, expires_at: deliveryExpiry(now),
    }).catch((error) => { if ((error as { code?: number })?.code !== 11000) throw error })
  }
  return { ok: true }
}

/** The unsubscribe link: off, idempotent. Returns whether this call turned it off. */
export async function unsubscribeProfile(profileId: string, now: Date = new Date()) {
  const { prefs } = await digestCollections()
  const result = await prefs.updateOne({ _id: profileId, enabled: true }, { $set: { enabled: false, unsubscribed_at: now, updated_at: now } })
  return result.modifiedCount === 1
}

/** Undo from the unsubscribe page, within 24 hours of unsubscribing. Returns whether it's back on. */
export async function resubscribeProfile(profileId: string, now: Date = new Date()) {
  const { prefs } = await digestCollections()
  const result = await prefs.updateOne(
    { _id: profileId, enabled: false, unsubscribed_at: { $gte: new Date(now.getTime() - UNDO_MS) } },
    { $set: { enabled: true, paused_reason: null, hard_bounces: 0, unsubscribed_at: null, updated_at: now } },
  )
  return result.modifiedCount === 1
}

/** What the unsubscribe page needs to know about the profile a link names. */
export async function unsubscribeView(profileId: string, now: Date = new Date()) {
  const { prefs, users } = await digestCollections()
  const pref = await prefs.findOne({ _id: profileId })
  if (!pref) return { exists: false as const }
  const user = ObjectId.isValid(pref.userId)
    ? await users.findOne({ _id: new ObjectId(pref.userId) }, { projection: { email: 1, profiles: 1 } })
    : null
  const profile = (user?.profiles ?? []).find((item: any) => String(item?.id) === profileId)
  const unsubscribedAt = pref.unsubscribed_at ? new Date(pref.unsubscribed_at) : null
  return {
    exists: true as const,
    enabled: pref.enabled,
    canUndo: !pref.enabled && !!unsubscribedAt && now.getTime() - unsubscribedAt.getTime() < UNDO_MS,
    email: user?.email ? String(user.email) : null,
    profileName: profile?.name ? String(profile.name) : null,
  }
}

/** 'amine@example.com' -> 'a•••@example.com' (the page never shows the whole address). */
export function maskEmail(email: string | null): string | null {
  if (!email) return null
  const at = email.lastIndexOf('@')
  if (at < 1) return '•••'
  return `${email[0]}•••${email.slice(at)}`
}
