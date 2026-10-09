// "Swipe to decide": a room with a shared deck of titles. Everyone swipes yes/no on their own phone;
// the first title every participant said yes to is the match. Rooms live 24 hours (TTL index).
// No account needed: a participant is a random id plus a secret kept in their browser.
//
// A room can belong to a movie night ('Pick together'): its deck starts with the night's films and
// goes on with titles like them, and its match becomes the night's film (lib/movie-night.ts), once.
import { randomBytes, randomInt, randomUUID } from 'crypto'
import clientPromise from '@/src/lib/mongodb'
import { tmdbFetchSafe, tmdbLanguage } from '@/src/lib/tmdb'
import { filterKidSafe, kidsDiscoverParams } from '@/src/lib/kids'
import type { Locale } from '@/src/lib/i18n'

export type SwipeKind = 'movie' | 'tv' | 'both'
export type SwipeCard = {
  key: string // "movie:550"
  id: number
  media_type: 'movie' | 'tv'
  title: string
  poster_path: string | null
  backdrop_path: string | null
  year: string
  vote_average: number
  overview: string
}
type Participant = { id: string, secret: string, name: string, joined_at: Date }
export type SwipeRoom = {
  _id: string
  created_at: Date
  expires_at: Date
  kind: SwipeKind
  genre: number | null
  kids: boolean
  deck: SwipeCard[]
  participants: Participant[]
  /** participant id -> card key -> vote */
  votes: Record<string, Record<string, boolean>>
  match: string | null
  matched_at: Date | null
  /**
   * The movie night this room picks for ('Pick together'), if any. Only its id: a room is open to
   * anyone holding its code, and the night's name is for the people invited (the room's page asks
   * the night for it, and only its members get it).
   */
  night?: { id: string } | null
  /** The night's films (card keys) the deck starts with; a new deck starts with them again. */
  seed?: string[]
}

export const MAX_PARTICIPANTS = 8
const DECK_SIZE = 40
const TTL_HOURS = 24
// No 0/O or 1/I: codes are read out loud and typed on phones.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export const isRoomCode = (value: unknown): value is string => typeof value === 'string' && /^[A-Z2-9]{6}$/.test(value)
export const cleanName = (value: unknown) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, 24) : '')

async function rooms() {
  const collection = (await clientPromise).db().collection<SwipeRoom>('swipeRooms')
  await collection.createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 }).catch(() => {})
  return collection
}

function shuffle<T>(items: T[]) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[items[i], items[j]] = [items[j], items[i]]
  }
  return items
}

const toCard = (item: any, media_type: 'movie' | 'tv'): SwipeCard => ({
  key: `${media_type}:${item.id}`,
  id: item.id,
  media_type,
  title: item.title || item.name || '',
  poster_path: item.poster_path ?? null,
  backdrop_path: item.backdrop_path ?? null,
  year: (item.release_date || item.first_air_date || '').slice(0, 4),
  vote_average: Math.round((item.vote_average ?? 0) * 10) / 10,
  overview: item.overview ?? '',
})

// The lobby offers movie genres; TV uses different ids for some, and lacks a few entirely.
const TV_GENRE: Record<number, number | null> = {
  28: 10759, 12: 10759, 878: 10765, 14: 10765, 10752: 10768,
  16: 16, 35: 35, 80: 80, 99: 99, 18: 18, 10751: 10751, 9648: 9648, 37: 37,
}
const genreFor = (media: 'movie' | 'tv', genre: number | null) =>
  genre === null ? null : media === 'movie' ? genre : TV_GENRE[genre] ?? undefined

/** A varied deck of well-known, well-rated titles (two random pages of popular discover results per kind). */
async function buildDeck(kind: SwipeKind, genre: number | null, kids: boolean, locale: Locale): Promise<SwipeCard[]> {
  // A genre with no TV counterpart (horror, romance...) keeps the deck to movies.
  const kinds = (kind === 'both' ? ['movie', 'tv'] as const : [kind]).filter((media) => genreFor(media, genre) !== undefined)
  const requests = kinds.flatMap((media) => {
    const pages = shuffle([1, 2, 3, 4, 5]).slice(0, 2)
    return pages.map(async (page) => {
      const base = {
        sort_by: 'popularity.desc',
        'vote_count.gte': media === 'movie' ? 300 : 150,
        'vote_average.gte': 6.3,
        with_genres: genreFor(media, genre) ?? undefined,
        without_genres: media === 'tv' ? '10763,10764,10767,10766' : undefined,
        language: tmdbLanguage(locale),
        page,
      }
      const params = kids ? kidsDiscoverParams(media, base) : base
      const data = await tmdbFetchSafe<{ results: any[] }>(`discover/${media}`, params, 21600)
      return (data?.results ?? []).filter((item) => item.poster_path).map((item) => toCard(item, media))
    })
  })
  const cards = (await Promise.all(requests)).flat()
  const unique = [...new Map(cards.map((card) => [card.key, card])).values()]
  return shuffle(unique).slice(0, DECK_SIZE)
}

const isCardKey = (value: unknown): value is string => typeof value === 'string' && /^(movie|tv):[0-9]{1,9}$/.test(value)

/**
 * A deck that starts with the given titles (a movie night's films), in their order, then goes on
 * with titles like them (TMDB recommendations, shuffled; kid-safe on Kids profiles), up to 40.
 * Topped up with the usual deck when the seeds don't bring enough.
 */
async function buildSeedDeck(seed: string[], kids: boolean, locale: Locale): Promise<SwipeCard[]> {
  const keys = seed.filter(isCardKey).slice(0, 8)
  const language = tmdbLanguage(locale)
  const records = await Promise.all(keys.map(async (key) => {
    const [media, id] = key.split(':') as ['movie' | 'tv', string]
    const data = await tmdbFetchSafe<any>(`${media}/${id}`, { language, append_to_response: 'recommendations' }, 21600)
    return data?.id ? { media, data } : null
  }))
  const firsts: SwipeCard[] = []
  let similar: { item: any, media: 'movie' | 'tv' }[] = []
  for (const record of records) {
    if (!record) continue
    if (!kids || (await filterKidSafe([record.data], record.media)).length) firsts.push(toCard(record.data, record.media))
    for (const item of record.data.recommendations?.results ?? []) {
      const media = item.media_type === 'tv' ? 'tv' : item.media_type === 'movie' ? 'movie' : record.media
      if (item.poster_path) similar.push({ item, media })
    }
  }
  if (kids && similar.length) {
    const safe = await filterKidSafe(similar.map(({ item, media }) => ({ ...item, media_type: media })), undefined, 80)
    const keep = new Set(safe.map((item: any) => `${item.media_type}:${item.id}`))
    similar = similar.filter(({ item, media }) => keep.has(`${media}:${item.id}`))
  }
  const cards = [...firsts, ...shuffle(similar.map(({ item, media }) => toCard(item, media)))]
  let deck = [...new Map(cards.map((card) => [card.key, card])).values()].slice(0, DECK_SIZE)
  if (deck.length < 12) {
    const more = await buildDeck('both', null, kids, locale)
    deck = [...new Map([...deck, ...more].map((card) => [card.key, card])).values()].slice(0, DECK_SIZE)
  }
  return deck
}

export async function createRoom(opts: {
  kind: SwipeKind, genre: number | null, kids: boolean, locale: Locale, name: string
  /** A movie night's films: the deck starts with them. */
  seed?: string[]
  night?: { id: string } | null
}) {
  const seed = (opts.seed ?? []).filter(isCardKey)
  const deck = seed.length ? await buildSeedDeck(seed, opts.kids, opts.locale) : await buildDeck(opts.kind, opts.genre, opts.kids, opts.locale)
  if (deck.length < 5) return null
  const participant: Participant = { id: randomBytes(6).toString('hex'), secret: randomUUID(), name: opts.name, joined_at: new Date() }
  const collection = await rooms()
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('')
    const now = new Date()
    try {
      await collection.insertOne({
        _id: code, created_at: now, expires_at: new Date(now.getTime() + TTL_HOURS * 3600000),
        kind: opts.kind, genre: opts.genre, kids: opts.kids, deck,
        participants: [participant], votes: { [participant.id]: {} }, match: null, matched_at: null,
        ...(opts.night ? { night: { id: opts.night.id }, seed } : {}),
      })
      return { code, participant: { id: participant.id, secret: participant.secret } }
    } catch (error: any) {
      if (error?.code !== 11000) throw error // code taken: try another
    }
  }
  return null
}

export async function getRoom(code: string) {
  return (await rooms()).findOne({ _id: code, expires_at: { $gt: new Date() } })
}

export async function joinRoom(code: string, name: string) {
  const participant: Participant = { id: randomBytes(6).toString('hex'), secret: randomUUID(), name, joined_at: new Date() }
  const result = await (await rooms()).updateOne(
    { _id: code, expires_at: { $gt: new Date() }, [`participants.${MAX_PARTICIPANTS - 1}`]: { $exists: false } },
    { $push: { participants: participant }, $set: { [`votes.${participant.id}`]: {} } },
  )
  return result.modifiedCount ? { id: participant.id, secret: participant.secret } : null
}

/** The first card every participant (2 or more) said yes to, in deck order. */
export function findMatch(room: Pick<SwipeRoom, 'deck' | 'participants' | 'votes'>): string | null {
  if (room.participants.length < 2) return null
  const card = room.deck.find((item) => room.participants.every((person) => room.votes[person.id]?.[item.key] === true))
  return card?.key ?? null
}

/** Records a vote; resolves to the room's match (possibly just found) or null. 'forbidden' for a bad secret. */
export async function vote(code: string, participantId: string, secret: string, cardKey: string, yes: boolean) {
  const collection = await rooms()
  const room = await collection.findOne({ _id: code, expires_at: { $gt: new Date() } })
  if (!room) return 'missing' as const
  const me = room.participants.find((person) => person.id === participantId)
  if (!me || me.secret !== secret) return 'forbidden' as const
  if (!room.deck.some((card) => card.key === cardKey)) return 'invalid' as const

  // Field names come from our own ids/keys ("movie:550" has no dots or $), so the path is safe.
  const updated = await collection.findOneAndUpdate(
    { _id: code },
    { $set: { [`votes.${participantId}.${cardKey}`]: yes } },
    { returnDocument: 'after' },
  )
  const after = updated.value
  if (!after) return 'missing' as const
  if (after.match) return after.match
  const match = findMatch(after)
  if (!match) return null
  // First match wins, even if two votes complete different matches at the same moment. Only the
  // vote that actually wrote the match tells the movie night, so it happens once.
  const claimed = await collection.updateOne({ _id: code, match: null }, { $set: { match, matched_at: new Date() } })
  if (claimed.modifiedCount === 1 && after.night) {
    const card = after.deck.find((item) => item.key === match)
    if (card) {
      try {
        const { setChosenFromRoom } = await import('@/src/lib/movie-night')
        await setChosenFromRoom(after.night.id, code, card)
      } catch (error) {
        console.error('swipe: telling the movie night about the match failed', error)
      }
    }
  }
  return (await collection.findOne({ _id: code }, { projection: { match: 1 } }))?.match ?? match
}

/** Starts over with a fresh deck (keeps the people). */
export async function newDeck(code: string, participantId: string, secret: string, locale: Locale) {
  const collection = await rooms()
  const room = await collection.findOne({ _id: code, expires_at: { $gt: new Date() } })
  if (!room) return 'missing' as const
  const me = room.participants.find((person) => person.id === participantId)
  if (!me || me.secret !== secret) return 'forbidden' as const
  // A movie night's room starts again with the night's films. (Its new match may replace a film an
  // earlier deck of this room chose, never one the host or the vote chose: see setChosenFromRoom.)
  const deck = room.seed?.length ? await buildSeedDeck(room.seed, room.kids, locale) : await buildDeck(room.kind, room.genre, room.kids, locale)
  if (deck.length < 5) return 'failed' as const
  await collection.updateOne({ _id: code }, {
    $set: { deck, match: null, matched_at: null, votes: Object.fromEntries(room.participants.map((person) => [person.id, {}])) },
  })
  return 'ok' as const
}

/** What clients see: never the secrets, never who voted what — only progress. */
export function publicState(room: SwipeRoom, withDeck: boolean) {
  const voted = (id: string) => Object.keys(room.votes[id] ?? {}).length
  // When the deck runs out without a match: the titles most people liked.
  const likes = new Map<string, number>()
  for (const ballot of Object.values(room.votes)) {
    for (const [key, yes] of Object.entries(ballot)) if (yes) likes.set(key, (likes.get(key) ?? 0) + 1)
  }
  const favorites = [...likes.entries()].filter(([, count]) => count >= 2).sort((a, b) => b[1] - a[1]).slice(0, 5)
  return {
    code: room._id,
    kind: room.kind,
    deckSize: room.deck.length,
    deckId: room.deck[0]?.key ?? '',
    deck: withDeck ? room.deck : undefined,
    participants: room.participants.map((person) => ({ id: person.id, name: person.name, voted: voted(person.id) })),
    match: room.match ? room.deck.find((card) => card.key === room.match) ?? null : null,
    favorites: favorites.map(([key, count]) => ({ card: room.deck.find((card) => card.key === key)!, likes: count })).filter((entry) => entry.card),
    expires_at: room.expires_at,
    /** The movie night this room picks for: its id only (its name and details stay with its members). */
    night: room.night ? { id: room.night.id } : null,
  }
}
