// A movie night's calendar file, for the host and the guests who are going (anyone else, signed
// out included, gets the same 404 as for a night that doesn't exist). Never cached: it carries the
// place. UID night-{id}@tunisiaflicks, SEQUENCE = the night's version (a calendar that imported it
// replaces the event when the time or the film changes), a reminder an hour before.
import { NextResponse } from 'next/server'
import { buildTimedIcs } from '@/src/lib/calendar'
import { getT } from '@/src/lib/i18n/server'
import { calendarOf, getNight } from '@/src/lib/movie-night'
import { isNightId, roleOf } from '@/src/lib/movie-night-rules'
import { requireSocial } from '@/src/lib/social/session'
import { SITE_URL } from '@/src/lib/seo'

export const dynamic = 'force-dynamic'

const notFound = () => NextResponse.json({ error: 'not_found', code: 'not_found' }, { status: 404, headers: { 'Cache-Control': 'private, no-store' } })

export async function GET(request: Request, { params }: { params: { id: string } }) {
  if (!isNightId(params.id)) return notFound()
  const gate = await requireSocial()
  if ('error' in gate) return notFound()
  const night = await getNight(params.id)
  const role = night ? roleOf(night, gate.ref.profileId) : null
  if (!night || (role !== 'host' && role !== 'going')) return notFound()

  const t = getT()
  const event = calendarOf(night)
  const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin || SITE_URL
  const url = `${origin}/movie-night/${night._id}`
  const name = event.title || t('movieNight.defaultTitle')
  const summary = event.film ? t('movieNight.ics.summaryFilm', { title: event.film }) : name
  const ics = buildTimedIcs({
    uid: `night-${night._id}@tunisiaflicks`,
    sequence: event.version,
    start: event.start,
    end: event.end,
    summary,
    description: [event.film && event.title ? event.title : null, t('movieNight.ics.description', { url })].filter(Boolean).join('\n'),
    location: event.place || undefined,
    url,
    alarmMinutes: 60,
    alarmText: t('movieNight.ics.alarm'),
    cancelled: event.cancelled,
  })
  return new NextResponse(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="movie-night-${night._id}.ics"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
