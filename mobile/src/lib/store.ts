// What the app keeps on the device: the language, Kids mode, My List, what was watched, and recent
// searches. Nothing leaves the phone (accounts come later).
import AsyncStorage from '@react-native-async-storage/async-storage'
import { getLocales } from 'expo-localization'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { Locale } from '@/i18n/strings'
import type { Kind } from './api'

export type SavedTitle = {
  id: number
  kind: Kind
  title: string
  poster: string | null
  backdrop: string | null
  year?: string
}

export type Watched = SavedTitle & {
  season?: number
  episode?: number
  /** The source it played from last time (tried first next time). */
  source?: string
  at: number
}

type State = {
  locale: Locale
  kids: boolean
  myList: SavedTitle[]
  history: Watched[]
  searches: string[]
  setLocale: (locale: Locale) => void
  setKids: (kids: boolean) => void
  toggleMyList: (title: SavedTitle) => void
  removeFromList: (kind: Kind, id: number) => void
  recordWatch: (entry: Omit<Watched, 'at'>) => void
  clearHistory: () => void
  addSearch: (query: string) => void
  clearSearches: () => void
}

/** The device's language when it's one of ours (Arabic for any Arabic), English otherwise. */
function deviceLocale(): Locale {
  for (const locale of getLocales()) {
    const code = locale.languageCode?.toLowerCase()
    if (code === 'fr') return 'fr'
    if (code === 'ar') return 'ar'
    if (code === 'en') return 'en'
  }
  return 'en'
}

const same = (a: { kind: Kind, id: number }, b: { kind: Kind, id: number }) => a.kind === b.kind && a.id === b.id

export const useStore = create<State>()(
  persist(
    (set) => ({
      locale: deviceLocale(),
      kids: false,
      myList: [],
      history: [],
      searches: [],
      setLocale: (locale) => set({ locale }),
      setKids: (kids) => set({ kids }),
      toggleMyList: (title) => set((state) => ({
        myList: state.myList.some((saved) => same(saved, title))
          ? state.myList.filter((saved) => !same(saved, title))
          : [{ id: title.id, kind: title.kind, title: title.title, poster: title.poster, backdrop: title.backdrop, year: title.year }, ...state.myList],
      })),
      removeFromList: (kind, id) => set((state) => ({ myList: state.myList.filter((saved) => !(saved.kind === kind && saved.id === id)) })),
      recordWatch: (entry) => set((state) => ({
        history: [{ ...entry, at: Date.now() }, ...state.history.filter((watched) => !same(watched, entry))].slice(0, 60),
      })),
      clearHistory: () => set({ history: [] }),
      addSearch: (query) => set((state) => {
        const q = query.trim()
        if (q.length < 2) return state
        return { searches: [q, ...state.searches.filter((s) => s.toLowerCase() !== q.toLowerCase())].slice(0, 8) }
      }),
      clearSearches: () => set({ searches: [] }),
    }),
    {
      name: 'tunisiaflicks',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      partialize: ({ locale, kids, myList, history, searches }) => ({ locale, kids, myList, history, searches }),
    },
  ),
)

export const useInMyList = (kind: Kind, id: number) => useStore((state) => state.myList.some((saved) => saved.kind === kind && saved.id === id))
