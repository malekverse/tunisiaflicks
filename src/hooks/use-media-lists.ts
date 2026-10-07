"use client"
import { useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { addToWatchHistory } from '@/src/lib/user-content'

type MediaInfo = {
  id: string
  title?: string
  poster_path?: string | null
  media_type: 'movie' | 'tv'
}

/**
 * Records a title in the watch history (signed-in users only; guests can still watch). For TV,
 * pass the episode so "Continue watching" can resume it. Favorites and "watch later" live in the
 * shared library store (src/store/library.ts).
 */
export function useMarkWatched({ id, title, poster_path, media_type }: MediaInfo) {
  const { data: session } = useSession()
  return useCallback((episodeInfo?: { season: number, episode: number }) => {
    if (!session || !title) return false
    addToWatchHistory({ id, title, poster_path: poster_path ?? undefined, media_type, added_at: new Date(), ...episodeInfo })
      .catch((error) => console.error('Failed to add to watch history:', error))
    return true
  }, [session, id, title, poster_path, media_type])
}
