// One watch party (lib/party). The site only introduces the players, then they talk directly.
// GET: what the party is (anyone with the code); ?host=<hostToken>: the guests waiting for an
// answer; ?member=<id>&token=<memberToken>: the host's answer, once there is one.
// POST { action: 'join', offer } (a signed-in grown-up), { action: 'answer', hostToken, memberId,
// answer }, { action: 'media', hostToken, media } (the host moved to another episode) and
// { action: 'end', hostToken } (the host's page).
import { NextResponse, type NextRequest } from 'next/server'
import { getActiveProfile, getKidsMode } from '@/src/lib/profiles'
import { answerGuest, endParty, guestAnswer, joinParty, movePartyMedia, partyInfo, waitingGuests } from '@/src/lib/party'
import { cleanPartyMedia, cleanSdp } from '@/src/lib/party-rules'
import { clientIp, rateLimit, tooManyRequests } from '@/src/lib/rate-limit'

export const dynamic = 'force-dynamic'

const noStore = { 'Cache-Control': 'private, no-store' }
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: noStore })

export async function GET(request: NextRequest, { params }: { params: { code: string } }) {
  const search = request.nextUrl.searchParams
  const limit = await rateLimit(`party-read:${clientIp(request.headers)}`, 1500, 60 * 60)
  if (!limit.ok) return tooManyRequests(limit.retryAfter)
  const host = search.get('host')
  if (host) {
    const guests = await waitingGuests(params.code, host)
    return guests ? json({ guests }) : json({ error: 'not_found' }, 404)
  }
  const member = search.get('member')
  if (member) {
    const answer = await guestAnswer(params.code, member, search.get('token') ?? '')
    return answer === undefined ? json({ error: 'not_found' }, 404) : json({ answer })
  }
  const active = await getActiveProfile()
  const info = await partyInfo(params.code, active?.userId ?? null)
  return info ? json(info) : json({ error: 'not_found' }, 404)
}

export async function POST(request: Request, { params }: { params: { code: string } }) {
  const body = await request.json().catch(() => null)
  if (body?.action === 'join') {
    const active = await getActiveProfile()
    if (!active?.profile) return json({ error: 'Unauthorized' }, 401)
    if (await getKidsMode()) return json({ error: 'grown_up_only' }, 403)
    const limit = await rateLimit(`party-join:${active.userId}`, 30, 60 * 60)
    if (!limit.ok) return tooManyRequests(limit.retryAfter)
    const offer = cleanSdp(body.offer)
    if (!offer) return json({ error: 'bad_offer' }, 400)
    const result = await joinParty(params.code, active.userId, active.profile.name, offer)
    if ('error' in result) return json({ error: result.error }, result.error === 'not_found' ? 404 : 409)
    return json({ memberId: result.memberId, memberToken: result.memberToken })
  }
  if (body?.action === 'answer') {
    const answer = cleanSdp(body.answer)
    if (!answer) return json({ error: 'bad_answer' }, 400)
    const ok = await answerGuest(params.code, String(body.hostToken ?? ''), String(body.memberId ?? ''), answer)
    return ok ? json({ ok }) : json({ error: 'not_found' }, 404)
  }
  if (body?.action === 'media') {
    const media = cleanPartyMedia(body.media)
    if (!media) return json({ error: 'bad_media' }, 400)
    const ok = await movePartyMedia(params.code, String(body.hostToken ?? ''), media)
    return ok ? json({ ok }) : json({ error: 'not_found' }, 404)
  }
  if (body?.action === 'end') {
    const ok = await endParty(params.code, String(body.hostToken ?? ''))
    return ok ? json({ ok }) : json({ error: 'not_found' }, 404)
  }
  return json({ error: 'bad_request' }, 400)
}
