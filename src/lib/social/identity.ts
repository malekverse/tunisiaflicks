// How people appear to each other: a page's name, handle, colour and (for the account owner's
// profile, when they chose so) the account photo, served through /api/social/avatar.
import 'server-only'
import { createHash } from 'crypto'
import { ObjectId } from 'mongodb'
import { PROFILE_COLORS } from '@/src/lib/models/Profile'
import { socialDb, DAYS, type SocialProfileDoc } from './db'
import { normalizeHandle } from './rules'
import type { AvatarPerson, ProfileRef, PublicIdentity } from './types'

/** Old handles send people to the new one for this long (then they are only held, see HandleDoc). */
export const HANDLE_REDIRECT_DAYS = 30
export const HANDLE_HOLD_DAYS = 90

const photoVersion = (image: string) => createHash('sha256').update(image).digest('hex').slice(0, 8)

/** The avatar URL of a page whose owner shows the account photo (null otherwise). */
export function avatarUrl(handle: string, image: string | null | undefined) {
  return image ? `/api/social/avatar/${handle}?v=${photoVersion(image)}` : null
}

/** Account photos and owner profiles for the pages that want the photo, in one query. */
async function photosFor(docs: SocialProfileDoc[]): Promise<Map<string, string>> {
  const wanted = docs.filter((doc) => doc.usePhoto && ObjectId.isValid(doc.userId))
  const photos = new Map<string, string>()
  if (wanted.length === 0) return photos
  const { users } = await socialDb()
  const accounts = await users.find(
    { _id: { $in: Array.from(new Set(wanted.map((doc) => doc.userId))).map((id) => new ObjectId(id)) } },
    { projection: { image: 1, profiles: { $slice: 1 } } },
  ).toArray()
  const byUser = new Map(accounts.map((account) => [String(account._id), account]))
  for (const doc of wanted) {
    const account = byUser.get(doc.userId)
    const ownerId = account?.profiles?.[0]?.id ? String(account.profiles[0].id) : null
    if (ownerId === doc._id && typeof account?.image === 'string' && account.image) {
      const url = avatarUrl(doc.handle, account.image)
      if (url) photos.set(doc._id, url)
    }
  }
  return photos
}

const toIdentity = (doc: SocialProfileDoc, image: string | null | undefined): PublicIdentity => ({
  handle: doc.handle,
  name: doc.name,
  color: doc.color,
  image: image ?? null,
})

export async function getIdentities(profileIds: string[]): Promise<Map<string, PublicIdentity>> {
  const ids = Array.from(new Set(profileIds.filter((id) => typeof id === 'string' && id)))
  if (ids.length === 0) return new Map()
  const { profiles } = await socialDb()
  const docs = await profiles.find({ _id: { $in: ids } }).toArray()
  const photos = await photosFor(docs)
  return new Map(docs.map((doc) => [doc._id, toIdentity(doc, photos.get(doc._id))]))
}

export async function getIdentity(profileId: string): Promise<PublicIdentity | null> {
  return (await getIdentities([profileId])).get(profileId) ?? null
}

/**
 * Who a handle points to: the current owner, or (for a handle changed less than 30 days ago) the
 * same person with `redirectTo` their new handle. Null when unknown, or only held.
 */
export async function resolveHandle(raw: string): Promise<(ProfileRef & { identity: PublicIdentity; redirectTo?: string }) | null> {
  const handle = normalizeHandle(raw)
  if (!handle) return null
  const { handles } = await socialDb()
  const doc = await handles.findOne({ _id: handle })
  if (!doc) return null
  let redirectTo: string | undefined
  if (!doc.current) {
    const changedAt = doc.changedAt ? new Date(doc.changedAt).getTime() : 0
    if (Date.now() - changedAt > DAYS(HANDLE_REDIRECT_DAYS)) return null
    const current = await handles.findOne({ profileId: doc.profileId, current: true })
    if (!current) return null
    redirectTo = current._id
  }
  const identity = await getIdentity(doc.profileId)
  if (!identity) return null
  return { userId: doc.userId, profileId: doc.profileId, identity, ...(redirectTo ? { redirectTo } : {}) }
}

/**
 * How to draw someone who may not have a page (a movie-night guest, a list member): their page
 * identity when there is one, otherwise their viewer profile's name and colour.
 */
export async function avatarPerson(ref: ProfileRef): Promise<AvatarPerson> {
  const identity = await getIdentity(ref.profileId)
  if (identity) return identity
  if (ObjectId.isValid(ref.userId)) {
    const { users } = await socialDb()
    const user = await users.findOne({ _id: new ObjectId(ref.userId) }, { projection: { profiles: 1 } })
    const profile = (user?.profiles ?? []).find((entry: { id?: unknown }) => String(entry?.id) === ref.profileId)
    if (profile) {
      const color = PROFILE_COLORS.includes(profile.color) ? profile.color : PROFILE_COLORS[0]
      return { name: String(profile.name), color, image: null, handle: null }
    }
  }
  return { name: '?', color: PROFILE_COLORS[0], image: null, handle: null }
}
