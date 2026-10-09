// The signed-in account's supporter status (Settings #supporter, /support).
//
// GET   -> { open, code, supporter: { since, badgePublic, listed, listName } | null }
//          Claims coffees paid with the account's confirmed e-mail first (at most every 12 hours).
// PATCH { badgePublic?, listed?, listName? } -> the same shape. Supporters only (404 otherwise).
//
// 401 guest, 409 no profile picked, 403 on a Kids profile; PATCH also 403 on a TV signed in with a code.
import { NextResponse } from 'next/server'
import { requireActiveProfile } from '@/src/lib/profiles'
import { denyLimitedSession } from '@/src/lib/session-scope'
import { claimSupport, cleanListName, ensureSupportCode, getSupporter, setSupporterPrefs, type SupporterDoc } from '@/src/lib/support'
import { supportUrl } from '@/src/lib/support-url'
import { withTimeout } from '@/src/lib/with-timeout'

export const dynamic = 'force-dynamic'

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })

const shape = (open: boolean, code: string | null, supporter: SupporterDoc | null) => ({
  open,
  code,
  supporter: supporter
    ? { since: supporter.since, badgePublic: supporter.badgePublic === true, listed: supporter.listed === true, listName: supporter.listName ?? '' }
    : null,
})

async function owner() {
  const result = await requireActiveProfile()
  if ('error' in result) return result
  if (result.profile.kids) return { error: json({ error: 'Not available on Kids profiles', code: 'kids' }, 403) }
  return result
}

export async function GET() {
  const me = await owner()
  if ('error' in me) return me.error
  try {
    // A slow claim never holds the page: it finishes on the next visit.
    await withTimeout(claimSupport(me.userId), 2500, 0)
    const [code, supporter] = await Promise.all([ensureSupportCode(me.userId), getSupporter(me.userId)])
    return json(shape(!!supportUrl(), code, supporter))
  } catch (error) {
    console.error('supporters/me failed:', error)
    return json({ error: 'Failed' }, 500)
  }
}

export async function PATCH(request: Request) {
  const denied = await denyLimitedSession()
  if (denied) return denied
  const me = await owner()
  if ('error' in me) return me.error
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'Invalid' }, 400)
  const prefs: { badgePublic?: boolean; listed?: boolean; listName?: string } = {}
  if ('badgePublic' in body) {
    if (typeof body.badgePublic !== 'boolean') return json({ error: 'Invalid' }, 400)
    prefs.badgePublic = body.badgePublic
  }
  if ('listed' in body) {
    if (typeof body.listed !== 'boolean') return json({ error: 'Invalid' }, 400)
    prefs.listed = body.listed
  }
  if ('listName' in body) {
    const name = cleanListName(body.listName)
    if (name === null) return json({ error: 'Invalid name', code: 'name' }, 400)
    prefs.listName = name
  }
  if (Object.keys(prefs).length === 0) return json({ error: 'Invalid' }, 400)
  try {
    if (!(await getSupporter(me.userId))) return json({ error: 'Not a supporter', code: 'not_supporter' }, 404)
    const supporter = await setSupporterPrefs(me.userId, prefs)
    const code = await ensureSupportCode(me.userId)
    return json(shape(!!supportUrl(), code, supporter))
  } catch (error) {
    console.error('supporters/me PATCH failed:', error)
    return json({ error: 'Failed' }, 500)
  }
}
