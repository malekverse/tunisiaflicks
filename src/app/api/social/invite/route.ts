// Your friend invite link (/u/handle?invite=TOKEN): POST makes a new one (the previous one stops
// working), GET says how it's doing, DELETE turns it off. 14 days, 10 uses.
import { createInvite, inviteHref, inviteStatus, revokeInvites } from '@/src/lib/invites'
import { DAYS } from '@/src/lib/social/db'
import { requireSocial, socialJson, socialRateLimit } from '@/src/lib/social/session'

export const dynamic = 'force-dynamic'

const INVITE_DAYS = 14
const INVITE_USES = 10

export async function POST() {
  const gate = await requireSocial({ needsHandle: true, write: true })
  if ('error' in gate) return gate.error
  const { ref } = gate
  const limited = await socialRateLimit([[`social:invite:${ref.userId}`, 20, 24 * 60 * 60]])
  if (limited) return limited
  const { token, expiresAt } = await createInvite({
    kind: 'friend',
    targetId: ref.profileId,
    owner: ref,
    expiresAt: new Date(Date.now() + DAYS(INVITE_DAYS)),
    maxUses: INVITE_USES,
    replace: true,
  })
  return socialJson({ url: inviteHref(`/u/${gate.social!.handle}`, token), expiresAt, uses: 0, maxUses: INVITE_USES }, 201)
}

export async function GET() {
  const gate = await requireSocial({ needsHandle: true })
  if ('error' in gate) return gate.error
  return socialJson(await inviteStatus('friend', gate.ref.profileId))
}

export async function DELETE() {
  const gate = await requireSocial({ needsHandle: true })
  if ('error' in gate) return gate.error
  await revokeInvites('friend', gate.ref.profileId)
  return socialJson({ ok: true })
}
