// Publish / unpublish your year recap.
//   POST   { year } -> (re)computes the stats and saves a public snapshot; returns its token.
//   DELETE ?year=   -> removes the public snapshot (the link stops working).
// One snapshot per user per year; re-sharing refreshes the numbers but keeps the same link.
import { NextResponse, type NextRequest } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/src/lib/auth'
import { computeWrapped, firstName, newShareToken, sharesCollection, yearFromParam } from '@/src/lib/wrapped'

export const dynamic = 'force-dynamic'

const noStore = { 'Cache-Control': 'private, no-store' }

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: any = {}
  try { body = await request.json() } catch { /* empty body = current year */ }
  const year = yearFromParam(String(body?.year ?? ''))

  try {
    const stats = await computeWrapped(session.user.id, year, firstName(session.user.name))
    if (stats.titles === 0) {
      return NextResponse.json({ error: 'Watch something first: there is nothing to share yet' }, { status: 400 })
    }
    const collection = await sharesCollection()
    const now = new Date()
    const existing = await collection.findOne({ userId: session.user.id, year })
    const token = existing?.token ?? newShareToken()
    await collection.updateOne(
      { userId: session.user.id, year },
      { $set: { stats, updatedAt: now }, $setOnInsert: { token, userId: session.user.id, year, createdAt: now } },
      { upsert: true }
    )
    return NextResponse.json({ token, url: `/wrapped/s/${token}` }, { headers: noStore })
  } catch (error) {
    console.error('Error sharing wrapped:', error)
    return NextResponse.json({ error: 'Failed to share your year' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const year = yearFromParam(request.nextUrl.searchParams.get('year') ?? undefined)
  try {
    await (await sharesCollection()).deleteOne({ userId: session.user.id, year })
    return NextResponse.json({ success: true }, { headers: noStore })
  } catch (error) {
    console.error('Error unsharing wrapped:', error)
    return NextResponse.json({ error: 'Failed to stop sharing' }, { status: 500 })
  }
}
