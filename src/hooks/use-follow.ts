"use client"
import { useCallback, useEffect } from 'react'
import { create } from 'zustand'
import { useSession } from 'next-auth/react'
import { toast } from '@/src/hooks/use-toast'
import { useT } from '@/src/components/I18nProvider'
import type { FollowItem, FollowMediaType } from '@/src/lib/models/Follow'

const keyOf = (mediaType: FollowMediaType, id: string) => `${mediaType}:${id}`

type FollowStore = {
  userId: string | null
  keys: Set<string>
  pending: Set<string>
  /** Loads the signed-in user's follows once (every card / hero shares the same list). */
  load: (userId: string | null) => Promise<void>
  /** Follows or unfollows a title; optimistic, rolled back if the request fails. */
  setFollowing: (mediaType: FollowMediaType, id: string, follow: boolean) => Promise<void>
}

const withKey = (set: Set<string>, key: string, on: boolean) => {
  const next = new Set(set)
  if (on) next.add(key)
  else next.delete(key)
  return next
}

export const useFollowStore = create<FollowStore>()((set, get) => ({
  userId: null,
  keys: new Set(),
  pending: new Set(),
  load: async (userId) => {
    if (get().userId === userId) return
    set({ userId, keys: new Set() })
    if (!userId) return
    try {
      const response = await fetch('/api/follows')
      if (!response.ok) return
      const { items } = (await response.json()) as { items: FollowItem[] }
      if (get().userId !== userId) return
      set({ keys: new Set(items.map((item) => keyOf(item.media_type, item.id))) })
    } catch (error) {
      console.error('Failed to load follows:', error)
    }
  },
  setFollowing: async (mediaType, id, follow) => {
    const key = keyOf(mediaType, id)
    set((state) => ({ keys: withKey(state.keys, key, follow), pending: withKey(state.pending, key, true) }))
    try {
      const response = follow
        ? await fetch('/api/follows', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ media_type: mediaType, id }),
        })
        : await fetch(`/api/follows?media_type=${mediaType}&id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      // Unfollowing something already gone is fine.
      if (!response.ok && !(response.status === 404 && !follow)) {
        const error = await response.json().catch(() => null)
        throw new Error(error?.error || 'Request failed')
      }
    } catch (error) {
      set((state) => ({ keys: withKey(state.keys, key, !follow) }))
      throw error
    } finally {
      set((state) => ({ pending: withKey(state.pending, key, false) }))
    }
  },
}))

/** Follow state for one title: "Notify me" for movies, "Follow" (new episodes) for TV shows. */
export function useFollow(mediaType: FollowMediaType, id: string | undefined) {
  const { data: session, status } = useSession()
  const t = useT()
  const userId = session?.user?.id ?? null
  const load = useFollowStore((state) => state.load)
  const setFollowing = useFollowStore((state) => state.setFollowing)
  const key = id ? keyOf(mediaType, id) : ''
  const following = useFollowStore((state) => state.keys.has(key))
  const busy = useFollowStore((state) => state.pending.has(key))

  useEffect(() => {
    if (status !== 'loading') load(userId)
  }, [status, userId, load])

  const toggle = useCallback(async (title?: string) => {
    if (!id || busy) return
    if (!userId) {
      toast({ title: t('common.loginRequired'), description: t(mediaType === 'movie' ? 'alerts.loginMovie' : 'alerts.loginTv'), variant: "destructive" })
      return
    }
    const name = title || t('alerts.thisTitle')
    try {
      await setFollowing(mediaType, id, !following)
      toast(following
        ? { title: t('alerts.offTitle'), description: t('alerts.offDesc', { title: name }) }
        : mediaType === 'movie'
          ? { title: t('alerts.movieOnTitle'), description: t('alerts.movieOnDesc', { title: name }) }
          : { title: t('alerts.following'), description: t('alerts.tvOnDesc', { title: name }) })
    } catch (error) {
      console.error('Failed to update follow:', error)
      toast({ title: t('common.error'), description: t('alerts.updateFailed'), variant: "destructive" })
    }
  }, [id, busy, userId, mediaType, following, setFollowing, t])

  return { following, busy, toggle }
}
