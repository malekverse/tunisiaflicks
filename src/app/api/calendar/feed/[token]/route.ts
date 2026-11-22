// The release calendar itself (lib/calendar-feed), as calendar apps subscribe to it:
// /api/calendar/feed/<secret>.ics. Kept by the CDN for six hours: calendars look a few times a day.
import { NextResponse } from 'next/server'
import { buildFeed } from '@/src/lib/calendar'
import { feedEvents, feedOwner } from '@/src/lib/calendar-feed'
import { createTranslator } from '@/src/lib/i18n'
import { linkBase } from '@/src/lib/seo'

export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: { params: { token: string } }) {
  const token = params.token.replace(/\.ics$/i, '')
  const owner = await feedOwner(token).catch(() => null)
  // A link that was turned off or replaced: gone, and calendars stop asking.
  if (!owner) return new NextResponse('Not found', { status: 404, headers: { 'Cache-Control': 'public, s-maxage=3600' } })
  const t = createTranslator(owner.locale)
  const events = await feedEvents(owner.userId).catch((error) => {
    console.error('Calendar feed:', error)
    return null
  })
  if (!events) return new NextResponse('Try again later', { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '600' } })
  const ics = buildFeed(events, linkBase(), { name: t('calendarFeed.name'), movie: t('calendarFeed.movie'), episode: t('calendarFeed.episode') })
  return new NextResponse(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="tunisiaflicks.ics"',
      'Cache-Control': 'public, max-age=3600, s-maxage=21600, stale-while-revalidate=43200',
    },
  })
}
