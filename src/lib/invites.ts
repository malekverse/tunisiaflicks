// Invitation links: always the invited thing's own URL plus ?invite=TOKEN (a friend's page, a
// movie night, a list). Only a hash of the token is stored; links expire, have a use limit, and
// can be turned off. Used for friends (social), movie nights and shared lists.
import 'server-only'
import { createHash, randomBytes } from 'crypto'
import { socialDb, type InviteDoc } from '@/src/lib/social/db'
import type { ProfileRef } from '@/src/lib/social/types'

export type InviteKind = 'friend' | 'night' | 'list'

/** 16 random bytes in base64url: exactly 22 characters. */
export const isInviteToken = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{22}$/.test(value)

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

/** The thing's URL with the token added (keeps any query it already has). */
export const inviteHref = (path: string, token: string) => `${path}${path.includes('?') ? '&' : '?'}invite=${encodeURIComponent(token)}`

/** A new link. `replace` turns off the target's earlier links of the same kind first. */
export async function createInvite(i: { kind: InviteKind; targetId: string; owner: ProfileRef; expiresAt: Date; maxUses: number; replace?: boolean }): Promise<{ token: string; expiresAt: Date }> {
  const { invites } = await socialDb()
  const now = new Date()
  if (i.replace) await invites.updateMany({ kind: i.kind, targetId: i.targetId, revokedAt: null }, { $set: { revokedAt: now } })
  const token = randomBytes(16).toString('base64url')
  await invites.insertOne({
    _id: hashToken(token),
    kind: i.kind,
    targetId: i.targetId,
    owner: { userId: i.owner.userId, profileId: i.owner.profileId },
    createdAt: now,
    expiresAt: i.expiresAt,
    maxUses: Math.max(1, Math.floor(i.maxUses)),
    uses: 0,
    revokedAt: null,
  })
  return { token, expiresAt: i.expiresAt }
}

const usable = (doc: InviteDoc | null, now = Date.now()) => !!doc && !doc.revokedAt && new Date(doc.expiresAt).getTime() > now

/** What a link points to, while it is on and unexpired (also when used up: check uses < maxUses). */
export async function readInvite(kind: InviteKind, token: string): Promise<{ targetId: string; owner: ProfileRef; expiresAt: Date; uses: number; maxUses: number } | null> {
  if (!isInviteToken(token)) return null
  const { invites } = await socialDb()
  const doc = await invites.findOne({ _id: hashToken(token), kind })
  if (!doc || !usable(doc)) return null
  return { targetId: doc.targetId, owner: doc.owner, expiresAt: doc.expiresAt, uses: doc.uses, maxUses: doc.maxUses }
}

/**
 * Uses the link once, atomically: only while it is on, unexpired and under its use limit. Two
 * people can't both take the last use.
 */
export async function consumeInvite(kind: InviteKind, token: string): Promise<{ ok: true; targetId: string; owner: ProfileRef } | { ok: false; reason: 'invalid' | 'expired' | 'used_up' }> {
  if (!isInviteToken(token)) return { ok: false, reason: 'invalid' }
  const { invites } = await socialDb()
  const _id = hashToken(token)
  const now = new Date()
  const result = await invites.updateOne(
    { _id, kind, revokedAt: null, expiresAt: { $gt: now }, $expr: { $lt: ['$uses', '$maxUses'] } },
    { $inc: { uses: 1 } },
  )
  const doc = await invites.findOne({ _id, kind })
  if (result.modifiedCount === 1 && doc) return { ok: true, targetId: doc.targetId, owner: doc.owner }
  if (!doc || doc.revokedAt) return { ok: false, reason: 'invalid' }
  if (new Date(doc.expiresAt).getTime() <= now.getTime()) return { ok: false, reason: 'expired' }
  return { ok: false, reason: 'used_up' }
}

/** The target's current link (the newest one still on), for "Works until" and "Used 3 of 10". */
export async function inviteStatus(kind: InviteKind, targetId: string): Promise<{ active: boolean; uses: number; maxUses: number; expiresAt: Date | null }> {
  const { invites } = await socialDb()
  const doc = await invites.findOne({ kind, targetId, revokedAt: null, expiresAt: { $gt: new Date() } }, { sort: { createdAt: -1 } })
  if (!doc) return { active: false, uses: 0, maxUses: 0, expiresAt: null }
  return { active: doc.uses < doc.maxUses, uses: doc.uses, maxUses: doc.maxUses, expiresAt: doc.expiresAt }
}

/** Turns off every link of the target. */
export async function revokeInvites(kind: InviteKind, targetId: string): Promise<void> {
  const { invites } = await socialDb()
  await invites.updateMany({ kind, targetId, revokedAt: null }, { $set: { revokedAt: new Date() } })
}
