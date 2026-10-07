// A "Swipe to decide" room: state polling (GET) and join / vote / new deck (POST).
import { NextResponse } from 'next/server'
import { clientIp, rateLimit, tooManyRequests } from '@/src/lib/rate-limit'
import { cleanName, getRoom, isRoomCode, joinRoom, newDeck, publicState, vote } from '@/src/lib/swipe'
import { getLocale } from '@/src/lib/i18n/server'

export const dynamic = 'force-dynamic'

const notFound = () => NextResponse.json({ error: 'not-found' }, { status: 404 })

/** ?deck=1 includes the cards. With x-swipe-id / x-swipe-secret headers, also your own voted keys. */
export async function GET(request: Request, { params }: { params: { code: string } }) {
  const code = params.code.toUpperCase()
  if (!isRoomCode(code)) return notFound()
  const room = await getRoom(code)
  if (!room) return notFound()
  const withDeck = new URL(request.url).searchParams.get('deck') === '1'
  const id = request.headers.get('x-swipe-id') ?? ''
  const me = room.participants.find((person) => person.id === id && person.secret === request.headers.get('x-swipe-secret'))
  return NextResponse.json({ ...publicState(room, withDeck), me: me ? { id: me.id, voted: Object.keys(room.votes[me.id] ?? {}) } : null }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}

export async function POST(request: Request, { params }: { params: { code: string } }) {
  const code = params.code.toUpperCase()
  if (!isRoomCode(code)) return notFound()
  const body = await request.json().catch(() => null)
  const ip = clientIp(request.headers)

  if (body?.action === 'join') {
    const limit = await rateLimit(`swipe-join:ip:${ip}`, 20, 60 * 60)
    if (!limit.ok) return tooManyRequests(limit.retryAfter)
    const name = cleanName(body.name)
    if (!name) return NextResponse.json({ error: 'name' }, { status: 400 })
    if (!(await getRoom(code))) return notFound()
    const participant = await joinRoom(code, name)
    return participant ? NextResponse.json({ participant }) : NextResponse.json({ error: 'full' }, { status: 409 })
  }

  if (body?.action === 'vote') {
    const limit = await rateLimit(`swipe-vote:ip:${ip}`, 600, 60 * 60)
    if (!limit.ok) return tooManyRequests(limit.retryAfter)
    if (typeof body.id !== 'string' || typeof body.secret !== 'string' || typeof body.card !== 'string' || typeof body.yes !== 'boolean') {
      return NextResponse.json({ error: 'invalid' }, { status: 400 })
    }
    const result = await vote(code, body.id, body.secret, body.card, body.yes)
    if (result === 'missing') return notFound()
    if (result === 'forbidden') return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    if (result === 'invalid') return NextResponse.json({ error: 'invalid' }, { status: 400 })
    return NextResponse.json({ match: result })
  }

  if (body?.action === 'new-deck') {
    const limit = await rateLimit(`swipe-deck:ip:${ip}`, 10, 60 * 60)
    if (!limit.ok) return tooManyRequests(limit.retryAfter)
    const result = await newDeck(code, String(body.id ?? ''), String(body.secret ?? ''), getLocale())
    if (result === 'missing') return notFound()
    if (result === 'forbidden') return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    if (result === 'failed') return NextResponse.json({ error: 'failed' }, { status: 502 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'invalid' }, { status: 400 })
}
