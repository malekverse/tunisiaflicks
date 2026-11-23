// Watch parties on the server (lib/party-rules has the rules). The site only introduces the
// players: a guest leaves its connection offer here, the host's page picks it up and leaves its
// answer, and from then on the players talk directly to each other. Nothing about the film's
// progress ever comes here. A party is forgotten PARTY_HOURS after it starts (TTL), or when the
// host ends it.
//
// parties {_id: code, hostToken, hostUserId, hostName, media, title, createdAt, expireAt,
//          members: [{id, token, userId, name, offer, answer, at}]}
import 'server-only'
import { randomBytes, timingSafeEqual } from 'crypto'
import type { Collection } from 'mongodb'
import clientPromise from '@/src/lib/mongodb'
import { PARTY_HOURS, PARTY_MAX, isPartyCode, isPartyToken, partyCodeFrom, type PartyMedia } from '@/src/lib/party-rules'

type MemberDoc = { id: string, token: string, userId: string, name: string, offer: string, answer: string | null, at: Date }
type PartyDoc = {
  _id: string
  hostToken: string
  hostUserId: string
  hostName: string
  media: PartyMedia
  title: string
  createdAt: Date
  expireAt: Date
  members: MemberDoc[]
}

/** What anyone with the code sees. */
export type PartyInfo = { code: string, hostName: string, media: PartyMedia, title: string, guests: number, full: boolean, mine: boolean }

let ready: Promise<unknown> | null = null
async function partiesDb(): Promise<Collection<PartyDoc>> {
  const parties = (await clientPromise).db().collection<PartyDoc>('parties')
  ready ??= Promise.all([
    parties.createIndex({ expireAt: 1 }, { expireAfterSeconds: 0 }),
    parties.createIndex({ hostUserId: 1 }),
  ]).catch((error) => {
    ready = null
    console.error('party: creating indexes failed', error)
  })
  await ready
  return parties
}

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b))
const live = (party: PartyDoc | null, now: Date) => (party && party.expireAt.getTime() > now.getTime() ? party : null)
const token = () => randomBytes(16).toString('base64url')

/** A new party: its code (to share) and the host's secret (to manage it). One open party per account. */
export async function createParty(userId: string, hostName: string, media: PartyMedia, title: string, now: Date = new Date()): Promise<{ code: string, hostToken: string }> {
  const parties = await partiesDb()
  await parties.deleteMany({ hostUserId: userId })
  for (let attempt = 0; attempt < 6; attempt++) {
    const doc: PartyDoc = {
      _id: partyCodeFrom(randomBytes(6)),
      hostToken: token(),
      hostUserId: userId,
      hostName: hostName.slice(0, 40),
      media,
      title: title.slice(0, 120),
      createdAt: now,
      expireAt: new Date(now.getTime() + PARTY_HOURS * 3600_000),
      members: [],
    }
    try {
      await parties.insertOne(doc)
      return { code: doc._id, hostToken: doc.hostToken }
    } catch (error) {
      if ((error as { code?: number })?.code !== 11000) throw error
    }
  }
  throw new Error('party: no free code')
}

export async function partyInfo(code: string, viewerId: string | null, now: Date = new Date()): Promise<PartyInfo | null> {
  if (!isPartyCode(code)) return null
  const party = live(await (await partiesDb()).findOne({ _id: code }, { projection: { hostToken: 0, 'members.offer': 0, 'members.answer': 0, 'members.token': 0 } }), now)
  if (!party) return null
  return {
    code,
    hostName: party.hostName,
    media: party.media,
    title: party.title,
    guests: party.members.length,
    full: party.members.length >= PARTY_MAX - 1,
    mine: !!viewerId && party.hostUserId === viewerId,
  }
}

export type JoinResult = { ok: true, memberId: string, memberToken: string } | { ok: false, error: 'not_found' | 'full' | 'own' }

/** A guest knocks: its offer waits for the host. Knocking again (a reload) replaces its old seat. */
export async function joinParty(code: string, userId: string, name: string, offer: string, now: Date = new Date()): Promise<JoinResult> {
  if (!isPartyCode(code)) return { ok: false, error: 'not_found' }
  const parties = await partiesDb()
  const party = live(await parties.findOne({ _id: code }, { projection: { hostUserId: 1, expireAt: 1, members: 1 } }), now)
  if (!party) return { ok: false, error: 'not_found' }
  if (party.hostUserId === userId) return { ok: false, error: 'own' }
  await parties.updateOne({ _id: code }, { $pull: { members: { userId } } })
  const member: MemberDoc = { id: randomBytes(6).toString('base64url'), token: token(), userId, name: name.slice(0, 40), offer, answer: null, at: now }
  const result = await parties.updateOne(
    { _id: code, expireAt: { $gt: now }, [`members.${PARTY_MAX - 2}`]: { $exists: false } },
    { $push: { members: member } },
  )
  if (result.modifiedCount !== 1) return { ok: false, error: 'full' }
  return { ok: true, memberId: member.id, memberToken: member.token }
}

/** The host's page: the guests still waiting for an answer. */
export async function waitingGuests(code: string, hostToken: string, now: Date = new Date()): Promise<{ id: string, name: string, offer: string }[] | null> {
  if (!isPartyCode(code) || !isPartyToken(hostToken)) return null
  const party = live(await (await partiesDb()).findOne({ _id: code }), now)
  if (!party || !same(party.hostToken, hostToken)) return null
  return party.members.filter((member) => member.answer === null).map((member) => ({ id: member.id, name: member.name, offer: member.offer }))
}

/** The host answers a guest's offer. */
export async function answerGuest(code: string, hostToken: string, memberId: string, answer: string, now: Date = new Date()): Promise<boolean> {
  if (!isPartyCode(code) || !isPartyToken(hostToken) || typeof memberId !== 'string' || memberId.length > 16) return false
  const parties = await partiesDb()
  const party = live(await parties.findOne({ _id: code }, { projection: { hostToken: 1, expireAt: 1 } }), now)
  if (!party || !same(party.hostToken, hostToken)) return false
  return (await parties.updateOne({ _id: code, 'members.id': memberId }, { $set: { 'members.$.answer': answer } })).modifiedCount === 1
}

/** The guest's page: the host's answer, once there is one (null: not yet; undefined: no such seat). */
export async function guestAnswer(code: string, memberId: string, memberToken: string, now: Date = new Date()): Promise<string | null | undefined> {
  if (!isPartyCode(code) || !isPartyToken(memberToken)) return undefined
  const party = live(await (await partiesDb()).findOne({ _id: code }, { projection: { expireAt: 1, members: 1 } }), now)
  const member = party?.members.find((entry) => entry.id === memberId)
  if (!member || !same(member.token, memberToken)) return undefined
  return member.answer
}

/** The host moved on (the next episode): latecomers go there. */
export async function movePartyMedia(code: string, hostToken: string, media: PartyMedia): Promise<boolean> {
  if (!isPartyCode(code) || !isPartyToken(hostToken)) return false
  const parties = await partiesDb()
  const party = await parties.findOne({ _id: code }, { projection: { hostToken: 1 } })
  if (!party || !same(party.hostToken, hostToken)) return false
  return (await parties.updateOne({ _id: code }, { $set: { media } })).matchedCount === 1
}

/** The host ends the party: the code stops working. */
export async function endParty(code: string, hostToken: string): Promise<boolean> {
  if (!isPartyCode(code) || !isPartyToken(hostToken)) return false
  const parties = await partiesDb()
  const party = await parties.findOne({ _id: code }, { projection: { hostToken: 1 } })
  if (!party || !same(party.hostToken, hostToken)) return false
  return (await parties.deleteOne({ _id: code })).deletedCount === 1
}

/** Account deletion: its parties, and its seats in others. */
export async function deletePartyData(userId: string): Promise<void> {
  const parties = await partiesDb()
  await parties.deleteMany({ hostUserId: userId })
  await parties.updateMany({ 'members.userId': userId }, { $pull: { members: { userId } } })
}
