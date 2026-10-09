// Who may see what of a page. Private by default; the owner always sees everything.
import 'server-only'
import { randomBytes, timingSafeEqual } from 'crypto'
import { socialDb, type SocialProfileDoc } from './db'
import { areFriends, isBlockedEitherWay } from './friends'
import { canSeeWith, type SeeWhat } from './rules'
import { DEFAULT_PRIVACY, type PrivacySettings, type ProfileRef } from './types'

/** A fresh private link key: 16 random bytes, base64url. */
export const newShareKey = () => randomBytes(16).toString('base64url')

/** Stored settings, with anything missing or malformed set to the private default. */
export function normalizePrivacy(value: Partial<PrivacySettings> | null | undefined): PrivacySettings {
  const visibility = (v: unknown) => (v === 'friends' || v === 'link' ? v : 'private')
  return {
    activity: value?.activity === 'friends' ? 'friends' : 'private',
    ratings: visibility(value?.ratings),
    badges: visibility(value?.badges),
    requests: value?.requests === 'nobody' ? 'nobody' : DEFAULT_PRIVACY.requests,
    paused: value?.paused === true,
  }
}

export async function getPrivacy(profileId: string): Promise<PrivacySettings> {
  const { profiles } = await socialDb()
  const doc = await profiles.findOne({ _id: profileId }, { projection: { privacy: 1 } })
  return normalizePrivacy(doc?.privacy)
}

function keyEquals(stored: string | null | undefined, given: string | null | undefined) {
  if (!stored || !given || typeof given !== 'string') return false
  const a = Buffer.from(stored)
  const b = Buffer.from(given)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function shareKeyMatches(owner: ProfileRef, key: string | null | undefined): Promise<boolean> {
  if (!key) return false
  const { profiles } = await socialDb()
  const doc = await profiles.findOne({ _id: owner.profileId }, { projection: { shareKey: 1 } })
  return keyEquals(doc?.shareKey, key)
}

/** canSee over an already loaded page document (saves a lookup when the caller has it). */
export async function canSeeDoc(viewer: ProfileRef | null, owner: ProfileRef, doc: Pick<SocialProfileDoc, 'privacy' | 'shareKey'> | null, what: SeeWhat, shareKey?: string | null) {
  return canSeeWith(
    { viewer, owner, what, privacy: doc ? normalizePrivacy(doc.privacy) : null, keyMatches: keyEquals(doc?.shareKey, shareKey) },
    {
      blocked: () => (viewer ? isBlockedEitherWay(viewer, owner) : Promise.resolve(false)),
      friends: () => (viewer ? areFriends(viewer.profileId, owner.profileId) : Promise.resolve(false)),
    },
  )
}

/**
 * Whether `viewer` (null = signed out) may see `owner`'s activity, ratings or badges. 'link' also
 * lets in whoever holds the page's private link (`shareKey`), except for activity.
 */
export async function canSee(viewer: ProfileRef | null, owner: ProfileRef, what: 'activity' | 'ratings' | 'badges', opts?: { shareKey?: string | null }): Promise<boolean> {
  if (viewer && viewer.profileId === owner.profileId) return true
  const { profiles } = await socialDb()
  const doc = await profiles.findOne({ _id: owner.profileId }, { projection: { privacy: 1, shareKey: 1, userId: 1 } })
  if (!doc || doc.userId !== owner.userId) return false
  return canSeeDoc(viewer, owner, doc, what, opts?.shareKey)
}
