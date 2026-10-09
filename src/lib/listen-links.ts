// Where a soundtrack can be listened to in full: Deezer (the album itself), and searches on
// Anghami, Spotify and YouTube Music. Pure helpers, safe on the server and the client.

export type ListenService = 'deezer' | 'anghami' | 'spotify' | 'ytmusic'

export const LISTEN_SERVICES: readonly ListenService[] = ['deezer', 'anghami', 'spotify', 'ytmusic']

/** Brand names stay as they are in every language. */
export const SERVICE_NAMES: Record<ListenService, string> = { deezer: 'Deezer', anghami: 'Anghami', spotify: 'Spotify', ytmusic: 'YouTube Music' }

/** localStorage: the service the viewer last opened, which then comes first. */
export const LAST_SERVICE_KEY = 'tf-listen-service'

export const isListenService = (value: unknown): value is ListenService => typeof value === 'string' && (LISTEN_SERVICES as readonly string[]).includes(value)

/** Deezer first (the previews come from it), Anghami first in Arabic and Derja; the last one used before all. */
export function listenOrder(locale: string, lastUsed?: string | null): ListenService[] {
  const base: ListenService[] = locale === 'ar' || locale === 'tn' ? ['anghami', 'deezer', 'spotify', 'ytmusic'] : ['deezer', 'anghami', 'spotify', 'ytmusic']
  return isListenService(lastUsed) ? [lastUsed, ...base.filter((service) => service !== lastUsed)] : base
}

/** The page to open: Deezer's album when we have it, otherwise a search for `query`. */
export function listenUrl(service: ListenService, query: string, deezerAlbum?: string | null): string {
  const q = encodeURIComponent(query.trim().slice(0, 140))
  switch (service) {
    case 'deezer': return deezerAlbum && /^https:\/\/www\.deezer\.com\/album\/\d+$/.test(deezerAlbum) ? deezerAlbum : `https://www.deezer.com/search/${q}`
    case 'anghami': return `https://play.anghami.com/search/${q}`
    case 'spotify': return `https://open.spotify.com/search/${q}`
    case 'ytmusic': return `https://music.youtube.com/search?q=${q}`
  }
}

/** What to search for when there is no album: the title, "soundtrack", and the composer. */
export const soundtrackQuery = (title: string, composer?: string | null) => [title, 'soundtrack', composer].filter(Boolean).join(' ')
