// This browser's identity in swipe rooms (no account needed).
export type SwipeCredentials = { id: string, secret: string }

const roomKey = (code: string) => `tf-swipe:${code}`
const NAME_KEY = 'tf-swipe-name'

function read(key: string) {
  try { return localStorage.getItem(key) } catch { return null }
}
function write(key: string, value: string) {
  try { localStorage.setItem(key, value) } catch { /* private mode: works for this page only */ }
}

export function getCredentials(code: string): SwipeCredentials | null {
  try {
    const value = JSON.parse(read(roomKey(code)) ?? 'null')
    return value && typeof value.id === 'string' && typeof value.secret === 'string' ? value : null
  } catch {
    return null
  }
}
export const saveCredentials = (code: string, credentials: SwipeCredentials) => write(roomKey(code), JSON.stringify(credentials))
export const getSavedName = () => read(NAME_KEY) ?? ''
export const saveName = (name: string) => write(NAME_KEY, name)
