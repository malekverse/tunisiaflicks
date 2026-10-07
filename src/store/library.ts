"use client"
// The viewer's favorites and "watch later" lists, loaded once per session and shared by every
// card, billboard and preview, so a ✓ shows wherever a title appears and a toggle anywhere updates
// everywhere at once (optimistically; rolled back if the server says no).
import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { create } from 'zustand'
import {
  addToFavorites, getFavorites, getSavedItems, removeFromFavorites, removeFromSaved, saveForLater,
} from '@/src/lib/user-content'

export type LibraryList = 'favorites' | 'saved'
export type LibraryItem = { id: string, title: string, poster_path?: string | null, media_type: 'movie' | 'tv' }

const key = (item: { id: string | number, media_type: string }) => `${item.media_type}:${item.id}`

type LibraryState = {
  status: 'idle' | 'loading' | 'ready'
  favorites: Set<string>
  saved: Set<string>
  load: () => Promise<void>
  reset: () => void
  /** Adds or removes; resolves to the new state (true = in the list), or throws. */
  toggle: (list: LibraryList, item: LibraryItem) => Promise<boolean>
}

export const useLibraryStore = create<LibraryState>()((set, get) => ({
  status: 'idle',
  favorites: new Set(),
  saved: new Set(),
  load: async () => {
    if (get().status !== 'idle') return
    set({ status: 'loading' })
    const [favorites, saved] = await Promise.all([getFavorites(), getSavedItems()])
    set({
      status: 'ready',
      favorites: new Set((favorites as any[]).map(key)),
      saved: new Set((saved as any[]).map(key)),
    })
  },
  reset: () => set({ status: 'idle', favorites: new Set(), saved: new Set() }),
  toggle: async (list, item) => {
    const id = key(item)
    const had = get()[list].has(id)
    const update = (present: boolean) => set((state) => {
      const next = new Set(state[list])
      if (present) next.add(id)
      else next.delete(id)
      return { [list]: next } as Pick<LibraryState, LibraryList>
    })
    update(!had)
    try {
      if (had) await (list === 'favorites' ? removeFromFavorites(item.id) : removeFromSaved(item.id))
      else {
        const entry = { id: item.id, title: item.title, poster_path: item.poster_path ?? undefined, media_type: item.media_type, added_at: new Date() }
        await (list === 'favorites' ? addToFavorites(entry) : saveForLater(entry))
      }
      return !had
    } catch (error) {
      update(had)
      throw error
    }
  },
}))

/** Loads the lists once the viewer is signed in (and forgets them on sign-out). */
export function useLibrarySync() {
  const { status } = useSession()
  const load = useLibraryStore((state) => state.load)
  const reset = useLibraryStore((state) => state.reset)
  useEffect(() => {
    if (status === 'authenticated') load()
    else if (status === 'unauthenticated') reset()
  }, [status, load, reset])
}

/** Is this title in the list? */
export function useInLibrary(list: LibraryList, item: { id: string | number, media_type: string }) {
  return useLibraryStore((state) => state[list].has(key(item)))
}
