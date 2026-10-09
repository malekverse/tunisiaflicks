// GET /badges/art/{id}-{level}.svg: one badge medallion as an image (the inbox row's picture, and
// anywhere an <img> is simpler than inline SVG). Level 0 is the locked outline. Built once per
// file, cached for good.
import { badgeSvg } from '@/src/lib/badges/art'
import { BADGE_IDS, isBadgeId } from '@/src/lib/badges/catalogue'

export const dynamic = 'force-static'
export const dynamicParams = false

const FILE_RE = /^([A-Za-z]{1,24})-([0-4])\.svg$/

export function generateStaticParams() {
  return BADGE_IDS.flatMap((id) => [0, 1, 2, 3, 4].map((level) => ({ file: `${id}-${level}.svg` })))
}

export function GET(_request: Request, { params }: { params: { file: string } }) {
  const match = FILE_RE.exec(params.file ?? '')
  if (!match || !isBadgeId(match[1])) return new Response('Not found', { status: 404 })
  return new Response(badgeSvg({ id: match[1], level: Number(match[2]), size: 64, standalone: true }), {
    headers: {
      'content-type': 'image/svg+xml; charset=utf-8',
      'cache-control': 'public, max-age=31536000, immutable',
      'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'",
    },
  })
}
