// Movie nights: a date, friends who say Going or Can't, up to six films to vote on, and the film
// the night ends up watching (by vote, by a linked Swipe room, or by the host). The `movieNights`
// collection, what each person may see of a night, and every change, each one a single guarded
// update (the Mongo 5.9 driver: findOneAndUpdate answers {value}; claims check modifiedCount).
// The pure rules live in ./movie-night-rules.ts, the notifications in ./movie-night-notify.ts.
import 'server-only'
import { randomInt } from 'crypto'
import { ObjectId, type Collection, type Filter, type UpdateFilter } from 'mongodb'
import clientPromise from '@/src/lib/mongodb'
import { createInvite, consumeInvite, inviteStatus, readInvite, revokeInvites } from '@/src/lib/invites'
import { areFriends, isBlockedEitherWay } from '@/src/lib/social/friends'
import { avatarPerson, getIdentities, resolveHandle } from '@/src/lib/social/identity'
import { tmdbRecord } from '@/src/lib/social/media'
import { cleanUserText } from '@/src/lib/social/rules'
import { createRoom, type SwipeCard } from '@/src/lib/swipe'
import type { Locale } from '@/src/lib/i18n/locales'
import type { AvatarPerson, ProfileRef, ShareMedia } from '@/src/lib/social/types'
import {
  CANDIDATES_MAX, DEFAULT_TZ, GUESTS_MAX, HOST_PICKS_MAX, INVITE_USES, KEEP_AFTER_MS, NIGHT_LENGTH_MS, NIGHT_NOTE_MAX, PLACE_MAX, TITLE_MAX,
  UPCOMING_MAX, WATCH_AFTER_MS, accessFor, checkStart, checkVoteClose, defaultVoteClose, firstName, isCandidateKey, isNightId, isProfileKey,
  isTimeZone, joinNeedsApproval, mayVote, newNightId, parseCandidateKey, picksLeft, reminderDue, resolveDue, roleOf, tally, voteIsOpen,
  type ChosenBy, type GuestStatus, type NightRole,
} from './movie-night-rules'
import {
  notifyApproved, notifyCancelled, notifyChosen, notifyInvited, notifyJoinRequest, notifyJoined, notifyLeft, notifyMoved, notifyReminder,
  notifyRsvp, retractInvite, settleInvite, settleJoinRequest,
} from './movie-night-notify'

// ---------------------------------------------------------------------------------------------
// Documents

export type NightGuest = {
  ref: ProfileRef
  status: GuestStatus
  invited_at: Date
  responded_at: Date | null
  /** Invited by the host, or came through the link. */
  via: 'host' | 'link'
}

/** A film as the night shows it: read from TMDB on the server, never taken from a client. */
export type NightFilm = { key: string; media: ShareMedia; backdrop_path: string | null; year: string }
export type NightCandidate = NightFilm & { added_by: string | null; added_at: Date }
export type NightChosen = NightFilm & { room?: string | null }

export type NightDoc = {
  _id: string
  /** Goes up with every change a calendar should pick up (time, place, film, cancelled): the .ics SEQUENCE. */
  version: number
  /** Goes up with every change at all (votes, RSVPs too): what the page polls for. */
  rev: number
  host: ProfileRef
  title: string
  starts_at: Date
  ends_at: Date
  tz: string
  place: string
  note: string
  guests: NightGuest[]
  /** Profiles the host said no to (a declined request, a removed guest): the link won't let them back in. */
  declined: string[]
  candidates: NightCandidate[]
  /** profileId -> candidate key: one vote each, changeable until the vote closes. */
  votes: Record<string, string>
  /** profileId -> when that vote was cast (ties go to the first candidate to reach its count). */
  vote_at: Record<string, Date>
  vote_closes_at: Date
  vote_closed_at: Date | null
  chosen: NightChosen | null
  chosen_by: ChosenBy | null
  chosen_at: Date | null
  /** The linked Swipe room ('Pick together'). */
  room: { code: string; expires_at: Date } | null
  status: 'planned' | 'cancelled'
  cancelled_at: Date | null
  reminded: { day: boolean; hour: boolean }
  created_at: Date
  updated_at: Date
  /** ends_at + 14 days: the night goes away by itself (TTL). */
  expires_at: Date
}

let ready: Promise<unknown> | null = null

async function nights(): Promise<Collection<NightDoc>> {
  const db = (await clientPromise).db()
  const collection = db.collection<NightDoc>('movieNights')
  ready ??= Promise.all([
    collection.createIndex({ 'guests.ref.profileId': 1 }),
    collection.createIndex({ 'guests.ref.userId': 1 }),
    collection.createIndex({ 'host.profileId': 1, starts_at: -1 }),
    collection.createIndex({ 'host.userId': 1 }),
    collection.createIndex({ status: 1, starts_at: 1 }),
    collection.createIndex({ 'room.code': 1 }, { sparse: true }),
    collection.createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 }),
  ]).catch((error) => {
    ready = null
    console.error('Movie night indexes:', error)
  })
  await ready
  return collection
}

export async function getNight(id: string): Promise<NightDoc | null> {
  if (!isNightId(id)) return null
  return (await nights()).findOne({ _id: id })
}

const refOf = (ref: ProfileRef): ProfileRef => ({ userId: ref.userId, profileId: ref.profileId })

/** Who should hear about the night: the host and the guests in these states. */
function audience(night: NightDoc, statuses: GuestStatus[], withHost = true): ProfileRef[] {
  return [
    ...(withHost ? [night.host] : []),
    ...night.guests.filter((guest) => statuses.includes(guest.status)).map((guest) => guest.ref),
  ]
}

/** A person's name as notifications carry it (their page name, else their profile name). */
async function nameOf(ref: ProfileRef): Promise<string> {
  return (await avatarPerson(ref)).name
}

/** The film a TMDB key stands for, in the language of whoever adds it. Null when TMDB doesn't know it. */
async function filmFor(key: string, locale: Locale): Promise<NightFilm | null> {
  if (!isCandidateKey(key)) return null
  const { media_type, id } = parseCandidateKey(key)
  const data = await tmdbRecord(media_type, id, locale)
  if (!data) return null
  const title = String(data.title || data.name || data.original_title || data.original_name || '').trim()
  if (!title) return null
  const path = (value: unknown) => (typeof value === 'string' && /^\/[A-Za-z0-9._-]+$/.test(value) ? value : null)
  return {
    key: `${media_type}:${Number(id)}`,
    media: { media_type, id: String(Number(id)), title, poster_path: path(data.poster_path) },
    backdrop_path: path(data.backdrop_path),
    year: String(data.release_date || data.first_air_date || '').slice(0, 4),
  }
}

const filmFromCard = (card: SwipeCard): NightFilm => ({
  key: card.key,
  media: { media_type: card.media_type, id: String(card.id), title: card.title, poster_path: card.poster_path },
  backdrop_path: card.backdrop_path,
  year: card.year,
})

// ---------------------------------------------------------------------------------------------
// What a viewer sees

export type PersonView = AvatarPerson & { profileId: string }

export type CandidateView = NightFilm & {
  votes: number
  voters: PersonView[]
  mine: boolean
  /** Added by the viewer (a guest may take back their own suggestion). */
  addedByMe: boolean
}

export type NightView = {
  id: string
  access: 'member'
  role: Exclude<NightRole, null | 'requested'>
  title: string
  starts_at: string
  ends_at: string
  tz: string
  status: 'planned' | 'cancelled'
  version: number
  rev: number
  host: PersonView
  place: string
  note: string
  guests: (PersonView & { status: GuestStatus })[]
  goingCount: number
  candidates: CandidateView[]
  myVote: string | null
  vote: { open: boolean; closes_at: string; closed_at: string | null; total: number; voters: number }
  chosen: NightChosen | null
  chosen_by: ChosenBy | null
  room: { code: string } | null
  /** The host's view of the invitation link. */
  link: { active: boolean; uses: number; maxUses: number } | null
  can: { vote: boolean; suggest: number; edit: boolean; rsvp: boolean; pickTogether: boolean }
}

/** What someone outside sees: the date, the host's first name and the posters. Nothing else. */
export type NightPreview = {
  id: string
  access: 'preview'
  /** 'requested': waiting for the host's approval. */
  role: 'requested' | null
  starts_at: string
  tz: string
  status: 'planned' | 'cancelled'
  rev: number
  host: { name: string; color: string }
  posters: string[]
  /** The join will wait for approval (the night has a place or a note). */
  needsApproval: boolean
}

export type NightLoad =
  | { access: 'none' }
  | { access: 'preview'; doc: NightDoc; role: NightRole; view: NightPreview }
  | { access: 'member'; doc: NightDoc; role: NightRole; view: NightView }

async function memberView(night: NightDoc, role: Exclude<NightRole, null | 'requested'>, viewer: ProfileRef): Promise<NightView> {
  const isHost = role === 'host'
  const shownGuests = night.guests.filter((guest) => isHost || guest.status !== 'requested')
  const ids = [night.host.profileId, ...shownGuests.map((guest) => guest.ref.profileId), ...Object.keys(night.votes ?? {})]
  const identities = await getIdentities(ids)
  const people = new Map<string, PersonView>()
  const person = async (ref: ProfileRef): Promise<PersonView> => {
    const known = people.get(ref.profileId)
    if (known) return known
    const value = { ...(identities.get(ref.profileId) ?? (await avatarPerson(ref))), profileId: ref.profileId }
    people.set(ref.profileId, value)
    return value
  }
  const host = await person(night.host)
  const guests = await Promise.all(shownGuests.map(async (guest) => ({ ...(await person(guest.ref)), status: guest.status })))
  const members = new Map<string, ProfileRef>([[night.host.profileId, night.host], ...night.guests.map((guest) => [guest.ref.profileId, guest.ref] as const)])
  const votes = Object.fromEntries(Object.entries(night.votes ?? {}).filter(([profileId]) => members.has(profileId)))
  const { counts } = tally(night.candidates, votes, night.vote_at ?? {}, night.host.profileId)
  const candidates = await Promise.all(night.candidates.map(async (candidate) => {
    const voterIds = Object.entries(votes).filter(([, key]) => key === candidate.key).map(([profileId]) => profileId)
    return {
      key: candidate.key,
      media: candidate.media,
      backdrop_path: candidate.backdrop_path,
      year: candidate.year,
      votes: counts[candidate.key] ?? 0,
      voters: await Promise.all(voterIds.map((profileId) => person(members.get(profileId)!))),
      mine: votes[viewer.profileId] === candidate.key,
      addedByMe: candidate.added_by === viewer.profileId,
    }
  }))
  const now = new Date()
  const open = voteIsOpen(night, now)
  const planned = night.status === 'planned'
  const live = planned && now.getTime() < new Date(night.starts_at).getTime() + WATCH_AFTER_MS
  const link = isHost ? await inviteStatus('night', night._id) : null
  const myVote = votes[viewer.profileId] ?? null
  return {
    id: night._id,
    access: 'member',
    role,
    title: night.title,
    starts_at: night.starts_at.toISOString(),
    ends_at: night.ends_at.toISOString(),
    tz: night.tz,
    status: night.status,
    version: night.version,
    rev: night.rev,
    host,
    place: night.place,
    note: night.note,
    guests,
    goingCount: 1 + night.guests.filter((guest) => guest.status === 'going').length,
    candidates,
    myVote: night.candidates.some((candidate) => candidate.key === myVote) ? myVote : null,
    vote: {
      open,
      closes_at: night.vote_closes_at.toISOString(),
      closed_at: night.vote_closed_at ? night.vote_closed_at.toISOString() : null,
      total: Object.values(votes).filter((key) => key in counts).length,
      voters: [night.host, ...night.guests.filter((guest) => mayVote(guest.status)).map((guest) => guest.ref)].length,
    },
    chosen: night.chosen,
    chosen_by: night.chosen_by,
    room: night.room && new Date(night.room.expires_at).getTime() > now.getTime() ? { code: night.room.code } : null,
    link: link ? { active: link.active, uses: link.uses, maxUses: link.maxUses } : null,
    can: {
      vote: open && mayVote(role),
      suggest: open && mayVote(role) ? picksLeft(night.candidates, viewer.profileId, isHost) : 0,
      edit: isHost && live,
      rsvp: !isHost && live,
      pickTogether: live && !night.chosen && mayVote(role),
    },
  }
}

async function previewView(night: NightDoc, role: 'requested' | null): Promise<NightPreview> {
  const host = await avatarPerson(night.host)
  const posters = (night.chosen ? [night.chosen.media.poster_path] : night.candidates.map((candidate) => candidate.media.poster_path))
    .filter((path): path is string => !!path)
    .slice(0, 3)
  return {
    id: night._id,
    access: 'preview',
    role,
    starts_at: night.starts_at.toISOString(),
    tz: night.tz,
    status: night.status,
    rev: night.rev,
    host: { name: firstName(host.name), color: host.color },
    posters,
    needsApproval: joinNeedsApproval(night),
  }
}

/** Whether an invitation link for this night still lets someone in. */
async function tokenWorks(nightId: string, token: string | null | undefined): Promise<boolean> {
  if (!token) return false
  const invite = await readInvite('night', token).catch(() => null)
  return !!invite && invite.targetId === nightId && invite.uses < invite.maxUses
}

/**
 * A night as this viewer may see it: all of it (members), a preview (someone waiting for approval,
 * or holding a working link), or nothing (everyone else: the page answers 404). A vote that is due
 * is resolved on the way (lazily: the first read after the close time does it, once).
 */
export async function loadNight(id: string, viewer: ProfileRef | null, opts: { token?: string | null } = {}): Promise<NightLoad> {
  let doc = await getNight(id)
  if (!doc) return { access: 'none' }
  if (resolveDue(doc, new Date())) {
    await resolveVote(doc)
    doc = (await getNight(id)) ?? doc
  }
  const role = roleOf(doc, viewer?.profileId)
  let works = false
  if (!role && opts.token) {
    works = await tokenWorks(id, opts.token)
    // Someone blocked by (or blocking) the host never gets a preview through a link.
    if (works && viewer && (await isBlockedEitherWay(viewer, doc.host))) works = false
  }
  const access = accessFor(role, works)
  if (access === 'none') return { access: 'none' }
  if (access === 'preview') return { access, doc, role, view: await previewView(doc, role === 'requested' ? 'requested' : null) }
  return { access, doc, role, view: await memberView(doc, role as Exclude<NightRole, null | 'requested'>, viewer!) }
}

// ---------------------------------------------------------------------------------------------
// Lists

export type NightSummary = {
  id: string
  /** '' for a preview (someone waiting for approval sees no title). */
  title: string
  starts_at: string
  tz: string
  status: 'planned' | 'cancelled'
  role: Exclude<NightRole, null>
  host: AvatarPerson
  going: AvatarPerson[]
  goingCount: number
  posters: string[]
  film: ShareMedia | null
  candidateCount: number
  href: string
}

async function summaries(docs: NightDoc[], viewer: ProfileRef): Promise<NightSummary[]> {
  const ids = docs.flatMap((night) => [night.host.profileId, ...night.guests.filter((guest) => guest.status === 'going').map((guest) => guest.ref.profileId)])
  const identities = await getIdentities(ids)
  const person = async (ref: ProfileRef) => identities.get(ref.profileId) ?? (await avatarPerson(ref))
  return Promise.all(docs.map(async (night) => {
    const role = roleOf(night, viewer.profileId) ?? 'invited'
    const waiting = role === 'requested'
    const going = night.guests.filter((guest) => guest.status === 'going')
    const host = await person(night.host)
    return {
      id: night._id,
      title: waiting ? '' : night.title,
      starts_at: night.starts_at.toISOString(),
      tz: night.tz,
      status: night.status,
      role,
      host: waiting ? { name: firstName(host.name), color: host.color, image: null, handle: null } : host,
      going: waiting ? [] : await Promise.all(going.slice(0, 3).map((guest) => person(guest.ref))),
      goingCount: waiting ? 0 : 1 + going.length,
      posters: (night.chosen ? [night.chosen.media.poster_path] : night.candidates.map((candidate) => candidate.media.poster_path))
        .filter((path): path is string => !!path).slice(0, 3),
      film: night.chosen?.media ?? null,
      candidateCount: night.candidates.length,
      href: `/movie-night/${night._id}`,
    }
  }))
}

const mine = (ref: ProfileRef): Filter<NightDoc> => ({ $or: [{ 'host.profileId': ref.profileId }, { 'guests.ref.profileId': ref.profileId }] })

/**
 * The viewer's nights still to come (host or guest, not ones they said they can't make), soonest
 * first. `within`: only those starting in the next N days.
 */
export async function listMyNights(ref: ProfileRef, o: { within?: number } = {}): Promise<NightSummary[]> {
  const now = Date.now()
  const docs = await (await nights()).find({
    ...mine(ref),
    status: 'planned',
    starts_at: { $gt: new Date(now - WATCH_AFTER_MS), ...(o.within ? { $lte: new Date(now + o.within * 86400000) } : {}) },
  }).sort({ starts_at: 1 }).limit(20).toArray()
  const kept = docs.filter((night) => roleOf(night, ref.profileId) !== 'cant')
  return summaries(kept, ref)
}

/** The /movie-night page: what's coming (cancelled ones included, so nobody turns up), then the last two weeks. */
export async function listNightsPage(ref: ProfileRef): Promise<{ upcoming: NightSummary[]; past: NightSummary[] }> {
  const now = Date.now()
  const docs = await (await nights()).find({ ...mine(ref), starts_at: { $gt: new Date(now - KEEP_AFTER_MS) } }).sort({ starts_at: 1 }).limit(60).toArray()
  const isUpcoming = (night: NightDoc) => new Date(night.starts_at).getTime() + WATCH_AFTER_MS > now
  const upcoming = docs.filter(isUpcoming)
  const past = docs.filter((night) => !isUpcoming(night) && night.status === 'planned').reverse()
  const [a, b] = await Promise.all([summaries(upcoming, ref), summaries(past, ref)])
  return { upcoming: a, past: b }
}

// ---------------------------------------------------------------------------------------------
// Changes. Every function answers { ok: true, ... } or { error: code, status }.

export type Fail = { error: string; status: number }
const fail = (status: number, error: string): Fail => ({ error, status })

const cleanTitle = (value: unknown) => cleanUserText(value, TITLE_MAX)
const cleanPlace = (value: unknown) => cleanUserText(value, PLACE_MAX)
const cleanNightNote = (value: unknown) => cleanUserText(value, NIGHT_NOTE_MAX)

function parseDate(value: unknown): Date | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const touch = (extra: Record<string, unknown> = {}) => ({ $set: { updated_at: new Date(), ...extra }, $inc: { rev: 1 } })

export type CreateInput = {
  title?: unknown
  starts_at?: unknown
  tz?: unknown
  place?: unknown
  note?: unknown
  candidates?: unknown
  invite?: unknown
  vote_closes_at?: unknown
}

/** A new night, its host's picks read from TMDB, and invitations to the friends picked. */
export async function createNight(host: ProfileRef, input: CreateInput, locale: Locale): Promise<{ ok: true; id: string; sent: string[]; skipped: string[] } | Fail> {
  const now = new Date()
  const startsAt = parseDate(input.starts_at)
  if (!startsAt) return fail(400, 'invalid')
  const problem = checkStart(startsAt, now)
  if (problem) return fail(400, problem)
  const tz = isTimeZone(input.tz) ? input.tz : DEFAULT_TZ
  const closes = input.vote_closes_at ? checkVoteClose(parseDate(input.vote_closes_at) ?? NaN, startsAt, now) : defaultVoteClose(startsAt, now)
  if (!closes) return fail(400, 'vote_close')

  const collection = await nights()
  const upcoming = await collection.countDocuments({ 'host.profileId': host.profileId, status: 'planned', starts_at: { $gt: now } })
  if (upcoming >= UPCOMING_MAX) return fail(409, 'limit')

  const keys = Array.isArray(input.candidates) ? Array.from(new Set(input.candidates.filter(isCandidateKey))).slice(0, HOST_PICKS_MAX) : []
  const films = (await Promise.all(keys.map((key) => filmFor(key, locale)))).filter((film): film is NightFilm => !!film)
  const endsAt = new Date(startsAt.getTime() + NIGHT_LENGTH_MS)
  const base: Omit<NightDoc, '_id'> = {
    version: 1,
    rev: 1,
    host: refOf(host),
    title: cleanTitle(input.title),
    starts_at: startsAt,
    ends_at: endsAt,
    tz,
    place: cleanPlace(input.place),
    note: cleanNightNote(input.note),
    guests: [],
    declined: [],
    candidates: films.map((film) => ({ ...film, added_by: host.profileId, added_at: now })),
    votes: {},
    vote_at: {},
    vote_closes_at: closes,
    vote_closed_at: null,
    chosen: null,
    chosen_by: null,
    chosen_at: null,
    room: null,
    status: 'planned',
    cancelled_at: null,
    reminded: { day: false, hour: false },
    created_at: now,
    updated_at: now,
    expires_at: new Date(endsAt.getTime() + KEEP_AFTER_MS),
  }
  let id = ''
  for (let attempt = 0; attempt < 5 && !id; attempt++) {
    const candidate = newNightId(randomInt)
    try {
      await collection.insertOne({ _id: candidate, ...base })
      id = candidate
    } catch (error) {
      if ((error as { code?: number })?.code !== 11000) throw error
    }
  }
  if (!id) return fail(500, 'failed')
  const handles = Array.isArray(input.invite) ? input.invite : []
  const result = handles.length ? await inviteFriends(id, host, handles) : { sent: [], skipped: [] }
  return { ok: true, id, sent: 'error' in result ? [] : result.sent, skipped: 'error' in result ? [] : result.skipped }
}

/** Invites friends by handle (host only): friends, not blocked with anyone in the night, 20 guests at most. */
export async function inviteFriends(id: string, host: ProfileRef, handles: unknown[]): Promise<{ ok: true; sent: string[]; skipped: string[] } | Fail> {
  const collection = await nights()
  const night = await collection.findOne({ _id: id })
  if (!night) return fail(404, 'not_found')
  if (night.host.profileId !== host.profileId) return fail(403, 'not_host')
  if (night.status !== 'planned') return fail(409, 'cancelled')
  const wanted = Array.from(new Set(handles.filter((handle): handle is string => typeof handle === 'string').map((handle) => handle.trim().toLowerCase().replace(/^@/, '')))).slice(0, GUESTS_MAX)
  const sent: string[] = []
  const skipped: string[] = []
  const hostName = await nameOf(host)
  for (const handle of wanted) {
    const target = await resolveHandle(handle).catch(() => null)
    const ref = target ? { userId: target.userId, profileId: target.profileId } : null
    if (!target || !ref || ref.profileId === host.profileId || !(await areFriends(host.profileId, ref.profileId))) { skipped.push(handle); continue }
    const current = await collection.findOne({ _id: id }, { projection: { guests: 1 } })
    if (current?.guests.some((guest) => guest.ref.profileId === ref.profileId)) { skipped.push(handle); continue }
    const blocked = await Promise.all((current?.guests ?? []).map((guest) => isBlockedEitherWay(ref, guest.ref)))
    if (blocked.some(Boolean)) { skipped.push(handle); continue }
    const guest: NightGuest = { ref, status: 'invited', invited_at: new Date(), responded_at: null, via: 'host' }
    const result = await collection.updateOne(
      { _id: id, status: 'planned', 'guests.ref.profileId': { $ne: ref.profileId }, [`guests.${GUESTS_MAX - 1}`]: { $exists: false } },
      { $push: { guests: guest }, $pull: { declined: ref.profileId }, ...touch() } as UpdateFilter<NightDoc>,
    )
    if (result.modifiedCount !== 1) { skipped.push(handle); continue }
    await notifyInvited(id, ref, { ref: host, name: hostName })
    sent.push(target.identity.handle)
  }
  return { ok: true, sent, skipped }
}

/** Going or Can't (a guest who was invited, or already answered). Settles their inbox row too. */
export async function rsvp(night: NightDoc, ref: ProfileRef, going: boolean): Promise<{ ok: true; status: GuestStatus } | Fail> {
  const role = roleOf(night, ref.profileId)
  if (role === 'host') return fail(409, 'host')
  if (role !== 'invited' && role !== 'going' && role !== 'cant') return fail(404, 'not_found')
  if (night.status !== 'planned') return fail(409, 'cancelled')
  const status: GuestStatus = going ? 'going' : 'cant'
  const result = await (await nights()).updateOne(
    { _id: night._id, status: 'planned', guests: { $elemMatch: { 'ref.profileId': ref.profileId, status: { $in: ['invited', 'going', 'cant'] } } } },
    {
      $set: { 'guests.$.status': status, 'guests.$.responded_at': new Date(), updated_at: new Date() },
      // Someone who can't come doesn't pick the film.
      ...(going ? {} : { $unset: { [`votes.${ref.profileId}`]: '', [`vote_at.${ref.profileId}`]: '' } }),
      $inc: { rev: 1 },
    } as UpdateFilter<NightDoc>,
  )
  if (result.matchedCount !== 1) return fail(409, 'invalid')
  await settleInvite(night._id, ref, going)
  if (role !== status) await notifyRsvp(night._id, night.host, { ref, name: await nameOf(ref) }, going)
  return { ok: true, status }
}

/**
 * Joining through the invitation link. Checked before the link is used: not already in, not
 * turned away, nobody blocked, room left. With a place or a note the join waits for the host.
 */
export async function joinWithLink(id: string, ref: ProfileRef, token: unknown): Promise<{ ok: true; status: GuestStatus } | Fail> {
  if (typeof token !== 'string') return fail(400, 'invalid')
  const collection = await nights()
  const night = await collection.findOne({ _id: id })
  if (!night) return fail(404, 'not_found')
  const role = roleOf(night, ref.profileId)
  if (role === 'host') return fail(409, 'host')
  if (role) return { ok: true, status: role }
  if (night.status !== 'planned') return fail(410, 'cancelled')
  if (Date.now() > new Date(night.starts_at).getTime() + WATCH_AFTER_MS) return fail(410, 'expired')
  if (night.declined.includes(ref.profileId)) return fail(403, 'declined')
  const people = [night.host, ...night.guests.map((guest) => guest.ref)]
  if ((await Promise.all(people.map((person) => isBlockedEitherWay(ref, person)))).some(Boolean)) return fail(403, 'blocked')
  if (night.guests.length >= GUESTS_MAX) return fail(409, 'full')
  const used = await consumeInvite('night', token)
  if ('reason' in used) return fail(410, used.reason)
  if (used.targetId !== id) return fail(410, 'invalid')
  const status: GuestStatus = joinNeedsApproval(night) ? 'requested' : 'going'
  const guest: NightGuest = { ref: refOf(ref), status, invited_at: new Date(), responded_at: status === 'going' ? new Date() : null, via: 'link' }
  const result = await collection.updateOne(
    { _id: id, status: 'planned', 'guests.ref.profileId': { $ne: ref.profileId }, declined: { $ne: ref.profileId }, [`guests.${GUESTS_MAX - 1}`]: { $exists: false } },
    { $push: { guests: guest }, ...touch() } as UpdateFilter<NightDoc>,
  )
  if (result.modifiedCount !== 1) {
    const again = await collection.findOne({ _id: id }, { projection: { guests: 1, host: 1 } })
    const now = again ? roleOf(again as NightDoc, ref.profileId) : null
    return now && now !== 'host' ? { ok: true, status: now } : fail(409, 'full')
  }
  const me = { ref: refOf(ref), name: await nameOf(ref) }
  if (status === 'requested') await notifyJoinRequest(id, night.host, me)
  else await notifyJoined(id, night.host, me)
  return { ok: true, status }
}

/** The host answers a join request. A no is never announced (and the link won't let them back). */
export async function approveRequest(night: NightDoc, host: ProfileRef, profileId: unknown, approve: boolean): Promise<{ ok: true } | Fail> {
  if (night.host.profileId !== host.profileId) return fail(403, 'not_host')
  if (!isProfileKey(profileId)) return fail(400, 'invalid')
  const guest = night.guests.find((entry) => entry.ref.profileId === profileId)
  if (!guest || guest.status !== 'requested') {
    await settleJoinRequest(night._id, host, profileId, approve)
    return fail(409, 'already')
  }
  const collection = await nights()
  const result = approve
    ? await collection.updateOne(
      { _id: night._id, guests: { $elemMatch: { 'ref.profileId': profileId, status: 'requested' } } },
      { $set: { 'guests.$.status': 'going', 'guests.$.responded_at': new Date(), updated_at: new Date() }, $inc: { rev: 1 } } as UpdateFilter<NightDoc>,
    )
    : await collection.updateOne(
      { _id: night._id, guests: { $elemMatch: { 'ref.profileId': profileId, status: 'requested' } } },
      { $pull: { guests: { 'ref.profileId': profileId } }, $addToSet: { declined: profileId }, ...touch() } as UpdateFilter<NightDoc>,
    )
  await settleJoinRequest(night._id, host, profileId, approve)
  if (result.modifiedCount !== 1) return fail(409, 'already')
  if (approve) await notifyApproved(night._id, guest.ref, { ref: host, name: await nameOf(host) })
  return { ok: true }
}

/** The host takes someone off the night (quietly). The link won't let them back in. */
export async function removeGuest(night: NightDoc, host: ProfileRef, profileId: unknown): Promise<{ ok: true } | Fail> {
  if (night.host.profileId !== host.profileId) return fail(403, 'not_host')
  if (!isProfileKey(profileId)) return fail(400, 'invalid')
  const guest = night.guests.find((entry) => entry.ref.profileId === profileId)
  if (!guest) return fail(404, 'not_found')
  await (await nights()).updateOne(
    { _id: night._id },
    { $pull: { guests: { 'ref.profileId': profileId } }, $addToSet: { declined: profileId }, $unset: { [`votes.${profileId}`]: '', [`vote_at.${profileId}`]: '' }, ...touch() } as UpdateFilter<NightDoc>,
  )
  if (guest.status === 'invited') await retractInvite(night._id, guest.ref)
  if (guest.status === 'requested') await settleJoinRequest(night._id, host, profileId, false)
  return { ok: true }
}

/** A guest steps out of the night. The host hears about it if they had said Going. */
export async function leaveNight(night: NightDoc, ref: ProfileRef): Promise<{ ok: true } | Fail> {
  const guest = night.guests.find((entry) => entry.ref.profileId === ref.profileId)
  if (!guest) return fail(night.host.profileId === ref.profileId ? 409 : 404, night.host.profileId === ref.profileId ? 'host' : 'not_found')
  await (await nights()).updateOne(
    { _id: night._id },
    { $pull: { guests: { 'ref.profileId': ref.profileId } }, $unset: { [`votes.${ref.profileId}`]: '', [`vote_at.${ref.profileId}`]: '' }, ...touch() } as UpdateFilter<NightDoc>,
  )
  if (guest.status === 'invited') await settleInvite(night._id, ref, false)
  if (guest.status === 'requested') await settleJoinRequest(night._id, night.host, ref.profileId, false)
  if (guest.status === 'going' && night.status === 'planned') await notifyLeft(night._id, night.host, { ref, name: await nameOf(ref) })
  return { ok: true }
}

/** A film to vote on: the host up to three, each guest one, six in all, while the vote is open. */
export async function addCandidate(night: NightDoc, ref: ProfileRef, key: unknown, locale: Locale): Promise<{ ok: true } | Fail> {
  const role = roleOf(night, ref.profileId)
  if (!mayVote(role)) return fail(403, 'not_member')
  if (!isCandidateKey(key)) return fail(400, 'invalid')
  if (!voteIsOpen(night, new Date())) return fail(409, 'vote_closed')
  if (night.candidates.some((candidate) => candidate.key === key)) return fail(409, 'already')
  if (picksLeft(night.candidates, ref.profileId, role === 'host') <= 0) return fail(409, 'picks_full')
  const film = await filmFor(key, locale)
  if (!film) return fail(404, 'not_found')
  const now = new Date()
  const result = await (await nights()).updateOne(
    { _id: night._id, status: 'planned', chosen: null, vote_closed_at: null, vote_closes_at: { $gt: now }, 'candidates.key': { $ne: film.key }, [`candidates.${CANDIDATES_MAX - 1}`]: { $exists: false } },
    { $push: { candidates: { ...film, added_by: ref.profileId, added_at: now } }, ...touch() } as UpdateFilter<NightDoc>,
  )
  return result.modifiedCount === 1 ? { ok: true } : fail(409, 'picks_full')
}

/** Takes a film off the ballot (the host any, a guest their own); its votes go with it. */
export async function removeCandidate(night: NightDoc, ref: ProfileRef, key: unknown): Promise<{ ok: true } | Fail> {
  const candidate = night.candidates.find((entry) => entry.key === key)
  if (!candidate) return fail(404, 'not_found')
  const isHost = night.host.profileId === ref.profileId
  if (!isHost && candidate.added_by !== ref.profileId) return fail(403, 'not_host')
  if (night.chosen) return fail(409, 'chosen')
  const voters = Object.entries(night.votes ?? {}).filter(([, value]) => value === candidate.key).map(([profileId]) => profileId)
  const unset = Object.fromEntries(voters.flatMap((profileId) => [[`votes.${profileId}`, ''], [`vote_at.${profileId}`, '']]))
  await (await nights()).updateOne(
    { _id: night._id, chosen: null },
    { $pull: { candidates: { key: candidate.key } }, ...(voters.length ? { $unset: unset } : {}), ...touch() } as UpdateFilter<NightDoc>,
  )
  return { ok: true }
}

/** One vote (or none: key null), changed freely while the vote is open. */
export async function castVote(night: NightDoc, ref: ProfileRef, key: unknown): Promise<{ ok: true } | Fail> {
  if (!mayVote(roleOf(night, ref.profileId))) return fail(403, 'not_member')
  if (key !== null && !night.candidates.some((candidate) => candidate.key === key)) return fail(400, 'not_candidate')
  const now = new Date()
  const filter: Filter<NightDoc> = { _id: night._id, status: 'planned', chosen: null, vote_closed_at: null, vote_closes_at: { $gt: now }, ...(key ? { 'candidates.key': key as string } : {}) }
  const update = key
    ? { $set: { [`votes.${ref.profileId}`]: key, [`vote_at.${ref.profileId}`]: now, updated_at: now }, $inc: { rev: 1 } }
    : { $unset: { [`votes.${ref.profileId}`]: '', [`vote_at.${ref.profileId}`]: '' }, $set: { updated_at: now }, $inc: { rev: 1 } }
  const result = await (await nights()).updateOne(filter, update as UpdateFilter<NightDoc>)
  return result.matchedCount === 1 ? { ok: true } : fail(409, 'vote_closed')
}

/** The host closes the vote now; the result comes out at once. */
export async function closeVote(night: NightDoc, host: ProfileRef): Promise<{ ok: true } | Fail> {
  if (night.host.profileId !== host.profileId) return fail(403, 'not_host')
  if (night.candidates.length === 0) return fail(409, 'no_candidates')
  const result = await (await nights()).updateOne(
    { _id: night._id, status: 'planned', chosen: null, vote_closed_at: null },
    { $set: { vote_closed_at: new Date(), updated_at: new Date() }, $inc: { rev: 1 } } as UpdateFilter<NightDoc>,
  )
  if (result.modifiedCount !== 1) return fail(409, 'vote_closed')
  const fresh = await getNight(night._id)
  if (fresh) await resolveVote(fresh)
  return { ok: true }
}

/**
 * The vote's result becomes the film, once: the write is guarded on `chosen: null`, so a second
 * read, a cron run or a Swipe match at the same moment can't choose again. Only the write that
 * won tells everyone.
 */
export async function resolveVote(night: NightDoc): Promise<boolean> {
  if (!resolveDue(night, new Date())) return false
  const members = new Set([night.host.profileId, ...night.guests.filter((guest) => mayVote(guest.status)).map((guest) => guest.ref.profileId)])
  const votes = Object.fromEntries(Object.entries(night.votes ?? {}).filter(([profileId]) => members.has(profileId)))
  const { winner } = tally(night.candidates, votes, night.vote_at ?? {}, night.host.profileId)
  const film = night.candidates.find((candidate) => candidate.key === winner)
  if (!film) return false
  const now = new Date()
  const chosen: NightChosen = { key: film.key, media: film.media, backdrop_path: film.backdrop_path, year: film.year, room: null }
  const result = await (await nights()).updateOne(
    { _id: night._id, status: 'planned', chosen: null },
    { $set: { chosen, chosen_by: 'vote', chosen_at: now, vote_closed_at: night.vote_closed_at ?? now, updated_at: now }, $inc: { version: 1, rev: 1 } } as UpdateFilter<NightDoc>,
  )
  if (result.modifiedCount !== 1) return false
  await notifyChosen(night._id, audience(night, ['going']), film.media, film.key, null)
  return true
}

/** The host picks the film themselves (it can replace a vote's or a match's). */
export async function chooseFilm(night: NightDoc, host: ProfileRef, key: unknown): Promise<{ ok: true } | Fail> {
  if (night.host.profileId !== host.profileId) return fail(403, 'not_host')
  if (night.status !== 'planned') return fail(409, 'cancelled')
  const film = night.candidates.find((candidate) => candidate.key === key)
  if (!film) return fail(400, 'not_candidate')
  if (night.chosen?.key === film.key) return { ok: true }
  const now = new Date()
  const chosen: NightChosen = { key: film.key, media: film.media, backdrop_path: film.backdrop_path, year: film.year, room: null }
  await (await nights()).updateOne(
    { _id: night._id, status: 'planned' },
    { $set: { chosen, chosen_by: 'host', chosen_at: now, vote_closed_at: night.vote_closed_at ?? now, updated_at: now }, $inc: { version: 1, rev: 1 } } as UpdateFilter<NightDoc>,
  )
  await notifyChosen(night._id, audience(night, ['going'], false), film.media, film.key, { ref: host, name: await nameOf(host) })
  return { ok: true }
}

/**
 * A linked Swipe room found its match (called once per match, by the vote that wrote it). The film
 * is set only when nothing is chosen yet, or when this same room chose it earlier (a new deck):
 * never over the host's pick or the vote's result.
 */
export async function setChosenFromRoom(nightId: string, code: string, card: SwipeCard): Promise<boolean> {
  if (!isNightId(nightId)) return false
  const film = filmFromCard(card)
  const now = new Date()
  const collection = await nights()
  const result = await collection.updateOne(
    {
      _id: nightId,
      status: 'planned',
      'room.code': code,
      'chosen.key': { $ne: film.key },
      $or: [{ chosen: null }, { chosen_by: 'swipe', 'chosen.room': code }],
    },
    { $set: { chosen: { ...film, room: code }, chosen_by: 'swipe', chosen_at: now, vote_closed_at: now, updated_at: now }, $inc: { version: 1, rev: 1 } } as UpdateFilter<NightDoc>,
  )
  if (result.modifiedCount !== 1) return false
  const night = await collection.findOne({ _id: nightId })
  if (night) await notifyChosen(nightId, audience(night, ['going']), film.media, film.key, null)
  return true
}

/**
 * 'Pick together': the night's Swipe room, made on first use (its deck starts with the night's
 * films). Answers the room code, plus the caller's room credentials when they just made it.
 */
export async function openRoom(night: NightDoc, ref: ProfileRef, name: string, locale: Locale): Promise<{ ok: true; code: string; participant?: { id: string; secret: string } } | Fail> {
  if (!mayVote(roleOf(night, ref.profileId))) return fail(403, 'not_member')
  if (night.status !== 'planned') return fail(409, 'cancelled')
  if (night.chosen) return fail(409, 'chosen')
  const now = new Date()
  if (night.room && new Date(night.room.expires_at).getTime() > now.getTime()) return { ok: true, code: night.room.code }
  const room = await createRoom({
    kind: 'both', genre: null, kids: false, locale, name: name || 'Host',
    seed: night.candidates.map((candidate) => candidate.key),
    night: { id: night._id, title: night.title },
  })
  if (!room) return fail(502, 'failed')
  const collection = await nights()
  const result = await collection.updateOne(
    { _id: night._id, $or: [{ room: null }, { 'room.expires_at': { $lte: now } }] },
    { $set: { room: { code: room.code, expires_at: new Date(now.getTime() + 24 * 3600 * 1000) }, updated_at: now }, $inc: { rev: 1 } } as UpdateFilter<NightDoc>,
  )
  if (result.modifiedCount !== 1) {
    // Someone else opened one a moment ago: everyone goes to theirs.
    const current = await collection.findOne({ _id: night._id }, { projection: { room: 1 } })
    if (current?.room) return { ok: true, code: current.room.code }
  }
  return { ok: true, code: room.code, participant: room.participant }
}

/** The invitation link (host only): until the night is over, 20 joins. Earlier links keep working until turned off. */
export async function makeLink(night: NightDoc, host: ProfileRef): Promise<{ ok: true; token: string; uses: number; maxUses: number } | Fail> {
  if (night.host.profileId !== host.profileId) return fail(403, 'not_host')
  if (night.status !== 'planned') return fail(409, 'cancelled')
  const until = new Date(new Date(night.starts_at).getTime() + WATCH_AFTER_MS)
  if (until.getTime() <= Date.now()) return fail(410, 'expired')
  const { token } = await createInvite({ kind: 'night', targetId: night._id, owner: refOf(host), expiresAt: until, maxUses: INVITE_USES })
  return { ok: true, token, uses: 0, maxUses: INVITE_USES }
}

export async function turnOffLink(night: NightDoc, host: ProfileRef): Promise<{ ok: true } | Fail> {
  if (night.host.profileId !== host.profileId) return fail(403, 'not_host')
  await revokeInvites('night', night._id)
  return { ok: true }
}

export type EditInput = { title?: unknown; starts_at?: unknown; tz?: unknown; place?: unknown; note?: unknown; vote_closes_at?: unknown }

/** The host changes the night. A new time tells everyone (and the calendars, through SEQUENCE). */
export async function editNight(night: NightDoc, host: ProfileRef, input: EditInput): Promise<{ ok: true } | Fail> {
  if (night.host.profileId !== host.profileId) return fail(403, 'not_host')
  if (night.status !== 'planned') return fail(409, 'cancelled')
  const now = new Date()
  const set: Partial<NightDoc> = {}
  let moved = false
  if (input.title !== undefined) set.title = cleanTitle(input.title)
  if (input.place !== undefined) set.place = cleanPlace(input.place)
  if (input.note !== undefined) set.note = cleanNightNote(input.note)
  if (input.tz !== undefined && isTimeZone(input.tz)) set.tz = input.tz
  let startsAt = new Date(night.starts_at)
  if (input.starts_at !== undefined) {
    const next = parseDate(input.starts_at)
    if (!next) return fail(400, 'invalid')
    if (next.getTime() !== startsAt.getTime()) {
      const problem = checkStart(next, now)
      if (problem) return fail(400, problem)
      startsAt = next
      moved = true
      set.starts_at = next
      set.ends_at = new Date(next.getTime() + NIGHT_LENGTH_MS)
      set.expires_at = new Date(next.getTime() + NIGHT_LENGTH_MS + KEEP_AFTER_MS)
      set.reminded = { day: false, hour: false }
    }
  }
  if (voteIsOpen(night, now)) {
    if (input.vote_closes_at !== undefined) {
      const close = checkVoteClose(parseDate(input.vote_closes_at) ?? NaN, startsAt, now)
      if (!close) return fail(400, 'vote_close')
      set.vote_closes_at = close
    } else if (moved && night.vote_closes_at.getTime() > startsAt.getTime()) {
      set.vote_closes_at = defaultVoteClose(startsAt, now)
    }
  }
  const visible = moved || ['title', 'place', 'note', 'tz'].some((field) => field in set && (set as Record<string, unknown>)[field] !== (night as unknown as Record<string, unknown>)[field])
  if (Object.keys(set).length === 0) return { ok: true }
  await (await nights()).updateOne(
    { _id: night._id, status: 'planned' },
    { $set: { ...set, updated_at: now }, $inc: { rev: 1, ...(visible ? { version: 1 } : {}) } } as UpdateFilter<NightDoc>,
  )
  if (moved) await notifyMoved(night._id, audience(night, ['going', 'invited'], false), { ref: host, name: await nameOf(host) }, night.version + 1)
  return { ok: true }
}

/** Called off: everyone hears, the link stops working, open invitations disappear from inboxes. */
export async function cancelNight(night: NightDoc, host: ProfileRef | null): Promise<{ ok: true } | Fail> {
  if (host && night.host.profileId !== host.profileId) return fail(403, 'not_host')
  if (night.status !== 'planned') return { ok: true }
  const now = new Date()
  const result = await (await nights()).updateOne(
    { _id: night._id, status: 'planned' },
    { $set: { status: 'cancelled', cancelled_at: now, updated_at: now }, $inc: { version: 1, rev: 1 } } as UpdateFilter<NightDoc>,
  )
  if (result.modifiedCount !== 1) return { ok: true }
  await revokeInvites('night', night._id).catch(() => undefined)
  for (const guest of night.guests) {
    if (guest.status === 'invited') await retractInvite(night._id, guest.ref)
    if (guest.status === 'requested') await settleJoinRequest(night._id, night.host, guest.ref.profileId, false)
  }
  if (Date.now() < new Date(night.starts_at).getTime() + WATCH_AFTER_MS) {
    await notifyCancelled(night._id, audience(night, ['going', 'invited', 'cant'], false), host ? { ref: host, name: await nameOf(host) } : null)
  }
  return { ok: true }
}

// ---------------------------------------------------------------------------------------------
// The calendar file

export type NightCalendar = { start: Date; end: Date; version: number; title: string; film: string | null; place: string; cancelled: boolean }

/** What the .ics carries, for the host and the guests who are going (the route checks who asks). */
export function calendarOf(night: NightDoc): NightCalendar {
  return {
    start: new Date(night.starts_at),
    end: new Date(night.ends_at),
    version: night.version,
    title: night.title,
    film: night.chosen?.media.title ?? null,
    place: night.place,
    cancelled: night.status === 'cancelled',
  }
}

// ---------------------------------------------------------------------------------------------
// The nights cron (/api/cron/nights): reminders and votes that closed with nobody looking

export async function runNightsJob({ deadline }: { deadline: number }): Promise<{ reminded: number; resolved: number; more: boolean }> {
  const collection = await nights()
  const now = new Date()
  let reminded = 0
  let resolved = 0
  let more = false
  const outOfTime = () => Date.now() > deadline - 1500

  // Votes past their close time: the first guarded write (here, a page read or a swipe) wins.
  const due = await collection.find({
    status: 'planned',
    chosen: null,
    'candidates.0': { $exists: true },
    $or: [{ vote_closed_at: { $ne: null } }, { vote_closes_at: { $lte: now } }],
  }).sort({ starts_at: 1 }).limit(100).toArray()
  for (const night of due) {
    if (outOfTime()) { more = true; break }
    if (await resolveVote(night)) resolved++
  }

  const soon = await collection.find({
    status: 'planned',
    starts_at: { $gt: now, $lte: new Date(now.getTime() + 24 * 3600 * 1000) },
    $or: [{ 'reminded.day': { $ne: true } }, { 'reminded.hour': { $ne: true } }],
  }).sort({ starts_at: 1 }).limit(200).toArray()
  for (const night of soon) {
    if (outOfTime()) { more = true; break }
    const which = reminderDue(night, new Date())
    if (!which) continue
    // Claim it first: two runs at once can't both send (an hour reminder also settles the day one).
    const claim = await collection.updateOne(
      { _id: night._id, status: 'planned', starts_at: night.starts_at, [`reminded.${which}`]: { $ne: true } },
      { $set: which === 'hour' ? { 'reminded.hour': true, 'reminded.day': true } : { 'reminded.day': true } },
    )
    if (claim.modifiedCount !== 1) continue
    await notifyReminder(night._id, audience(night, ['going']), which, new Date(night.starts_at), night.chosen?.media ?? null)
    reminded++
  }
  return { reminded, resolved, more }
}

// ---------------------------------------------------------------------------------------------
// Accounts and profiles going away

/** Takes these profiles out of every night they're a guest in (their votes and suggestions' names too). */
async function pullGuests(match: Filter<NightDoc>, isGone: (ref: ProfileRef) => boolean) {
  const collection = await nights()
  const docs = await collection.find(match).toArray()
  for (const night of docs) {
    const gone = night.guests.filter((guest) => isGone(guest.ref)).map((guest) => guest.ref.profileId)
    if (gone.length === 0) continue
    const unset = Object.fromEntries(gone.flatMap((profileId) => [[`votes.${profileId}`, ''], [`vote_at.${profileId}`, '']]))
    await collection.updateOne(
      { _id: night._id },
      {
        $pull: { guests: { 'ref.profileId': { $in: gone } }, declined: { $in: gone } },
        $unset: unset,
        $set: { updated_at: new Date(), candidates: night.candidates.map((candidate) => (candidate.added_by && gone.includes(candidate.added_by) ? { ...candidate, added_by: null } : candidate)) },
        $inc: { rev: 1 },
      } as UpdateFilter<NightDoc>,
    )
  }
}

/** Cancels (telling the guests) and then deletes the nights these hosts made. */
async function dropHosted(match: Filter<NightDoc>) {
  const collection = await nights()
  const hosted = await collection.find(match).toArray()
  for (const night of hosted) {
    if (night.status === 'planned') await cancelNight(night, null)
  }
  if (hosted.length) await collection.deleteMany({ _id: { $in: hosted.map((night) => night._id) } })
}

/** The account's profile ids (still readable at step 1 of the deletion pipeline). */
async function profileIdsOf(userId: string): Promise<string[]> {
  if (!ObjectId.isValid(userId)) return []
  const user = await (await clientPromise).db().collection('users').findOne({ _id: new ObjectId(userId) }, { projection: { profiles: 1 } })
  return (user?.profiles ?? []).map((profile: { id?: unknown }) => String(profile?.id ?? '')).filter(Boolean)
}

/**
 * Account deletion, step 1 (before the generic clean-up): the nights this account hosts are called
 * off (the guests hear) and deleted; its seats in other nights are freed; no night keeps its ids.
 */
export async function onAccountDeleted(userId: string): Promise<void> {
  const profileIds = await profileIdsOf(userId)
  await dropHosted({ 'host.userId': userId })
  await pullGuests({ 'guests.ref.userId': userId }, (ref) => ref.userId === userId)
  if (profileIds.length) await forgetIds(profileIds)
}

/** Removes profile ids from the "turned away" lists and the suggestion credits of other nights. */
async function forgetIds(profileIds: string[]) {
  const collection = await nights()
  await collection.updateMany({ declined: { $in: profileIds } }, { $pull: { declined: { $in: profileIds } } } as UpdateFilter<NightDoc>)
  await collection.updateMany(
    { 'candidates.added_by': { $in: profileIds } },
    { $set: { 'candidates.$[gone].added_by': null } } as UpdateFilter<NightDoc>,
    { arrayFilters: [{ 'gone.added_by': { $in: profileIds } }] },
  )
}

/** A profile deleted from an account: the same, for that one profile. */
export async function forgetProfileInNights(userId: string, profileId: string): Promise<void> {
  await dropHosted({ 'host.profileId': profileId, 'host.userId': userId })
  await pullGuests({ 'guests.ref.profileId': profileId }, (ref) => ref.profileId === profileId)
  await forgetIds([profileId])
}

/** The data export: the account's nights, with other people as names only (never their ids). */
export async function exportUserNights(userId: string): Promise<unknown> {
  const docs = await (await nights()).find({ $or: [{ 'host.userId': userId }, { 'guests.ref.userId': userId }] }).toArray()
  return Promise.all(docs.map(async (night) => {
    const hosted = night.host.userId === userId
    const me = night.guests.find((guest) => guest.ref.userId === userId)
    return {
      title: night.title,
      starts_at: night.starts_at,
      time_zone: night.tz,
      status: night.status,
      role: hosted ? 'host' : me?.status ?? 'guest',
      host: hosted ? 'you' : await nameOf(night.host),
      place: night.place || null,
      note: night.note || null,
      guests: hosted ? await Promise.all(night.guests.map(async (guest) => ({ name: await nameOf(guest.ref), status: guest.status }))) : undefined,
      films: night.candidates.map((candidate) => candidate.media.title),
      film: night.chosen?.media.title ?? null,
    }
  }))
}

// ---------------------------------------------------------------------------------------------
// The weekly digest (registered by integration in lib/digest/providers.ts)

/** This profile's nights in the week ahead (host or going/invited). */
export async function nightsForDigest(profileId: string, from: Date, days = 7): Promise<NightDoc[]> {
  return (await nights()).find({
    status: 'planned',
    starts_at: { $gt: from, $lte: new Date(from.getTime() + days * 86400000) },
    $or: [
      { 'host.profileId': profileId },
      { guests: { $elemMatch: { 'ref.profileId': profileId, status: { $in: ['going', 'invited'] } } } },
    ],
  }).sort({ starts_at: 1 }).limit(5).toArray()
}
