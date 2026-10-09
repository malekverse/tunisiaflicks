// A page's photo: the account photo of the owner's profile, when they chose to show it. Re-encoded
// (webp, EXIF and anything else stripped) at 64, 128 or 256px, so the original never leaves.
import { ObjectId } from 'mongodb'
import { socialDb } from '@/src/lib/social/db'
import { normalizeHandle } from '@/src/lib/social/rules'

export const dynamic = 'force-dynamic'

const SIZES = [64, 128, 256]
const MAX_BYTES = 700 * 1024
const GOOGLE_PHOTO = /^https:\/\/lh3\.googleusercontent\.com\//
const DATA_URL = /^data:image\/(png|jpe?g|webp|gif);base64,([A-Za-z0-9+/=]+)$/

const notFound = () => new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } })

async function photoBytes(image: string): Promise<Buffer | null> {
  const data = image.match(DATA_URL)
  if (data) {
    if (data[2].length > Math.ceil(MAX_BYTES * 4 / 3) + 4) return null
    return Buffer.from(data[2], 'base64')
  }
  if (!GOOGLE_PHOTO.test(image)) return null
  try {
    const response = await fetch(image, { signal: AbortSignal.timeout(5000), redirect: 'error', cache: 'no-store' })
    if (!response.ok || !/^image\//.test(response.headers.get('content-type') ?? '')) return null
    const buffer = Buffer.from(await response.arrayBuffer())
    return buffer.length <= MAX_BYTES * 3 ? buffer : null
  } catch {
    return null
  }
}

export async function GET(request: Request, { params }: { params: { handle: string } }) {
  const handle = normalizeHandle(params.handle)
  if (!handle) return notFound()
  const requested = Number(new URL(request.url).searchParams.get('s') ?? 128)
  const size = SIZES.includes(requested) ? requested : 128

  const { profiles, users } = await socialDb()
  const page = await profiles.findOne({ handle }, { projection: { userId: 1, usePhoto: 1 } })
  if (!page?.usePhoto || !ObjectId.isValid(page.userId)) return notFound()
  const user = await users.findOne({ _id: new ObjectId(page.userId) }, { projection: { image: 1, profiles: { $slice: 1 } } })
  if (!user || String(user.profiles?.[0]?.id) !== page._id || typeof user.image !== 'string') return notFound()

  const bytes = await photoBytes(user.image)
  if (!bytes) return notFound()
  try {
    const sharp = (await import('sharp')).default
    const webp = await sharp(bytes, { limitInputPixels: 4096 * 4096 })
      .rotate()
      .resize(size, size, { fit: 'cover' })
      .webp({ quality: 82 })
      .toBuffer()
    return new Response(new Uint8Array(webp), {
      headers: { 'Content-Type': 'image/webp', 'Cache-Control': 'public, max-age=3600, s-maxage=86400' },
    })
  } catch {
    return notFound()
  }
}
