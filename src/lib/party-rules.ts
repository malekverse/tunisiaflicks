// Watch parties (the desktop app's player, kept in step between friends): the rules both sides
// share. A party has a short code to type or share (/party/CODE), a host and up to PARTY_MAX - 1
// guests. The players talk directly to each other (WebRTC); the site only passes each guest's
// connection offer to the host and the host's answer back (lib/party). Pure.

export const PARTY_MAX = 8
/** A party is forgotten this long after it starts. */
export const PARTY_HOURS = 8
/** A connection offer or answer (SDP), at most. */
export const SDP_MAX = 16_000

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const PARTY_CODE_RE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/
export const PARTY_TOKEN_RE = /^[A-Za-z0-9_-]{22}$/

export const isPartyCode = (value: unknown): value is string => typeof value === 'string' && PARTY_CODE_RE.test(value)
export const isPartyToken = (value: unknown): value is string => typeof value === 'string' && PARTY_TOKEN_RE.test(value)

/** A code as someone typed it ('abc 123', 'ABC-123'), or null. */
export function normalizePartyCode(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const code = value.toUpperCase().replace(/[\s-]+/g, '').replace(/[O]/g, '0').replace(/[IL]/g, '1')
  return isPartyCode(code) ? code : null
}

export function partyCodeFrom(bytes: Uint8Array): string {
  return Array.from(bytes.slice(0, 6), (byte) => ALPHABET[byte % ALPHABET.length]).join('')
}

/** What the party watches: the same title (and episode) for everyone. */
export type PartyMedia = { type: 'movie', id: string } | { type: 'tv', id: string, season: number, episode: number }

export function cleanPartyMedia(value: unknown): PartyMedia | null {
  const media = value as { type?: unknown, id?: unknown, season?: unknown, episode?: unknown } | null
  if (!media || typeof media !== 'object') return null
  const id = typeof media.id === 'string' || typeof media.id === 'number' ? String(media.id) : ''
  if (!/^\d{1,9}$/.test(id)) return null
  if (media.type === 'movie') return { type: 'movie', id }
  const season = Number(media.season)
  const episode = Number(media.episode)
  if (media.type === 'tv' && Number.isInteger(season) && season >= 0 && season < 1000 && Number.isInteger(episode) && episode > 0 && episode < 10000) {
    return { type: 'tv', id, season, episode }
  }
  return null
}

/** The page that plays a party's title, with the party in the address. */
export function partyPath(media: PartyMedia, code: string): string {
  return media.type === 'movie'
    ? `/movie/${media.id}?party=${code}#streamSection`
    : `/tv/${media.id}?s=${media.season}&e=${media.episode}&party=${code}#streamSection`
}

/** A connection offer or answer worth passing on: an SDP of a sensible size. */
export function cleanSdp(value: unknown): string | null {
  if (typeof value !== 'string' || value.length < 20 || value.length > SDP_MAX) return null
  return value.startsWith('v=0') ? value : null
}

// ---- what the players say to each other (over the data channel) --------------------------------

export const REACTIONS = ['😂', '😮', '😍', '👏', '😢', '🔥'] as const
export type Reaction = typeof REACTIONS[number]

export type PartyMessage =
  | { t: 'hello', name: string }
  | { t: 'people', names: string[] }
  | { t: 'state', playing: boolean, pos: number, by: string, beat?: boolean }
  | { t: 'sync' }
  | { t: 'react', e: Reaction, name: string }
  | { t: 'next', by: string }
  | { t: 'ping', at: number }
  | { t: 'pong', at: number }
  | { t: 'end' }

const name = (value: unknown) => (typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩]/g, '').trim().slice(0, 40) : '')
const position = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value < 86_400 ? value : null)

/** A message from another player, checked: null for anything malformed. */
export function readPartyMessage(raw: unknown): PartyMessage | null {
  let data: any
  try { data = typeof raw === 'string' ? JSON.parse(raw) : null } catch { return null }
  if (!data || typeof data !== 'object' || typeof raw !== 'string' || raw.length > 4000) return null
  switch (data.t) {
    case 'hello': return { t: 'hello', name: name(data.name) }
    case 'people': return Array.isArray(data.names) ? { t: 'people', names: data.names.slice(0, PARTY_MAX).map(name) } : null
    case 'state': {
      const pos = position(data.pos)
      return pos === null || typeof data.playing !== 'boolean' ? null : { t: 'state', playing: data.playing, pos, by: name(data.by), ...(data.beat === true ? { beat: true } : {}) }
    }
    case 'sync': return { t: 'sync' }
    case 'react': return (REACTIONS as readonly string[]).includes(data.e) ? { t: 'react', e: data.e, name: name(data.name) } : null
    case 'next': return { t: 'next', by: name(data.by) }
    case 'ping': case 'pong': return typeof data.at === 'number' && Number.isFinite(data.at) ? { t: data.t, at: data.at } : null
    case 'end': return { t: 'end' }
    default: return null
  }
}

