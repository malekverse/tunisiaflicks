// /tunisian/tv/{channel}/avatar: our own small copy of a channel's picture (96px WebP, taken by
// the cron through the YouTube Data API), so visitors' browsers never ask Google for it. 404
// when there is none: the pages draw a monogram instead.
import { channelBySlug } from '@/src/lib/tunisian-tv/channels'
import { ttv } from '@/src/lib/tunisian-tv/db'

export const dynamic = 'force-dynamic'

const notFound = () => new Response('Not found', { status: 404, headers: { 'Cache-Control': 'public, max-age=300' } })

export async function GET(_request: Request, { params }: { params: { channel: string } }) {
  const def = channelBySlug(params.channel)
  if (!def) return notFound()
  try {
    const db = await ttv()
    const doc = await db.channels.findOne({ _id: def.slug }, { projection: { avatarData: 1 } })
    const data = doc?.avatarData?.buffer
    if (!data || data.length === 0) return notFound()
    return new Response(new Uint8Array(data), {
      status: 200,
      headers: {
        'Content-Type': 'image/webp',
        // The page links it with ?v=<when it was taken>: a new picture is a new address.
        'Cache-Control': 'public, max-age=604800, s-maxage=604800, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch {
    return notFound()
  }
}
