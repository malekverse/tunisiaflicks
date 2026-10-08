import { isYouTubeId } from '@/src/lib/youtube'

// /api/yt-thumb/{videoId}/{mq|hq|maxres}: a YouTube thumbnail, fetched by our server and streamed
// back. Visitors' browsers never ask Google for anything (their IP stays with us) until they press
// play. Browsers keep a picture a day, the CDN a week.
export const dynamic = 'force-dynamic'

const FILES: Record<string, string> = { mq: 'mqdefault', hq: 'hqdefault', maxres: 'maxresdefault' }
const TIMEOUT_MS = 5000

const notFound = () => new Response('Not found', { status: 404, headers: { 'Cache-Control': 'public, max-age=300' } })

export async function GET(_request: Request, { params }: { params: { id: string, size: string } }) {
  const file = Object.prototype.hasOwnProperty.call(FILES, params.size) ? FILES[params.size] : null
  if (!isYouTubeId(params.id) || !file) return notFound()

  let upstream: Response
  try {
    upstream = await fetch(`https://i.ytimg.com/vi/${params.id}/${file}.jpg`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch {
    return new Response('Upstream unavailable', { status: 502, headers: { 'Cache-Control': 'no-store' } })
  }
  // A video that doesn't exist (or has no maxres picture) answers 404 with a grey placeholder.
  const type = upstream.headers.get('content-type') ?? ''
  if (!upstream.ok || !upstream.body || !type.startsWith('image/')) return notFound()

  const headers = new Headers({
    'Content-Type': type,
    'Cache-Control': 'public, max-age=86400, s-maxage=604800',
    'X-Content-Type-Options': 'nosniff',
  })
  const length = upstream.headers.get('content-length')
  if (length) headers.set('Content-Length', length)
  return new Response(upstream.body, { status: 200, headers })
}
