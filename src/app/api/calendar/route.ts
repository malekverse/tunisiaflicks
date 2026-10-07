import { NextResponse, type NextRequest } from 'next/server'
import { tmdbFetchSafe } from '@/src/lib/tmdb'
import { buildIcs, upcomingRelease } from '@/src/lib/calendar'

export const dynamic = 'force-dynamic'

/** .ics download for a movie's release or a show's next episode (/api/calendar?type=movie&id=550). */
export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get('type')
  const id = request.nextUrl.searchParams.get('id') ?? ''
  if ((type !== 'movie' && type !== 'tv') || !/^\d+$/.test(id)) {
    return NextResponse.json({ error: 'Invalid type or id' }, { status: 400 })
  }

  const data = await tmdbFetchSafe(`${type}/${id}`, {}, 3600)
  const event = data ? upcomingRelease(type, data) : null
  if (!event) return NextResponse.json({ error: 'No upcoming release' }, { status: 404 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin
  const slug = event.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'release'
  return new NextResponse(buildIcs(event, appUrl), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${slug}.ics"`,
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
