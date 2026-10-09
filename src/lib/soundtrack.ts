// A title's soundtrack album on Deezer: found by scoring Deezer's albums against the title, then
// cached in Mongo (`soundtracks`, one document per title) so the search runs about once every
// two months per title. Server only.
//
// Scoring (0 to 1): 0.45 × the album title (it names the film and says it is a soundtrack: OST,
// "Music from the Motion Picture", "bande originale", "موسيقى تصويرية"...) + 0.30 × the year
// (within a year of the release) + 0.25 × the artist (one of the title's composers; "Various
// Artists" counts half). An album is accepted from 0.75, unless an album of a different work
// (another title) also reaches 0.75: then nothing is shown rather than the wrong one.
//
// Never stored: preview links (they expire after minutes; /api/soundtrack/preview fetches a
// fresh one for each play). Three people reporting "Wrong album?" block that album for the title.
import 'server-only'
import type { Collection } from 'mongodb'
import { getAlbum, searchAlbums, type DeezerAlbum, type DeezerAlbumHit } from '@/src/lib/deezer'
import { tmdbFetchSafe } from '@/src/lib/tmdb'

const DAY = 86_400_000

export type SoundtrackAlbum = {
  albumId: number
  title: string
  artist: string
  /** The composer's TMDB person id, when the album's artist is one of the title's composers. */
  composerId: number | null
  cover: string | null
  link: string
  trackCount: number
  year: number | null
}

export type SoundtrackDoc = {
  _id: string
  status: 'found' | 'none' | 'error'
  albumId?: number
  title?: string
  artist?: string
  composerId?: number | null
  cover?: string | null
  link?: string
  trackCount?: number
  year?: number | null
  /** Reports of the current album, and who sent them (hashed, one per address). */
  reports: number
  reporters: string[]
  /** Albums three people said were wrong: never matched again for this title. */
  blocked: number[]
  checkedAt: Date
  staleAt: Date
  expiresAt: Date
}

export type MatchFacts = {
  title: string
  originalTitle?: string | null
  year: number | null
  /** The title's composers (TMDB crew: Original Music Composer, Music). */
  composers: { id: number, name: string }[]
  /** Released (or first aired) within the last few months, or not yet: search again sooner. */
  recent?: boolean
}

/** Crew jobs that wrote the music. */
const COMPOSER_JOBS = new Set(['Original Music Composer', 'Music', 'Music Score Composer', 'Main Title Theme Composer'])

/** A title's composers, from its TMDB credits (crew), once each. */
export function composersOf(credits: { crew?: any[] } | null | undefined): { id: number, name: string }[] {
  const seen = new Set<number>()
  const list: { id: number, name: string }[] = []
  for (const person of credits?.crew ?? []) {
    if (!COMPOSER_JOBS.has(person?.job) || typeof person.id !== 'number' || typeof person.name !== 'string' || seen.has(person.id)) continue
    seen.add(person.id)
    list.push({ id: person.id, name: person.name })
  }
  return list.slice(0, 4)
}

/** What the search needs to know about a title, from TMDB (cached a day). Null for an unknown title. */
export async function soundtrackFacts(type: 'movie' | 'tv', id: string, now: Date = new Date()): Promise<MatchFacts | null> {
  const data = await tmdbFetchSafe<any>(`${type}/${id}`, { append_to_response: 'credits' }, 86400)
  if (!data?.id) return null
  const date: string = (type === 'movie' ? data.release_date : data.first_air_date) || ''
  const released = date ? new Date(date).getTime() : NaN
  return {
    title: (type === 'movie' ? data.title : data.name) || '',
    originalTitle: (type === 'movie' ? data.original_title : data.original_name) || null,
    year: date ? Number(date.slice(0, 4)) || null : null,
    composers: composersOf(data.credits),
    recent: !Number.isFinite(released) || released > now.getTime() - 120 * DAY,
  }
}

// ---------------------------------------------------------------------------------------------
// Scoring (pure)

/** Lowercase, no accents, no punctuation, single spaces (Arabic letters kept). */
export function normalize(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[̀-ًͯ-ٰٟ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

const SOUNDTRACK_MARKERS = [
  /\bsoundtracks?\b/, /\bost\b/, /\boriginal (motion picture|score|series|television|film|music)\b/, /\bmusic from\b/,
  /\bscore\b/, /\bmusic (of|for) the (film|series|movie)\b/, /\bbande originale\b/, /\bmusique (du film|originale)\b/,
  /موسيقى تصويرية/, /الموسيقى التصويرية/,
]
/** Covers, tributes and lullaby versions: about the film, but not its soundtrack. */
const COVER_MARKERS = [/\btribute\b/, /\bcovers?\b/, /\bpiano\b/, /\bkaraoke\b/, /\blullab/, /\binspired by\b/, /\bin the style of\b/, /\b8 bit\b/, /\bmusic box\b/, /\bremix(es)?\b/, /\brendition/, /\bmade famous\b/, /\bguitar\b/]

export const hasSoundtrackMarker = (albumTitle: string) => SOUNDTRACK_MARKERS.some((pattern) => pattern.test(normalize(albumTitle)))
export const isCoverAlbum = (albumTitle: string) => COVER_MARKERS.some((pattern) => pattern.test(normalize(albumTitle)))

/** The album title without its brackets and soundtrack words: 'Inception (Music from…)' → 'inception'. */
export function coreTitle(albumTitle: string): string {
  let core = normalize(albumTitle.replace(/[([{][^)\]}]*[)\]}]/g, ' '))
  for (const pattern of SOUNDTRACK_MARKERS) core = core.replace(new RegExp(pattern.source, 'g'), ' ')
  return core.replace(/\b(the|deluxe|edition|expanded|complete|remastered|music|from|original|motion picture|vol \d+|volume \d+)\b/g, ' ').replace(/\s+/g, ' ').trim()
}

const tokens = (value: string) => new Set(value.split(' ').filter(Boolean))

/** How well an album's title names this film and says it's a soundtrack (0 to 1). */
export function titleScore(albumTitle: string, titles: (string | null | undefined)[]): number {
  const core = coreTitle(albumTitle)
  const full = normalize(albumTitle)
  let best = 0
  for (const raw of titles) {
    if (!raw) continue
    const title = normalize(raw).replace(/^the /, '')
    if (!title) continue
    let score: number
    if (core === title || core.replace(/^the /, '') === title) score = 1
    else if (` ${full} `.includes(` ${title} `) && core.split(' ').length <= title.split(' ').length + 2) score = 0.8
    else {
      const a = tokens(core)
      const b = tokens(title)
      let common = 0
      a.forEach((word) => { if (b.has(word)) common++ })
      score = a.size + b.size ? (0.7 * common) / (a.size + b.size - common) : 0
    }
    best = Math.max(best, score)
  }
  if (!hasSoundtrackMarker(albumTitle)) best *= 0.6
  if (isCoverAlbum(albumTitle)) best *= 0.3
  return best
}

const sameName = (a: string, b: string) => {
  const left = normalize(a)
  const right = normalize(b)
  if (!left || !right) return false
  return left === right || (right.includes(' ') && ` ${left} `.includes(` ${right} `)) || (left.includes(' ') && ` ${right} `.includes(` ${left} `))
}

/** 1 when the album's artist is one of the composers, 0.5 for "Various Artists", else 0. */
export function composerScore(artist: string | null | undefined, contributors: string[], composers: { name: string }[]): number {
  const names = [artist ?? '', ...contributors].filter(Boolean)
  if (composers.some((composer) => names.some((name) => sameName(name, composer.name)))) return 1
  return names.some((name) => /^various( artists)?$/.test(normalize(name))) ? 0.5 : 0
}

export function yearScore(releaseDate: string | null | undefined, year: number | null): number {
  const albumYear = releaseDate ? Number(releaseDate.slice(0, 4)) : NaN
  return year !== null && Number.isInteger(albumYear) && Math.abs(albumYear - year) <= 1 ? 1 : 0
}

export const ACCEPT = 0.75

export type Candidate = { album: Pick<DeezerAlbum, 'id' | 'title' | 'artist' | 'releaseDate' | 'contributors'> & Partial<DeezerAlbum>, score: number }

export function scoreAlbum(album: Candidate['album'], facts: MatchFacts): number {
  const score = 0.45 * titleScore(album.title, [facts.title, facts.originalTitle])
    + 0.30 * yearScore(album.releaseDate, facts.year)
    + 0.25 * composerScore(album.artist?.name, album.contributors ?? [], facts.composers)
  return Math.round(score * 1000) / 1000
}

/**
 * The accepted album among scored candidates: the best one from 0.75, unless an album of a
 * different work (another core title) also reaches 0.75. Ties: not a cover, then more tracks.
 */
export function pickMatch(candidates: Candidate[]): Candidate | null {
  const accepted = candidates.filter((candidate) => candidate.score >= ACCEPT)
  if (!accepted.length) return null
  accepted.sort((a, b) => b.score - a.score
    || Number(isCoverAlbum(a.album.title)) - Number(isCoverAlbum(b.album.title))
    || (b.album.nbTracks ?? 0) - (a.album.nbTracks ?? 0))
  const best = accepted[0]
  const work = coreTitle(best.album.title)
  if (accepted.some((candidate) => coreTitle(candidate.album.title) !== work)) return null
  return best
}

// ---------------------------------------------------------------------------------------------
// Searching Deezer

/** The best Deezer album for a title: the album, 'none', or 'error' when Deezer couldn't be reached. */
export async function findSoundtrack(facts: MatchFacts, blocked: number[] = []): Promise<{ album: DeezerAlbum, composerId: number | null } | 'none' | 'error'> {
  const queries = [`${facts.title} soundtrack`]
  const composer = facts.composers[0]?.name
  if (composer) queries.push(`${facts.title} ${composer}`)
  if (facts.originalTitle && normalize(facts.originalTitle) !== normalize(facts.title)) queries.push(`${facts.originalTitle} soundtrack`)

  const results = await Promise.all(queries.slice(0, 3).map((query) => searchAlbums(query, 25)))
  if (results.every((list) => list === null)) return 'error'
  const hits = new Map<number, DeezerAlbumHit>()
  for (const list of results) for (const hit of list ?? []) if (!blocked.includes(hit.id) && !hits.has(hit.id)) hits.set(hit.id, hit)

  // The year is only on the album itself: fetch the albums that could still reach 0.75 with it.
  // (0.45 × title + 0.30 + 0.25 reaches 0.75 only from a title score of 0.44.)
  const shortlist = Array.from(hits.values())
    .map((hit) => {
      const title = titleScore(hit.title, [facts.title, facts.originalTitle])
      return { hit, title, partial: 0.45 * title + 0.25 * composerScore(hit.artist?.name, [], facts.composers) }
    })
    .filter((entry) => entry.title >= 0.44)
    .sort((a, b) => b.partial - a.partial)
    .slice(0, 6)
  if (!shortlist.length) return 'none'

  const albums = (await Promise.all(shortlist.map((entry) => getAlbum(entry.hit.id)))).filter((album): album is DeezerAlbum => album !== null)
  const match = pickMatch(albums.map((album) => ({ album, score: scoreAlbum(album, facts) })))
  if (!match) return 'none'
  const album = match.album as DeezerAlbum
  const names = [album.artist?.name ?? '', ...album.contributors]
  const composerId = facts.composers.find((person) => names.some((name) => sameName(name, person.name)))?.id ?? null
  return { album, composerId }
}

// ---------------------------------------------------------------------------------------------
// The cache

let indexes: Promise<unknown> | null = null

async function collection(): Promise<Collection<SoundtrackDoc>> {
  // Imported here so the scoring above stays importable without a database (unit tests).
  const { default: clientPromise } = await import('@/src/lib/mongodb')
  const soundtracks = (await clientPromise).db().collection<SoundtrackDoc>('soundtracks')
  indexes ??= soundtracks.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }).catch((error) => {
    indexes = null
    console.error('soundtracks TTL index:', error)
  })
  await indexes
  return soundtracks
}

export const soundtrackKey = (type: 'movie' | 'tv', id: string) => `${type}:${id}`

const toAlbum = (doc: SoundtrackDoc): SoundtrackAlbum | null =>
  doc.status === 'found' && doc.albumId && doc.title && doc.link
    ? { albumId: doc.albumId, title: doc.title, artist: doc.artist ?? '', composerId: doc.composerId ?? null, cover: doc.cover ?? null, link: doc.link, trackCount: doc.trackCount ?? 0, year: doc.year ?? null }
    : null

export type CachedSoundtrack = { state: 'found', album: SoundtrackAlbum } | { state: 'none' } | { state: 'unknown' }

/** What the cache says right now (no Deezer call): found, none, or unknown (missing or stale). */
export async function readSoundtrack(type: 'movie' | 'tv', id: string): Promise<CachedSoundtrack> {
  try {
    const doc = await (await collection()).findOne({ _id: soundtrackKey(type, id) })
    if (!doc || doc.staleAt.getTime() <= Date.now()) return { state: 'unknown' }
    const album = toAlbum(doc)
    if (album && !(doc.blocked ?? []).includes(album.albumId)) return { state: 'found', album }
    return doc.status === 'none' ? { state: 'none' } : { state: 'unknown' }
  } catch (error) {
    console.error('soundtrack cache read:', error)
    return { state: 'unknown' }
  }
}

/** When to look again: found 60 days; none 30 days (3 for a recent title); Deezer down 1 hour. */
export function staleAfter(status: SoundtrackDoc['status'], recent: boolean): number {
  if (status === 'found') return 60 * DAY
  if (status === 'none') return recent ? 3 * DAY : 30 * DAY
  return 60 * 60 * 1000
}

/** The cached answer, searching Deezer again when there is none yet or it is stale. */
export async function resolveSoundtrack(type: 'movie' | 'tv', id: string, facts: MatchFacts): Promise<SoundtrackAlbum | null> {
  const soundtracks = await collection()
  const _id = soundtrackKey(type, id)
  const doc = await soundtracks.findOne({ _id })
  if (doc && doc.staleAt.getTime() > Date.now()) {
    const album = toAlbum(doc)
    if (doc.status !== 'found' || (album && !(doc.blocked ?? []).includes(album.albumId))) return album
  }

  const blocked = doc?.blocked ?? []
  const found = await findSoundtrack(facts, blocked)
  const now = new Date()
  const status: SoundtrackDoc['status'] = found === 'error' ? 'error' : found === 'none' ? 'none' : 'found'
  if (status === 'error' && doc && toAlbum(doc) && !blocked.includes(doc.albumId!)) {
    // Deezer is down: keep showing the album we had, and try again in an hour.
    await soundtracks.updateOne({ _id }, { $set: { staleAt: new Date(now.getTime() + staleAfter('error', false)) } })
    return toAlbum(doc)
  }
  const staleAt = new Date(now.getTime() + staleAfter(status, !!facts.recent))
  const album = typeof found === 'object' ? found.album : null
  const sameAlbum = album && doc?.albumId === album.id
  const fields: Partial<SoundtrackDoc> = album
    ? {
      status, albumId: album.id, title: album.title, artist: album.artist?.name ?? '', composerId: typeof found === 'object' ? found.composerId : null,
      cover: album.cover, link: album.link, trackCount: album.nbTracks, year: album.releaseDate ? Number(album.releaseDate.slice(0, 4)) : null,
    }
    : { status }
  await soundtracks.updateOne(
    { _id },
    {
      $set: {
        ...fields,
        ...(sameAlbum ? {} : { reports: 0, reporters: [] }),
        checkedAt: now, staleAt, expiresAt: new Date(staleAt.getTime() + 30 * DAY),
      },
      ...(album ? {} : { $unset: { albumId: '', title: '', artist: '', composerId: '', cover: '', link: '', trackCount: '', year: '' } }),
      $setOnInsert: { blocked: [] },
    },
    { upsert: true },
  )
  return album ? toAlbum({ ...(fields as SoundtrackDoc), status: 'found' }) : null
}

/**
 * "Wrong album?": one report per reporter (an address hash) and album. At three, the album is
 * blocked for this title and the next visit searches again. Returns false when there's nothing to
 * report (no album, or a different one by now).
 */
export async function reportSoundtrack(type: 'movie' | 'tv', id: string, albumId: number, reporter: string): Promise<{ ok: boolean, blocked: boolean }> {
  const soundtracks = await collection()
  const _id = soundtrackKey(type, id)
  const result = await soundtracks.findOneAndUpdate(
    { _id, albumId, status: 'found' },
    { $addToSet: { reporters: reporter } },
    { returnDocument: 'after' },
  )
  // mongodb v5 driver: the document is in `.value`.
  const doc = result.value
  if (!doc) return { ok: false, blocked: false }
  const count = (doc.reporters ?? []).length
  if (count >= 3) {
    await soundtracks.updateOne(
      { _id, albumId },
      { $addToSet: { blocked: albumId }, $set: { reports: count, staleAt: new Date(0) } },
    )
    return { ok: true, blocked: true }
  }
  await soundtracks.updateOne({ _id, albumId }, { $set: { reports: count } })
  return { ok: true, blocked: false }
}
