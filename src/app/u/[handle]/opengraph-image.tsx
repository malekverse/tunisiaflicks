// The card people see when a page's link is sent around: the name, the @handle, the profile's
// colour and initial (or the account photo when its owner shows it). Public fields only: never a
// poster, never anything watched or rated, whoever asks. Kids profiles and unknown handles get
// the general card.
import { ObjectId } from 'mongodb'
import { OG_SIZE, renderFallbackCard, renderProfileCard } from '@/src/lib/og'
import { socialDb } from '@/src/lib/social/db'
import { resolveHandle } from '@/src/lib/social/identity'
import { profileIsKids } from '@/src/app/friends/_lib/viewer'

export const revalidate = 300
export const maxDuration = 30
export const alt = 'A page on TunisiaFlicks'
export const size = OG_SIZE
export const contentType = 'image/jpeg'

const GOOGLE_PHOTO = /^https:\/\/lh3\.googleusercontent\.com\//
const DATA_PHOTO = /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/
const MAX_DATA_URL = 1_000_000

/** The account photo behind a page that shows it (same sources as /api/social/avatar), or null. */
async function accountPhoto(userId: string, profileId: string): Promise<string | null> {
  if (!ObjectId.isValid(userId)) return null
  const { users } = await socialDb()
  const user = await users.findOne({ _id: new ObjectId(userId) }, { projection: { image: 1, profiles: { $slice: 1 } } })
  const image = typeof user?.image === 'string' ? user.image : null
  if (!image || String(user?.profiles?.[0]?.id) !== profileId) return null
  if (GOOGLE_PHOTO.test(image)) return image
  return image.length <= MAX_DATA_URL && DATA_PHOTO.test(image) ? image : null
}

export default async function Image({ params }: { params: { handle: string } }) {
  const target = await resolveHandle(params.handle).catch(() => null)
  if (!target || (await profileIsKids(target).catch(() => true))) return renderFallbackCard()
  const { identity } = target
  // identity.image is only set when the page shows the account photo.
  const image = identity.image ? await accountPhoto(target.userId, target.profileId).catch(() => null) : null
  return renderProfileCard({ name: identity.name, handle: identity.handle, color: identity.color, initial: identity.name, image })
}
