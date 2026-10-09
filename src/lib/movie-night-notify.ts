// What a movie night tells people, through the one inbox (lib/notify.ts): invitations with
// Going / Can't, join requests with Approve / Decline, the host's news (joined, moved, cancelled),
// the film once it's chosen, and the reminders. Every key is unique per event, so a retry or a
// second cron run never sends the same thing twice (keys start with the night id: event keys are
// per recipient and kind, across all nights). Texts carry only names and TMDB titles
// (translated where they are read), never a date (it would be frozen in one language).
import 'server-only'
import { notify, retractNotification, settleNotificationAction } from '@/src/lib/notify'
import type { TKey } from '@/src/lib/i18n'
import type { NotificationKind, ProfileRef, ShareMedia } from '@/src/lib/social/types'

export const nightHref = (id: string) => `/movie-night/${id}`

type Send = {
  to: ProfileRef
  kind: Extract<NotificationKind, 'night_invite' | 'night_update' | 'night_reminder'>
  key: string
  text: TKey
  href: string
  actor?: { ref: ProfileRef; name: string } | null
  media?: ShareMedia | null
  action?: { type: 'night_invite' | 'night_join'; id: string }
  push?: boolean
}

/** One notification; failures are logged, never thrown (a night is saved even if a note is lost). */
async function send(i: Send) {
  // The inbox fills {name} from the actor and {title} from the media; the lock screen needs both here.
  const vars: Record<string, string> = {
    ...(i.actor ? { name: i.actor.name } : {}),
    ...(i.media ? { title: i.media.title } : {}),
  }
  try {
    await notify({
      to: i.to,
      kind: i.kind,
      key: i.key,
      href: i.href,
      text: { key: i.text, ...(Object.keys(vars).length ? { vars } : {}) },
      ...(i.actor ? { actor: i.actor.ref } : {}),
      ...(i.media ? { media: i.media } : {}),
      ...(i.action ? { action: i.action } : {}),
      push: i.push ? { topic: 'nights', title: { key: 'movieNight.push.title' }, body: { key: i.text, ...(Object.keys(vars).length ? { vars } : {}) } } : false,
    })
  } catch (error) {
    console.error(`movie night: notifying (${i.kind} ${i.text}) failed`, error)
  }
}

const sendAll = (recipients: ProfileRef[], make: (to: ProfileRef) => Send) => Promise.all(recipients.map((to) => send(make(to))))

/** "{name} invited you to a movie night", with Going / Can't right in the inbox. */
export const notifyInvited = (nightId: string, guest: ProfileRef, host: { ref: ProfileRef; name: string }) =>
  send({ to: guest, kind: 'night_invite', key: nightId, text: 'movieNight.inbox.invite', href: nightHref(nightId), actor: host, action: { type: 'night_invite', id: nightId }, push: true })

/** Takes an invitation back (removed from the night, or the night was cancelled before an answer). */
export async function retractInvite(nightId: string, guest: ProfileRef) {
  await retractNotification(guest, 'night_invite', nightId).catch((error) => console.error('movie night: retracting an invitation failed', error))
}

/** Marks the guest's own invitation row as answered (from the page, so the inbox agrees). */
export async function settleInvite(nightId: string, guest: ProfileRef, going: boolean) {
  await settleNotificationAction(guest, { type: 'night_invite', id: nightId }, going ? 'accepted' : 'declined').catch(() => undefined)
}

/** Someone with the link asks to join a night that has a place or a note: Approve / Decline for the host. */
export const notifyJoinRequest = (nightId: string, host: ProfileRef, guest: { ref: ProfileRef; name: string }) =>
  send({ to: host, kind: 'night_update', key: `${nightId}:join:${guest.ref.profileId}`, text: 'movieNight.inbox.request', href: nightHref(nightId), actor: guest, action: { type: 'night_join', id: `${nightId}:${guest.ref.profileId}` }, push: true })

/** The host's Approve / Decline row, answered from the page. */
export async function settleJoinRequest(nightId: string, host: ProfileRef, profileId: string, approved: boolean) {
  await settleNotificationAction(host, { type: 'night_join', id: `${nightId}:${profileId}` }, approved ? 'accepted' : 'declined').catch(() => undefined)
}

export const notifyJoined = (nightId: string, host: ProfileRef, guest: { ref: ProfileRef; name: string }) =>
  send({ to: host, kind: 'night_update', key: `${nightId}:join:${guest.ref.profileId}`, text: 'movieNight.inbox.joined', href: nightHref(nightId), actor: guest, push: true })

/** A guest's answer, for the host (quietly: no push for every RSVP). */
export const notifyRsvp = (nightId: string, host: ProfileRef, guest: { ref: ProfileRef; name: string }, going: boolean) =>
  send({ to: host, kind: 'night_update', key: `${nightId}:rsvp:${guest.ref.profileId}:${going ? 1 : 0}`, text: going ? 'movieNight.inbox.going' : 'movieNight.inbox.cant', href: nightHref(nightId), actor: guest })

export const notifyLeft = (nightId: string, host: ProfileRef, guest: { ref: ProfileRef; name: string }) =>
  send({ to: host, kind: 'night_update', key: `${nightId}:left:${guest.ref.profileId}:${Date.now()}`, text: 'movieNight.inbox.left', href: nightHref(nightId), actor: guest })

export const notifyApproved = (nightId: string, guest: ProfileRef, host: { ref: ProfileRef; name: string }) =>
  send({ to: guest, kind: 'night_update', key: `${nightId}:approved`, text: 'movieNight.inbox.approved', href: nightHref(nightId), actor: host, push: true })

/** The night moved to another time (once per change: the key carries the new version). */
export const notifyMoved = (nightId: string, recipients: ProfileRef[], host: { ref: ProfileRef; name: string }, version: number) =>
  sendAll(recipients, (to) => ({ to, kind: 'night_update', key: `${nightId}:moved:${version}`, text: 'movieNight.inbox.moved', href: nightHref(nightId), actor: host, push: true }))

/** Called off. Without a host (the account is gone) the row points at the nights page. */
export const notifyCancelled = (nightId: string, recipients: ProfileRef[], host: { ref: ProfileRef; name: string } | null) =>
  sendAll(recipients, (to) => ({
    to,
    kind: 'night_update',
    key: `${nightId}:cancelled`,
    text: host ? 'movieNight.inbox.cancelled' : 'movieNight.inbox.cancelledNoHost',
    href: host ? nightHref(nightId) : '/movie-night',
    actor: host,
    push: true,
  }))

/** "We're watching {title}", once per film per night, with the calendar one tap away. */
export const notifyChosen = (nightId: string, recipients: ProfileRef[], film: ShareMedia, cardKey: string, actor: { ref: ProfileRef; name: string } | null) =>
  sendAll(recipients, (to) => ({
    to,
    kind: 'night_update',
    key: `night:${nightId}:chosen:${cardKey}`,
    text: 'movieNight.inbox.chosen',
    href: `${nightHref(nightId)}#calendar`,
    media: film,
    actor,
    push: true,
  }))

/** A day before, then an hour before (the key carries the start, so a moved night reminds again). */
export const notifyReminder = (nightId: string, recipients: ProfileRef[], due: 'day' | 'hour', startsAt: Date, film: ShareMedia | null) =>
  sendAll(recipients, (to) => ({
    to,
    kind: 'night_reminder',
    key: `${nightId}:${due}:${startsAt.getTime()}`,
    text: due === 'day' ? 'movieNight.inbox.reminderDay' : 'movieNight.inbox.reminderHour',
    href: nightHref(nightId),
    media: film,
    push: true,
  }))
