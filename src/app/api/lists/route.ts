// My lists: GET = the signed-in user's lists, POST = create a list.
import { NextResponse, type NextRequest } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/src/lib/auth'
import {
  MAX_DESCRIPTION, MAX_LISTS_PER_USER, MAX_TITLE, cleanText, listsCollection, newSlug, toListItem, toPublicList, type ListDoc,
} from '@/src/lib/lists-db'

export const dynamic = 'force-dynamic'

const noStore = { 'Cache-Control': 'private, no-store' }

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const lists = await (await listsCollection())
      .find({ userId: session.user.id })
      .sort({ updatedAt: -1 })
      .limit(MAX_LISTS_PER_USER)
      .toArray()
    return NextResponse.json({ lists: lists.map(toPublicList) }, { headers: noStore })
  } catch (error) {
    console.error('Error listing lists:', error)
    return NextResponse.json({ error: 'Failed to load lists' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: any
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  const title = cleanText(body?.title, MAX_TITLE)
  if (!title) return NextResponse.json({ error: 'A list needs a title' }, { status: 400 })

  try {
    const collection = await listsCollection()
    if (await collection.countDocuments({ userId: session.user.id }) >= MAX_LISTS_PER_USER) {
      return NextResponse.json({ error: `You can have up to ${MAX_LISTS_PER_USER} lists` }, { status: 400 })
    }

    // Optional first item (e.g. "New list…" from a title page).
    const firstItem = body?.item ? toListItem(body.item) : null
    const now = new Date()
    const list: ListDoc = {
      slug: newSlug(),
      userId: session.user.id,
      ownerName: cleanText(session.user.name, 60) || 'A TunisiaFlicks fan',
      title,
      description: cleanText(body?.description, MAX_DESCRIPTION),
      items: firstItem ? [firstItem] : [],
      createdAt: now,
      updatedAt: now,
    }
    await collection.insertOne(list)
    return NextResponse.json({ list: toPublicList(list) }, { status: 201, headers: noStore })
  } catch (error) {
    console.error('Error creating list:', error)
    return NextResponse.json({ error: 'Failed to create list' }, { status: 500 })
  }
}
