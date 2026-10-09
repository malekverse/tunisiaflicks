// 'Badges and streak' for the active profile (Settings #privacy).
//
// GET   -> { enabled }
// PATCH { enabled: boolean } -> { enabled }. Off deletes the daily log (watchActivity) and hides
//       the shelf; on starts a fresh log. Grown-up profiles only (403 kids), never from a TV signed
//       in with a code (403 tv_session).
import { NextResponse } from 'next/server'
import { requireActiveProfile } from '@/src/lib/profiles'
import { denyLimitedSession } from '@/src/lib/session-scope'
import { badgesEnabled, setBadgesEnabled } from '@/src/lib/badges/view'

export const dynamic = 'force-dynamic'

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })

async function grownUp() {
  const owner = await requireActiveProfile()
  if ('error' in owner) return owner
  if (owner.profile.kids) return { error: json({ error: 'Not available on Kids profiles', code: 'kids' }, 403) }
  return owner
}

export async function GET() {
  const owner = await grownUp()
  if ('error' in owner) return owner.error
  try {
    return json({ enabled: await badgesEnabled({ userId: owner.userId, profileId: owner.profile.id }) })
  } catch (error) {
    console.error('badges/settings failed:', error)
    return json({ error: 'Failed' }, 500)
  }
}

export async function PATCH(request: Request) {
  const denied = await denyLimitedSession()
  if (denied) return denied
  const owner = await grownUp()
  if ('error' in owner) return owner.error
  const body = await request.json().catch(() => null)
  const enabled = body && typeof body === 'object' ? (body as { enabled?: unknown }).enabled : undefined
  if (typeof enabled !== 'boolean') return json({ error: 'Invalid' }, 400)
  try {
    await setBadgesEnabled({ userId: owner.userId, profileId: owner.profile.id }, enabled)
    return json({ enabled })
  } catch (error) {
    console.error('badges/settings PATCH failed:', error)
    return json({ error: 'Failed' }, 500)
  }
}
