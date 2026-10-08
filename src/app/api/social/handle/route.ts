// Your page: GET without ?h= says who you are socially (page or not, verified, owner profile);
// GET ?h= checks a handle; POST claims one (creates the page); PATCH edits the page; DELETE
// removes it (Settings > Friends and privacy > Delete my page).
import { getActiveProfile } from '@/src/lib/profiles'
import { clientIp } from '@/src/lib/rate-limit'
import { deleteSocialPage } from '@/src/lib/social/account'
import { socialDb, DAYS, type SocialProfileDoc } from '@/src/lib/social/db'
import { handleAvailability, releaseHandle, suggestHandles, takeHandle, isDuplicateKey } from '@/src/lib/social/handles'
import { avatarUrl } from '@/src/lib/social/identity'
import { newShareKey } from '@/src/lib/social/privacy'
import { BIO_MAX, cleanBio, cleanDisplayName, ipKey } from '@/src/lib/social/rules'
import { loadAccount, readJson, requireSocial, socialError, socialJson, socialRateLimit } from '@/src/lib/social/session'
import { DEFAULT_PRIVACY, type PublicIdentity } from '@/src/lib/social/types'

export const dynamic = 'force-dynamic'

const HANDLE_CHANGE_DAYS = 30

function identityOf(doc: SocialProfileDoc, image: string | null): PublicIdentity {
  const owned = doc.usePhoto ? avatarUrl(doc.handle, image) : null
  return { handle: doc.handle, name: doc.name, color: doc.color, image: owned }
}

const nextHandleChange = (doc: SocialProfileDoc) =>
  doc.handleChangedAt ? new Date(new Date(doc.handleChangedAt).getTime() + DAYS(HANDLE_CHANGE_DAYS)) : null

export async function GET(request: Request) {
  const gate = await requireSocial()
  if ('error' in gate) return gate.error
  const { ref, social } = gate
  const h = new URL(request.url).searchParams.get('h')

  if (h === null) {
    const [account, active] = await Promise.all([loadAccount(ref.userId), getActiveProfile()])
    const owner = account.ownerProfileId === ref.profileId
    const changeAt = social ? nextHandleChange(social) : null
    return socialJson({
      handle: social?.handle ?? null,
      identity: social ? identityOf(social, owner ? account.image : null) : null,
      name: social?.name ?? active?.profile?.name ?? '',
      bio: social?.bio ?? '',
      usePhoto: social?.usePhoto ?? false,
      color: social?.color ?? active?.profile?.color ?? null,
      verified: account.verified,
      owner,
      hasPhoto: owner && !!account.image,
      handleChangeAt: changeAt && changeAt.getTime() > Date.now() ? changeAt.toISOString() : null,
    })
  }

  const limited = await socialRateLimit([
    [`social:handle:user:${ref.userId}`, 30, 10 * 60],
    [`social:handle:ip:${ipKey(clientIp(request.headers))}`, 60, 10 * 60],
  ])
  if (limited) return limited
  const result = await handleAvailability(h, ref.profileId)
  const name = social?.name ?? (await getActiveProfile())?.profile?.name ?? ''
  const suggestions = result.available ? [] : await suggestHandles(result.handle ?? '', name)
  return socialJson({ available: result.available, reason: result.reason, suggestions })
}

export async function POST(request: Request) {
  const gate = await requireSocial({ write: true })
  if ('error' in gate) return gate.error
  const { ref, social } = gate
  if (social) return socialError(409, 'has_handle', 'This profile already has a page')

  const body = await readJson(request)
  const [account, active] = await Promise.all([loadAccount(ref.userId), getActiveProfile()])
  const profile = active?.profile
  if (!profile) return socialError(409, 'needs_pick')
  const availability = await handleAvailability(body?.handle, ref.profileId)
  if (!availability.handle || !availability.available) {
    return socialError(availability.reason === 'taken' ? 409 : 400, availability.reason ?? 'invalid')
  }
  const name = body?.name === undefined ? cleanDisplayName(profile.name) : cleanDisplayName(body.name)
  if (!name) return socialError(400, 'invalid_name')
  if (typeof body?.bio === 'string' && body.bio.length > BIO_MAX * 2) return socialError(400, 'invalid_bio')
  const owner = account.ownerProfileId === ref.profileId
  if (body?.usePhoto === true && !owner) return socialError(403, 'not_owner_profile')

  const limited = await socialRateLimit([[`social:claim:${ref.userId}`, 2, 30 * 24 * 60 * 60]])
  if (limited) return limited

  if (!(await takeHandle(availability.handle, ref, null))) return socialError(409, 'taken')
  const now = new Date()
  const doc: SocialProfileDoc = {
    _id: ref.profileId,
    userId: ref.userId,
    handle: availability.handle,
    name,
    bio: cleanBio(body?.bio),
    usePhoto: body?.usePhoto === true && owner,
    color: profile.color,
    privacy: { ...DEFAULT_PRIVACY },
    shareKey: newShareKey(),
    activitySince: now,
    ratingsVisibleSince: now,
    createdAt: now,
    updatedAt: now,
  }
  try {
    const { profiles } = await socialDb()
    await profiles.insertOne(doc)
  } catch (error) {
    await releaseHandle(availability.handle, ref.profileId)
    if (isDuplicateKey(error)) return socialError(409, 'has_handle')
    throw error
  }
  return socialJson({ identity: identityOf(doc, owner ? account.image : null) }, 201)
}

export async function PATCH(request: Request) {
  const gate = await requireSocial({ needsHandle: true, write: true })
  if ('error' in gate) return gate.error
  const { ref } = gate
  const social = gate.social!
  const body = await readJson(request)
  if (!body) return socialError(400, 'invalid')
  const account = await loadAccount(ref.userId)
  const owner = account.ownerProfileId === ref.profileId
  const set: Partial<SocialProfileDoc> = {}

  if (body.name !== undefined) {
    const name = cleanDisplayName(body.name)
    if (!name) return socialError(400, 'invalid_name')
    set.name = name
  }
  if (body.bio !== undefined) {
    if (typeof body.bio !== 'string' || body.bio.length > BIO_MAX * 2) return socialError(400, 'invalid_bio')
    set.bio = cleanBio(body.bio)
  }
  if (body.usePhoto !== undefined) {
    if (body.usePhoto === true && !owner) return socialError(403, 'not_owner_profile')
    set.usePhoto = body.usePhoto === true
  }
  if (body.handle !== undefined) {
    const availability = await handleAvailability(body.handle, ref.profileId)
    if (availability.handle && availability.handle !== social.handle) {
      const changeAt = nextHandleChange(social)
      if (changeAt && changeAt.getTime() > Date.now()) return socialError(429, 'too_soon', 'You can change your handle once every 30 days', { until: changeAt.toISOString() })
      if (!availability.available) return socialError(availability.reason === 'taken' ? 409 : 400, availability.reason ?? 'invalid')
      if (!(await takeHandle(availability.handle, ref, social.handle))) return socialError(409, 'taken')
      set.handle = availability.handle
      set.handleChangedAt = new Date()
    } else if (!availability.handle) {
      return socialError(400, 'invalid')
    }
  }

  const { profiles } = await socialDb()
  const updated = await profiles.findOneAndUpdate(
    { _id: ref.profileId, userId: ref.userId },
    { $set: { ...set, updatedAt: new Date() } },
    { returnDocument: 'after' },
  )
  if (!updated.value) return socialError(404, 'not_found')
  return socialJson({ identity: identityOf(updated.value, owner ? account.image : null) })
}

export async function DELETE() {
  const gate = await requireSocial({ needsHandle: true })
  if ('error' in gate) return gate.error
  await deleteSocialPage(gate.ref)
  return socialJson({ ok: true })
}
