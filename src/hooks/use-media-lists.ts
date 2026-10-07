"use client"
import { useCallback, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { toast } from '@/src/hooks/use-toast'
import {
  addToFavorites, removeFromFavorites, saveForLater, removeFromSaved, addToWatchHistory, isInUserList,
} from '@/src/lib/user-content'
import { useT } from '@/src/components/I18nProvider'

type MediaInfo = {
  id: string
  title?: string
  poster_path?: string | null
  media_type: 'movie' | 'tv'
}

/** Favorite / bookmark / watch-history state for one movie or show (shared by both detail pages). */
export function useMediaLists({ id, title, poster_path, media_type }: MediaInfo) {
  const { data: session } = useSession()
  const t = useT()
  const userId = session?.user?.id
  const [isFavorite, setIsFavorite] = useState(false)
  const [isSaved, setIsSaved] = useState(false)

  // Load the initial state once the title is known and the user is signed in.
  useEffect(() => {
    if (!userId || !title) {
      setIsFavorite(false)
      setIsSaved(false)
      return
    }
    let cancelled = false
    Promise.all([isInUserList('favorites', id), isInUserList('saved', id)]).then(([favorite, saved]) => {
      if (cancelled) return
      setIsFavorite(favorite)
      setIsSaved(saved)
    })
    return () => {
      cancelled = true
    }
  }, [userId, id, title])

  const requireLogin = useCallback((description: string) => {
    if (session) return true
    toast({ title: t('common.loginRequired'), description, variant: "destructive" })
    return false
  }, [session, t])

  const item = () => ({ id, title: title!, poster_path: poster_path ?? undefined, media_type, added_at: new Date() })

  const toggleFavorite = useCallback(async () => {
    if (!requireLogin(t('toast.loginToFavorite')) || !title) return
    try {
      if (isFavorite) {
        await removeFromFavorites(id)
        setIsFavorite(false)
        toast({ title: t('toast.removedFavorites'), description: t('toast.removedFavoritesDesc', { title }) })
      } else {
        await addToFavorites(item())
        setIsFavorite(true)
        toast({ title: t('toast.addedFavorites'), description: t('toast.addedFavoritesDesc', { title }) })
      }
    } catch (error) {
      console.error('Failed to update favorites:', error)
      toast({ title: t('common.error'), description: t('toast.updateFavoritesFailed'), variant: "destructive" })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requireLogin, isFavorite, id, title, poster_path, media_type, t])

  const toggleSaved = useCallback(async () => {
    if (!requireLogin(t('toast.loginToSave')) || !title) return
    try {
      if (isSaved) {
        await removeFromSaved(id)
        setIsSaved(false)
        toast({ title: t('toast.removedSaved'), description: t('toast.removedSavedDesc', { title }) })
      } else {
        await saveForLater(item())
        setIsSaved(true)
        toast({ title: t('toast.savedForLater'), description: t('toast.savedForLaterDesc', { title }) })
      }
    } catch (error) {
      console.error('Failed to update saved list:', error)
      toast({ title: t('common.error'), description: t('toast.updateSavedFailed'), variant: "destructive" })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requireLogin, isSaved, id, title, poster_path, media_type, t])

  /**
   * Records the title in the watch history (signed-in users only; guests can still watch).
   * For TV, pass the episode so "Continue Watching" can resume it.
   */
  const markWatched = useCallback((episodeInfo?: { season: number, episode: number }) => {
    if (!session || !title) return false
    addToWatchHistory({ ...item(), ...episodeInfo }).catch((error) => console.error('Failed to add to watch history:', error))
    return true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, id, title, poster_path, media_type])

  return { isFavorite, isSaved, toggleFavorite, toggleSaved, markWatched }
}
