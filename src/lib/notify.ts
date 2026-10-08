// The inbox's one way in: notify() files a notification for one profile (and pushes it to that
// profile's devices when asked). Used by friends, sent titles, ratings, movie nights, lists and
// badges. Release alerts keep their own job (lib/release-alerts.ts) in the same collection.
import 'server-only'
import { MongoServerError } from 'mongodb'
import { createTranslator, type TKey } from '@/src/lib/i18n'
import { pushToUser } from '@/src/lib/push'
import { socialDb } from '@/src/lib/social/db'
import { isBlockedEitherWay } from '@/src/lib/social/friends'
import { MERGE_WINDOW_MS, eventKey, mergeEligible, mergeKeyFor } from '@/src/lib/social/rules'
import type { InboxActionType, NotificationKind, ProfileRef, ShareMedia } from '@/src/lib/social/types'

export type NotifyText = { key: TKey; vars?: Record<string, string | number> }

export type NotifyInput = {
  to: ProfileRef
  kind: NotificationKind
  /** Unique per event for this kind and recipient (a second notify with the same key is ignored). */
  key: string
  href: string
  text: NotifyText
  actor?: ProfileRef
  media?: ShareMedia
  image?: string | null
  note?: string
  action?: { type: InboxActionType; id: string }
  /** Fold into an unread notification of the same kind about the same title from the last 24h. Only without a note. */
  merge?: boolean
  /** Shown on a Kids profile too (badges). */
  kidsVisible?: boolean
  push?: false | { topic: 'friends' | 'nights' | 'alerts'; title: NotifyText; body: NotifyText }
}

const isDuplicateKey = (error: unknown) => error instanceof MongoServerError && error.code === 11000

const actorRef = (ref: ProfileRef): ProfileRef => ({ userId: ref.userId, profileId: ref.profileId })

/** Sends the push, translated for each device; the lock screen never shows a note. */
async function sendPush(input: NotifyInput, tag: string) {
  if (!input.push) return
  const push = input.push
  await pushToUser(
    input.to.userId,
    (device) => {
      const t = createTranslator(device.locale)
      return {
        title: t(push.title.key, push.title.vars),
        body: t(push.body.key, push.body.vars),
        url: input.href,
        tag,
      }
    },
    push.topic,
    { profileId: input.to.profileId },
  ).catch((error) => console.error('notify: push failed', error))
}

export async function notify(i: NotifyInput): Promise<{ created: boolean; id?: string }> {
  if (i.actor && (await isBlockedEitherWay(i.actor, i.to))) return { created: false }
  const { notifications } = await socialDb()
  const now = new Date()
  const note = i.note?.trim() || null
  const mergeKey = i.media && mergeEligible({ merge: i.merge, note, media: i.media }) ? mergeKeyFor(i.kind, i.media) : null

  if (mergeKey) {
    const since = new Date(now.getTime() - MERGE_WINDOW_MS)
    const base = { userId: i.to.userId, profileId: i.to.profileId, merge_key: mergeKey, read: false, created_at: { $gte: since } }
    const actor = i.actor ? actorRef(i.actor) : null
    // A new person joins the merged notification (newest first, three kept, the count goes on).
    const merged = actor
      ? await notifications.findOneAndUpdate(
        { ...base, 'actors.profileId': { $ne: actor.profileId } },
        { $push: { actors: { $each: [actor], $position: 0, $slice: 3 } }, $inc: { actorCount: 1 }, $set: { actor, created_at: now } },
        { returnDocument: 'after' },
      )
      : null
    const doc = merged?.value ?? (await notifications.findOneAndUpdate(base, { $set: { created_at: now } }, { returnDocument: 'after' })).value
    if (doc) {
      if (merged?.value) await sendPush(i, mergeKey)
      return { created: false, id: String(doc._id) }
    }
  }

  const event_key = eventKey(i.kind, i.to.profileId, i.key)
  try {
    const result = await notifications.insertOne({
      userId: i.to.userId,
      profileId: i.to.profileId,
      kind: i.kind,
      event_key,
      href: i.href,
      text: { key: i.text.key, ...(i.text.vars ? { vars: i.text.vars } : {}) },
      actor: i.actor ? actorRef(i.actor) : null,
      actors: i.actor ? [actorRef(i.actor)] : [],
      actorCount: i.actor ? 1 : 0,
      media: i.media ?? null,
      image: i.image ?? null,
      note,
      action: i.action ? { type: i.action.type, id: i.action.id, state: 'pending' } : null,
      merge_key: mergeKey,
      kidsVisible: i.kidsVisible === true,
      created_at: now,
      read: false,
      // Social notifications are never e-mailed one by one (the weekly digest may mention them).
      email_status: 'none',
    })
    await sendPush(i, mergeKey ?? event_key)
    return { created: true, id: String(result.insertedId) }
  } catch (error) {
    if (isDuplicateKey(error)) return { created: false }
    throw error
  }
}

/** Takes back a notification that no longer holds (a cancelled request, an uninvite). */
export async function retractNotification(to: ProfileRef, kind: NotificationKind, key: string): Promise<void> {
  const { notifications } = await socialDb()
  await notifications.deleteOne({ userId: to.userId, event_key: eventKey(kind, to.profileId, key) })
}

/** Records how an inline action was answered: the row stops being pinned and shows the outcome. */
export async function settleNotificationAction(to: ProfileRef, action: { type: InboxActionType; id: string }, state: 'accepted' | 'declined'): Promise<void> {
  const { notifications } = await socialDb()
  await notifications.updateMany(
    { userId: to.userId, profileId: to.profileId, 'action.type': action.type, 'action.id': action.id },
    { $set: { 'action.state': state, read: true } },
  )
}
