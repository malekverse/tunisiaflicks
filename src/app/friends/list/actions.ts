'use server'
// "Add a friend": who an exact handle belongs to, and how you stand with them. There is no
// directory and no partial match: an exact handle or nothing. Someone on either side of a block,
// or a Kids profile, is "nobody". Rate-limited per account.
import { rateLimitAll } from '@/src/lib/rate-limit'
import { socialDb } from '@/src/lib/social/db'
import { relationship } from '@/src/lib/social/friends'
import { resolveHandle } from '@/src/lib/social/identity'
import { normalizePrivacy } from '@/src/lib/social/privacy'
import { normalizeHandle } from '@/src/lib/social/rules'
import { socialSelf } from '@/src/lib/social/session'
import { HANDLE_RE, type PublicIdentity, type Relationship } from '@/src/lib/social/types'
import { friendshipBetween, profileIsKids } from '../_lib/viewer'

export type LookupResult =
  | { status: 'found'; person: PublicIdentity; relationship: Relationship; requestId: string | null; requestsOff: boolean }
  | { status: 'not_found' }
  | { status: 'error'; code: string }

export async function lookupHandle(raw: string): Promise<LookupResult> {
  const self = await socialSelf()
  if (!self) return { status: 'error', code: 'unauthorized' }
  if (self.limited) return { status: 'error', code: 'tv_session' }
  if (self.kids) return { status: 'error', code: 'kids' }
  const handle = normalizeHandle(typeof raw === 'string' ? raw.slice(0, 40) : null)
  if (!handle || !HANDLE_RE.test(handle)) return { status: 'not_found' }
  const limit = await rateLimitAll([[`social:lookup:${self.ref.userId}`, 40, 10 * 60]])
  if (!limit.ok) return { status: 'error', code: 'rate_limited' }

  const target = await resolveHandle(handle)
  if (!target || (await profileIsKids(target))) return { status: 'not_found' }
  const how = await relationship(self.ref, target)
  if (how === 'blocked') return { status: 'not_found' }
  const [row, page] = await Promise.all([
    how === 'incoming' || how === 'outgoing' ? friendshipBetween(self.ref.profileId, target.profileId) : null,
    socialDb().then(({ profiles }) => profiles.findOne({ _id: target.profileId }, { projection: { privacy: 1 } })),
  ])
  return {
    status: 'found',
    person: target.identity,
    relationship: how,
    requestId: row ? String(row._id) : null,
    requestsOff: normalizePrivacy(page?.privacy).requests === 'nobody',
  }
}
