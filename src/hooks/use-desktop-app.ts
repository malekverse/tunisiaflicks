"use client"
// The TunisiaFlicks desktop app (desktop/ in this repo) opens this site in its own window and runs
// the ad-free local player next to it. Its preload script puts a small bridge on window; this reads
// it. In a browser there is no bridge, and everything here is null / false.
import { useEffect, useMemo, useState } from 'react'
import type { StreamProvider } from '@/src/lib/stream-providers'

type DesktopBridge = { present?: boolean, player?: unknown }

/** The name the local player has in the player's source bar. */
export const LOCAL_PLAYER_SOURCE = 'TunisiaFlicks'

/** Inside the desktop app? (Browser only; false on the server.) */
export function isDesktopApp(): boolean {
  if (typeof window === 'undefined') return false
  return (window as { tunisiaflicksDesktop?: DesktopBridge }).tunisiaflicksDesktop?.present === true
}

/** The local player's address (http://127.0.0.1:<port>), or null outside the desktop app. */
function localPlayerOrigin(): string | null {
  if (typeof window === 'undefined') return null
  const player = (window as { tunisiaflicksDesktop?: DesktopBridge }).tunisiaflicksDesktop?.player
  return typeof player === 'string' && /^http:\/\/127\.0\.0\.1:\d{2,5}$/.test(player) ? player : null
}

export type LocalMedia = { type: 'movie', id: string } | { type: 'tv', id: string, season: number, episode: number }

/**
 * The stream sources, with the desktop app's local player first when there is one (it's ad-free
 * and runs on the viewer's machine). Known only after mount, like the remembered source, so the
 * server render and the first client render agree.
 */
export function useWithLocalPlayer(services: StreamProvider[], media: LocalMedia | undefined): StreamProvider[] {
  const [origin, setOrigin] = useState<string | null>(null)
  useEffect(() => setOrigin(localPlayerOrigin()), [])

  const type = media?.type
  const id = media?.id
  const season = media?.type === 'tv' ? media.season : 0
  const episode = media?.type === 'tv' ? media.episode : 0
  return useMemo(() => {
    if (!origin || !type || !id || !/^\d+$/.test(id)) return services
    const path = type === 'movie' ? `/embed/movie/${id}` : `/embed/tv/${id}/${season}/${episode}`
    return [{ name: LOCAL_PLAYER_SOURCE, url: `${origin}${path}` }, ...services]
  }, [services, origin, type, id, season, episode])
}
