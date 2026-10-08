import { renderWrappedCard } from '@/src/lib/og'
import { getShare } from '@/src/lib/wrapped'

// 1080x1920 story image of a shared recap (Instagram / Facebook / WhatsApp stories).
export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET(_request: Request, { params }: { params: { token: string } }) {
  const share = await getShare(params.token)
  if (!share) return new Response('Not found', { status: 404 })
  const image = await renderWrappedCard(share.stats, 'story')
  const headers = new Headers(image.headers)
  headers.set('Content-Disposition', `inline; filename="tunisiaflicks-${share.year}.jpg"`)
  headers.set('Cache-Control', 'public, max-age=300')
  return new Response(image.body, { status: 200, headers })
}
