// Your release calendar's link (lib/calendar-feed): GET says whether there is one (and its
// addresses), POST makes a new one (the old one stops working), DELETE turns it off.
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/src/lib/auth'
import { createFeed, getFeed, removeFeed } from '@/src/lib/calendar-feed'
import { feedUrls } from '@/src/lib/calendar-feed-rules'
import { getLocale } from '@/src/lib/i18n/server'
import { rateLimit, tooManyRequests } from '@/src/lib/rate-limit'
import { linkBase } from '@/src/lib/seo'

export const dynamic = 'force-dynamic'

const noStore = { 'Cache-Control': 'private, no-store' }

async function userId() {
  const session = await getServerSession(authOptions)
  return session?.user?.id ?? null
}

const answer = (feed: { token: string } | null) =>
  NextResponse.json({ feed: feed ? feedUrls(linkBase(), feed.token) : null }, { headers: noStore })

export async function GET() {
  const id = await userId()
  if (!id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: noStore })
  return answer(await getFeed(id))
}

export async function POST() {
  const id = await userId()
  if (!id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: noStore })
  const limit = await rateLimit(`calendar-feed:${id}`, 10, 60 * 60)
  if (!limit.ok) return tooManyRequests(limit.retryAfter)
  return answer(await createFeed(id, getLocale()))
}

export async function DELETE() {
  const id = await userId()
  if (!id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: noStore })
  await removeFeed(id)
  return answer(null)
}
