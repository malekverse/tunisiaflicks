// Who /u/[handle] shows, to whom, once per request (generateMetadata and the page share it, so a
// guest's view is counted once). Unknown handles, Kids profiles and anyone on either side of a
// block get the same not-found; so does every handle for a guest over 60 page views in 10
// minutes (per IP, per /64 for IPv6), so the limit can't be used to tell pages apart.
import 'server-only'
import { cache } from 'react'
import { headers } from 'next/headers'
import clientPromise from '@/src/lib/mongodb'
import { clientIp, rateLimit } from '@/src/lib/rate-limit'
import { socialDb, type SocialProfileDoc } from '@/src/lib/social/db'
import { relationship } from '@/src/lib/social/friends'
import { resolveHandle } from '@/src/lib/social/identity'
import { canSeeDoc, normalizePrivacy, shareKeyMatches } from '@/src/lib/social/privacy'
import { ipKey, normalizeHandle } from '@/src/lib/social/rules'
import { HANDLE_RE, type PrivacySettings, type ProfileRef, type PublicIdentity, type Relationship } from '@/src/lib/social/types'
import { friendshipBetween, pageViewer, profileIsKids, type PageViewer } from '@/src/app/friends/_lib/viewer'

export const GUEST_VIEWS = 60
export const GUEST_WINDOW_SECONDS = 10 * 60

export type ProfileView =
  | { kind: 'not_found' }
  | { kind: 'redirect'; to: string }
  | { kind: 'kids_viewer'; viewer: PageViewer }
  | {
    kind: 'page'
    owner: ProfileRef
    identity: PublicIdentity
    page: SocialProfileDoc
    privacy: PrivacySettings
    viewer: PageViewer
    /** The viewer as the social layer sees them (null: a guest, a TV, or no profile picked). */
    viewerRef: ProfileRef | null
    isOwner: boolean
    relationship: Relationship
    requestId: string | null
    friendsSince: Date | null
    /** The viewer holds the page's private link (?k=). */
    linkAccess: boolean
    can: { activity: boolean; ratings: boolean; badges: boolean }
  }

const guestKey = (ip: string) => `social:u-view:${ipKey(ip)}`

/**
 * Whether a guest at this address is already over the limit, without counting a view: the gate
 * asks before the page, and only the page counts. The same fixed window as rateLimit().
 */
async function guestOverLimit(ip: string): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000)
  const windowStart = now - (now % GUEST_WINDOW_SECONDS)
  try {
    const db = (await clientPromise).db()
    const row = await db.collection<{ _id: string; count: number }>('rateLimits').findOne({ _id: `${guestKey(ip)}:${windowStart}` })
    return (row?.count ?? 0) >= GUEST_VIEWS
  } catch {
    return false
  }
}

type Access =
  | { kind: 'not_found' }
  | { kind: 'redirect'; to: string }
  | { kind: 'kids_viewer'; viewer: PageViewer }
  | { kind: 'open'; viewer: PageViewer; viewerRef: ProfileRef | null; owner: ProfileRef; identity: PublicIdentity; how: Relationship; page: SocialProfileDoc }

/**
 * Whether the page shows at all, and to whom. `peekIp`: the middleware's gate asking for the
 * visitor at that address (a guest's view is checked against the limit there, not counted).
 */
async function access(rawHandle: string, opts: { peekIp?: string }): Promise<Access> {
  let decoded = rawHandle
  try { decoded = decodeURIComponent(rawHandle) } catch { /* keep it as written */ }
  const handle = normalizeHandle(decoded)
  if (!handle || !HANDLE_RE.test(handle)) return { kind: 'not_found' }

  const viewer = await pageViewer()
  if (viewer.kind === 'guest') {
    if (opts.peekIp !== undefined) {
      if (await guestOverLimit(opts.peekIp)) return { kind: 'not_found' }
    } else {
      const limit = await rateLimit(guestKey(clientIp(headers())), GUEST_VIEWS, GUEST_WINDOW_SECONDS)
      if (!limit.ok) return { kind: 'not_found' }
    }
  }

  const target = await resolveHandle(handle)
  if (!target) return { kind: 'not_found' }
  if (target.redirectTo) return { kind: 'redirect', to: target.redirectTo }
  if (handle !== decoded) return { kind: 'redirect', to: handle }
  const owner: ProfileRef = { userId: target.userId, profileId: target.profileId }
  if (await profileIsKids(owner)) return { kind: 'not_found' }

  if (viewer.kind === 'kids') return { kind: 'kids_viewer', viewer }
  const viewerRef = viewer.kind === 'member' ? viewer.ref : null

  const { profiles } = await socialDb()
  const [how, page] = await Promise.all([relationship(viewerRef, owner), profiles.findOne({ _id: owner.profileId })])
  if (how === 'blocked' || !page || page.userId !== owner.userId) return { kind: 'not_found' }
  // A TV signed in with a code is still that account: never show it a page blocked from it.
  if (viewer.kind === 'tv' && (await relationship(viewer.ref, owner)) === 'blocked') return { kind: 'not_found' }
  return { kind: 'open', viewer, viewerRef, owner, identity: target.identity, how, page }
}

/** For the middleware's gate (/u/[handle]/gate): what the page would answer, nothing more. */
export async function gateView(rawHandle: string, ip: string): Promise<{ kind: 'not_found' } | { kind: 'redirect'; to: string } | { kind: 'page' }> {
  const found = await access(rawHandle, { peekIp: ip })
  if (found.kind === 'not_found' || found.kind === 'redirect') return found
  return { kind: 'page' }
}

/** Once per request: generateMetadata and the page share it, so a guest's view is counted once. */
export const loadProfileView = cache(async (rawHandle: string, key: string | null): Promise<ProfileView> => {
  const found = await access(rawHandle, {})
  if (found.kind !== 'open') return found
  const { viewer, viewerRef, owner, identity, how, page } = found

  const isOwner = how === 'self'
  const row = how === 'friends' || how === 'incoming' || how === 'outgoing' ? await friendshipBetween(owner.profileId, viewerRef!.profileId) : null
  const [linkAccess, activity, ratings, badges] = await Promise.all([
    !isOwner && !!key ? shareKeyMatches(owner, key) : false,
    isOwner || canSeeDoc(viewerRef, owner, page, 'activity'),
    isOwner || canSeeDoc(viewerRef, owner, page, 'ratings', key),
    isOwner || canSeeDoc(viewerRef, owner, page, 'badges', key),
  ])
  return {
    kind: 'page',
    owner,
    identity,
    page,
    privacy: normalizePrivacy(page.privacy),
    viewer,
    viewerRef,
    isOwner,
    relationship: how,
    requestId: row && how !== 'friends' ? String(row._id) : null,
    friendsSince: how === 'friends' && row?.acceptedAt ? new Date(row.acceptedAt) : null,
    linkAccess,
    can: { activity, ratings, badges },
  }
})
