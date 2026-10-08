// This browser's identity in swipe rooms (no account needed).
export type SwipeCredentials = { id: string, secret: string }
export type SavedRoom = { code: string, savedAt: number }

const ROOM_PREFIX = 'tf-swipe:'
const roomKey = (code: string) => `${ROOM_PREFIX}${code}`
const NAME_KEY = 'tf-swipe-name'
// Rooms live 24 hours on the server (TTL index); older entries point at rooms that are gone.
const ROOM_TTL_MS = 24 * 3600 * 1000

function read(key: string) {
  try { return localStorage.getItem(key) } catch { return null }
}
function write(key: string, value: string) {
  try { localStorage.setItem(key, value) } catch { /* private mode: works for this page only */ }
}
function remove(key: string) {
  try { localStorage.removeItem(key) } catch { /* nothing to clean up */ }
}

function parse(raw: string | null): (SwipeCredentials & { savedAt?: number }) | null {
  try {
    const value = JSON.parse(raw ?? 'null')
    return value && typeof value.id === 'string' && typeof value.secret === 'string' ? value : null
  } catch {
    return null
  }
}

export function getCredentials(code: string): SwipeCredentials | null {
  const value = parse(read(roomKey(code)))
  return value ? { id: value.id, secret: value.secret } : null
}
export const saveCredentials = (code: string, credentials: SwipeCredentials) =>
  write(roomKey(code), JSON.stringify({ id: credentials.id, secret: credentials.secret, savedAt: Date.now() }))
/** Drops a room this browser was in (it expired or never existed). */
export const forgetRoom = (code: string) => remove(roomKey(code))

/**
 * Rooms this browser joined in the last 24 hours, newest first. Entries that are too old to still
 * exist are cleaned up on the way.
 */
export function listRooms(limit = 4): SavedRoom[] {
  const rooms: SavedRoom[] = []
  try {
    const now = Date.now()
    const keys = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index))
    for (const key of keys) {
      if (!key?.startsWith(ROOM_PREFIX)) continue
      const code = key.slice(ROOM_PREFIX.length)
      const value = parse(read(key))
      if (!value || typeof value.savedAt !== 'number') continue
      if (now - value.savedAt > ROOM_TTL_MS) remove(key)
      else rooms.push({ code, savedAt: value.savedAt })
    }
  } catch {
    return []
  }
  return rooms.sort((a, b) => b.savedAt - a.savedAt).slice(0, limit)
}

export const getSavedName = () => read(NAME_KEY) ?? ''
export const saveName = (name: string) => write(NAME_KEY, name)
