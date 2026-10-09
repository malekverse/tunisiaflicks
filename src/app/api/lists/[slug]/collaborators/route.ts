// The people in a list.
// GET                     -> ListCollaborators (members only; pending and the link for the owner)
// POST { to: [handles] }  -> { sent, skipped }: the owner invites friends by name (also `handles`)
// POST { token }          -> join with an invitation link, as an editor
// POST { accept: true }   -> join after an invitation by name
// POST { decline: true }  -> say no to an invitation by name
// POST { invite: 'link' } -> { url, expiresAt, uses, maxUses }: a new link (the old one stops working)
// DELETE { invite: 'link' }  -> the owner turns the link off
// DELETE ?member=<id>        -> leave (yourself) or, for the owner, take someone out
// PATCH { member, role: 'owner' } -> the owner hands the list over
// PATCH { muted }                 -> stop (or start) hearing about changes
// Kids: 403 {code:'kids'} for all of it. Anything about a list you may not see: 404.
import { createInvite, consumeInvite, inviteHref, inviteStatus, isInviteToken, readInvite, revokeInvites } from '@/src/lib/invites'
import { getListBySlug, isSlug, listsCollection, type ListDoc } from '@/src/lib/lists-db'
import { notify, settleNotificationAction } from '@/src/lib/notify'
import { areFriends } from '@/src/lib/social/friends'
import { resolveHandle } from '@/src/lib/social/identity'
import { readJson, requireSocial, socialRateLimit } from '@/src/lib/social/session'
import { HANDLE_RE, type ProfileRef } from '@/src/lib/social/types'
import { LIMIT_MESSAGES, forbidden, kidsOnly, listError, listJson, listNotFound, ownerOnly, unauthorized } from '@/src/lib/shared-lists/api'
import {
  INVITE_DAYS, INVITE_MAX_USES, MAX_MEMBERS, MAX_OWNED, MAX_PENDING, PENDING_DAYS, canEdit, livePending, visibilityOf,
} from '@/src/lib/shared-lists/rules'
import {
  activityEntry, blockedWithList, ensureMembers, joinList, loadListViewer, membersOf, nameOf, notifyOwnerChange, peopleFor,
  pushActivity, resolveAccess, UNKNOWN_PERSON, type ListViewer,
} from '@/src/lib/shared-lists/server'
import type { ListCollaborators } from '@/src/lib/shared-lists/types'

export const dynamic = 'force-dynamic'

type Params = { params: { slug: string } }

/** Signed in, a grown-up profile picked, not a TV: the viewer, or the answer to give. */
async function gate(write: boolean) {
  const social = await requireSocial({ write })
  if ('error' in social) return { error: social.error }
  const viewer = await loadListViewer()
  if (!viewer?.profileId) return { error: unauthorized() }
  if (viewer.kids) return { error: kidsOnly() }
  return { viewer, me: social.ref, social: social.social }
}

async function load(slug: string, viewer: ListViewer, opts: { invited?: boolean } = {}) {
  if (!isSlug(slug)) return null
  const list = await getListBySlug(slug)
  if (!list) return null
  const { access, ownerProfileId } = await resolveAccess(list, viewer, opts)
  if (access === 'none') return null
  return { list, access, ownerProfileId }
}

const JOIN_ERRORS = {
  full: () => listError(409, 'members_full', LIMIT_MESSAGES.members),
  limit: () => listError(409, 'limit_joined', LIMIT_MESSAGES.joined),
  gone: () => listNotFound(),
}

export async function GET(_request: Request, { params }: Params) {
  const viewer = await loadListViewer()
  if (!viewer) return unauthorized()
  if (viewer.kids) return kidsOnly()
  const found = await load(params.slug, viewer)
  if (!found) return listNotFound()
  const { list, access, ownerProfileId } = found
  if (!canEdit(access)) return forbidden()

  const members = membersOf(list, ownerProfileId)
  const owner = access === 'owner'
  const pending = owner ? livePending(list.pending, Date.now()) : []
  const people = await peopleFor([
    ...members.map((entry) => ({ userId: entry.userId, profileId: entry.profileId })),
    ...pending.map((entry) => ({ userId: entry.userId, profileId: entry.profileId })),
  ])
  const status = owner ? await inviteStatus('list', list.slug) : null
  const body: ListCollaborators = {
    role: access,
    visibility: visibilityOf(list),
    members: members.map((entry) => ({
      id: entry.id,
      role: entry.role,
      you: entry.profileId === viewer.profileId,
      ...(entry.profileId === viewer.profileId ? { muted: !!entry.muted } : {}),
      joinedAt: new Date(entry.joinedAt).toISOString(),
    })),
    people: Object.fromEntries(members.map((entry) => [entry.id, people.get(entry.profileId) ?? UNKNOWN_PERSON])),
    pending: pending.map((entry) => ({ person: people.get(entry.profileId) ?? UNKNOWN_PERSON, at: new Date(entry.at).toISOString() })),
    invite: status ? { ...status, expiresAt: status.expiresAt ? status.expiresAt.toISOString() : null } : null,
  }
  return listJson(body)
}

export async function POST(request: Request, { params }: Params) {
  const body = await readJson(request)
  if (!body) return listError(400, 'invalid', 'Invalid body')

  // Saying no needs no verified e-mail; everything else is acting socially.
  const declining = body.decline === true
  const access = await gate(!declining)
  if ('error' in access) return access.error
  const { viewer, me } = access

  // Join with a link: the link must point at this list, and nobody in it may be blocked with you.
  if (typeof body.token === 'string' && body.accept === undefined && body.decline === undefined) {
    const token = body.token
    if (!isInviteToken(token)) return listError(404, 'invalid', 'This invitation link is not valid')
    const invite = await readInvite('list', token)
    if (!invite || invite.targetId !== params.slug) return listError(404, 'invalid', 'This invitation link is not valid')
    const found = await load(params.slug, viewer, { invited: true })
    if (!found) return listError(404, 'invalid', 'This invitation link is not valid')
    const list = await ensureMembers(found.list)
    if (list.userId === me.userId || list.members?.some((entry) => entry.profileId === me.profileId)) return listJson({ joined: false, already: true })
    if (await blockedWithList(me, list, found.ownerProfileId)) return listError(404, 'invalid', 'This invitation link is not valid')
    if ((list.members?.length ?? 1) >= MAX_MEMBERS) return JOIN_ERRORS.full()
    const used = await consumeInvite('list', token)
    if ('reason' in used) return used.reason === 'invalid' ? listError(404, 'invalid', 'This invitation link is not valid') : listError(410, used.reason, 'This invitation link no longer works')
    const result = await joinList(list, me)
    if (result === 'joined' || result === 'already') return listJson({ joined: result === 'joined', already: result === 'already' })
    return JOIN_ERRORS[result]()
  }

  // An invitation by name: yes or no.
  if (body.accept === true || declining) {
    if (!isSlug(params.slug)) return listNotFound()
    const list = await getListBySlug(params.slug)
    const invited = list ? livePending(list.pending, Date.now()).find((entry) => entry.profileId === me.profileId) : undefined
    if (!list || !invited) return listNotFound()
    if (declining) {
      await (await listsCollection()).updateOne({ slug: list.slug }, { $pull: { pending: { profileId: me.profileId } } })
      await settleNotificationAction(me, { type: 'list_invite', id: list.slug }, 'declined').catch(() => undefined)
      return listJson({ declined: true })
    }
    const { access: seen, ownerProfileId } = await resolveAccess(list, viewer)
    if (seen === 'none' || (await blockedWithList(me, list, ownerProfileId))) return listNotFound()
    const result = await joinList(list, me)
    if (result === 'joined' || result === 'already') return listJson({ joined: result === 'joined', already: result === 'already' })
    return JOIN_ERRORS[result]()
  }

  const found = await load(params.slug, viewer)
  if (!found) return listNotFound()
  if (found.access !== 'owner') return found.access === 'viewer' ? forbidden() : ownerOnly()

  // A new invitation link (the previous one stops working).
  if (body.invite === 'link') {
    const limited = await socialRateLimit([[`lists:link:${viewer.userId}`, 30, 24 * 60 * 60]])
    if (limited) return limited
    await ensureMembers(found.list)
    const { token, expiresAt } = await createInvite({
      kind: 'list',
      targetId: found.list.slug,
      owner: me,
      expiresAt: new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000),
      maxUses: INVITE_MAX_USES,
      replace: true,
    })
    return listJson({ url: inviteHref(`/lists/${found.list.slug}`, token), expiresAt: expiresAt.toISOString(), uses: 0, maxUses: INVITE_MAX_USES }, 201)
  }

  // Friends, by name.
  const raw = Array.isArray(body.to) ? body.to : Array.isArray(body.handles) ? body.handles : null
  if (raw) {
    if (!access.social) return listError(409, 'needs_handle', 'Create your page first')
    const handles = Array.from(new Set(raw.filter((handle): handle is string => typeof handle === 'string').map((handle) => handle.trim().replace(/^@/, '').toLowerCase()))).filter((handle) => HANDLE_RE.test(handle))
    if (handles.length < 1 || handles.length > MAX_MEMBERS - 1) return listError(400, 'invalid_recipients')
    const limited = await socialRateLimit([[`lists:invite:${viewer.userId}`, 60, 24 * 60 * 60]])
    if (limited) return limited
    const collection = await listsCollection()
    const list = await ensureMembers(found.list)
    await collection.updateOne({ slug: list.slug }, { $pull: { pending: { at: { $lt: new Date(Date.now() - PENDING_DAYS * 24 * 60 * 60 * 1000) } } } })
    const myName = (await nameOf(me)) || access.social.name
    const sent: string[] = []
    const skipped: string[] = []
    for (const handle of handles) {
      const friend = await resolveHandle(handle)
      const ref: ProfileRef | null = friend && !friend.redirectTo ? { userId: friend.userId, profileId: friend.profileId } : null
      if (!ref || ref.userId === list.userId || list.members?.some((entry) => entry.profileId === ref.profileId)
        || !(await areFriends(me.profileId, ref.profileId)) || (await blockedWithList(ref, list, found.ownerProfileId))) {
        skipped.push(handle)
        continue
      }
      const added = await collection.updateOne(
        { slug: list.slug, userId: list.userId, 'pending.profileId': { $ne: ref.profileId }, 'members.profileId': { $ne: ref.profileId }, [`pending.${MAX_PENDING - 1}`]: { $exists: false } },
        { $push: { pending: { userId: ref.userId, profileId: ref.profileId, invitedBy: me.profileId, at: new Date() } } },
      )
      if (added.modifiedCount !== 1) {
        // Already invited and waiting counts as sent; a full invitation list doesn't.
        const fresh = await collection.findOne({ slug: list.slug }, { projection: { pending: 1 } })
        if (fresh?.pending?.some((entry) => entry.profileId === ref.profileId)) sent.push(handle)
        else skipped.push(handle)
        continue
      }
      const vars = { name: myName, list: list.title }
      await notify({
        to: ref,
        kind: 'list_invite',
        key: `${list.slug}:${Date.now()}`,
        href: `/lists/${list.slug}`,
        text: { key: 'sharedLists.inbox.invite', vars },
        actor: me,
        action: { type: 'list_invite', id: list.slug },
        push: { topic: 'friends', title: { key: 'sharedLists.push.inviteTitle' }, body: { key: 'sharedLists.inbox.invite', vars } },
      }).catch((error) => console.error('list_invite notify failed', error))
      sent.push(handle)
    }
    return listJson({ sent, skipped }, sent.length ? 201 : 200)
  }
  return listError(400, 'invalid', 'Nothing to do')
}

export async function DELETE(request: Request, { params }: Params) {
  const viewer = await loadListViewer()
  if (!viewer?.profileId) return unauthorized()
  if (viewer.kids) return kidsOnly()
  const found = await load(params.slug, viewer)
  if (!found) return listNotFound()
  const collection = await listsCollection()
  const memberId = new URL(request.url).searchParams.get('member')

  if (!memberId) {
    const body = await readJson(request)
    if (body?.invite !== 'link') return listError(400, 'invalid', 'Nothing to do')
    if (found.access !== 'owner') return ownerOnly()
    await revokeInvites('list', found.list.slug)
    return listJson({ success: true })
  }

  const list = await ensureMembers(found.list)
  const target = list.members?.find((entry) => entry.id === memberId)
  if (!target) return listNotFound()
  const self = target.profileId === viewer.profileId
  if (target.role === 'owner') return listError(409, 'owner_leave', 'The owner can hand the list over or delete it, not leave it')
  if (!self && found.access !== 'owner') return ownerOnly()
  const result = await collection.updateOne(
    self
      ? { slug: list.slug, members: { $elemMatch: { id: target.id, profileId: viewer.profileId, role: 'editor' } } }
      : { slug: list.slug, userId: viewer.userId, members: { $elemMatch: { id: target.id, role: 'editor' } } },
    {
      $pull: { members: { id: target.id } },
      $push: pushActivity(activityEntry(target.profileId, 'leave', self ? {} : { value: 'removed' })),
      $inc: { version: 1 },
      $set: { updatedAt: new Date() },
    },
  )
  if (result.modifiedCount !== 1) return listNotFound()
  return listJson({ success: true, left: self })
}

export async function PATCH(request: Request, { params }: Params) {
  const viewer = await loadListViewer()
  if (!viewer?.profileId) return unauthorized()
  if (viewer.kids) return kidsOnly()
  const body = await readJson(request)
  if (!body) return listError(400, 'invalid', 'Invalid body')
  const found = await load(params.slug, viewer)
  if (!found) return listNotFound()
  if (!canEdit(found.access)) return forbidden()
  const list = await ensureMembers(found.list)
  const collection = await listsCollection()

  if (typeof body.muted === 'boolean') {
    const result = await collection.updateOne(
      { slug: list.slug, 'members.profileId': viewer.profileId },
      { $set: { 'members.$.muted': body.muted } },
    )
    if (result.matchedCount !== 1) return forbidden()
    return listJson({ muted: body.muted })
  }

  if (body.role === 'owner' && typeof body.member === 'string') {
    const social = await requireSocial({ write: true })
    if ('error' in social) return social.error
    if (found.access !== 'owner') return ownerOnly()
    const target = list.members?.find((entry) => entry.id === body.member && entry.role === 'editor')
    if (!target) return listNotFound()
    if (await collection.countDocuments({ userId: target.userId }) >= MAX_OWNED) return listError(409, 'limit_owned', LIMIT_MESSAGES.owned)
    const ownerName = (await nameOf({ userId: target.userId, profileId: target.profileId })) || list.ownerName
    const previous = found.ownerProfileId
    const result = await collection.updateOne(
      { slug: list.slug, userId: list.userId, ownerProfileId: previous, 'members.id': target.id },
      {
        $set: {
          userId: target.userId,
          ownerProfileId: target.profileId,
          ownerName,
          'members.$[before].role': 'editor',
          'members.$[after].role': 'owner',
          updatedAt: new Date(),
        },
        $inc: { version: 1 },
        $push: pushActivity(activityEntry(viewer.profileId, 'owner', { value: target.id })),
      },
      { arrayFilters: [{ 'before.profileId': previous }, { 'after.id': target.id }] },
    )
    if (result.modifiedCount !== 1) return listError(409, 'conflict', 'The list changed meanwhile')
    // Links made by the previous owner stop working; the new owner makes their own.
    await revokeInvites('list', list.slug)
    await notifyOwnerChange({ ...list, version: (list.version ?? 0) + 1 } as ListDoc, { userId: viewer.userId, profileId: viewer.profileId }, { userId: target.userId, profileId: target.profileId })
    return listJson({ success: true })
  }
  return listError(400, 'invalid', 'Nothing to do')
}
