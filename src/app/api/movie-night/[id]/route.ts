// One movie night. GET ?v=<rev>: the night as you may see it ({same: true} when nothing changed
// since that rev: the page polls with it). POST {action, ...}: one change per request.
//   rsvp {going} · invite {to | handles} · join {token} · approve {profileId, approve} ·
//   addCandidate {key} · removeCandidate {key} · vote {key | null} · closeVote · choose {key} ·
//   room · link · linkOff · edit {...} · cancel · leave · remove {profileId}
// A night you aren't part of answers 404, whatever the action (its existence stays private).
import { getLocale } from '@/src/lib/i18n/server'
import {
  addCandidate, approveRequest, cancelNight, castVote, chooseFilm, closeVote, editNight, getNight, inviteFriends, joinWithLink, leaveNight,
  loadNight, makeLink, openRoom, removeCandidate, removeGuest, rsvp, turnOffLink, type Fail,
} from '@/src/lib/movie-night'
import { isNightId, roleOf } from '@/src/lib/movie-night-rules'
import { inviteHref } from '@/src/lib/invites'
import { readJson, requireSocial, socialError, socialJson, socialRateLimit, socialSelf } from '@/src/lib/social/session'

export const dynamic = 'force-dynamic'

const notFound = () => socialError(404, 'not_found')

export async function GET(request: Request, { params }: { params: { id: string } }) {
  if (!isNightId(params.id)) return notFound()
  const self = await socialSelf()
  if (self?.kids) return socialError(403, 'kids')
  const url = new URL(request.url)
  const result = await loadNight(params.id, self && !self.limited ? self.ref : null, { token: url.searchParams.get('invite') })
  if (result.access === 'none') return notFound()
  const known = Number(url.searchParams.get('v'))
  if (Number.isFinite(known) && known > 0 && known === result.view.rev) return socialJson({ same: true, rev: known })
  return socialJson(result.view)
}

const answer = (result: { ok: true } | Fail, extra?: Record<string, unknown>) =>
  'error' in result ? socialError(result.status, result.error) : socialJson({ ok: true, ...extra })

export async function POST(request: Request, { params }: { params: { id: string } }) {
  if (!isNightId(params.id)) return notFound()
  const body = await readJson(request)
  const action = typeof body?.action === 'string' ? body.action : ''
  const writes = action === 'join' || action === 'invite'
  const gate = await requireSocial({ write: writes, needsHandle: action === 'join' })
  if ('error' in gate) return gate.error
  const me = gate.ref
  const limited = await socialRateLimit([[`night:act:${me.userId}`, 120, 60 * 60]])
  if (limited) return limited
  if (!body || !action) return socialError(400, 'invalid')

  if (action === 'join') {
    const result = await joinWithLink(params.id, me, body.token)
    return 'error' in result ? socialError(result.status, result.error) : socialJson({ ok: true, status: result.status })
  }

  const night = await getNight(params.id)
  if (!night || !roleOf(night, me.profileId)) return notFound()
  const locale = getLocale()

  switch (action) {
    case 'rsvp': {
      if (typeof body.going !== 'boolean') return socialError(400, 'invalid')
      const result = await rsvp(night, me, body.going)
      return 'error' in result ? socialError(result.status, result.error) : socialJson({ ok: true, status: result.status })
    }
    case 'invite': {
      const handles = Array.isArray(body.to) ? body.to : Array.isArray(body.handles) ? body.handles : null
      if (!handles || handles.length === 0) return socialError(400, 'invalid_recipients')
      const result = await inviteFriends(night._id, me, handles)
      return 'error' in result ? socialError(result.status, result.error) : socialJson({ ok: true, sent: result.sent, skipped: result.skipped })
    }
    case 'approve':
      return answer(await approveRequest(night, me, body.profileId, body.approve === true))
    case 'remove':
      return answer(await removeGuest(night, me, body.profileId))
    case 'leave':
      return answer(await leaveNight(night, me))
    case 'addCandidate':
      return answer(await addCandidate(night, me, body.key, locale))
    case 'removeCandidate':
      return answer(await removeCandidate(night, me, body.key))
    case 'vote':
      return answer(await castVote(night, me, body.key ?? null))
    case 'closeVote':
      return answer(await closeVote(night, me))
    case 'choose':
      return answer(await chooseFilm(night, me, body.key))
    case 'room': {
      const self = await socialSelf()
      const name = (gate.social?.name || self?.profileName || '').slice(0, 24)
      const result = await openRoom(night, me, name, locale)
      return 'error' in result ? socialError(result.status, result.error) : socialJson({ ok: true, code: result.code, participant: result.participant ?? null, name })
    }
    case 'link': {
      const result = await makeLink(night, me)
      if ('error' in result) return socialError(result.status, result.error)
      return socialJson({ ok: true, url: inviteHref(`/movie-night/${night._id}`, result.token), uses: result.uses, maxUses: result.maxUses })
    }
    case 'linkOff':
      return answer(await turnOffLink(night, me))
    case 'edit':
      return answer(await editNight(night, me, body))
    case 'cancel':
      return answer(await cancelNight(night, me))
    default:
      return socialError(400, 'invalid')
  }
}
