// "Peek" at a title without leaving the row: the hover preview card on desktop, the quick-view
// sheet after a long press on touch screens. One at a time, app-wide (see components/media/PeekLayer).
import { create } from 'zustand'

export type PeekItem = {
  id: string
  kind: 'movie' | 'tv'
  title: string
  poster?: string | null
  backdrop?: string | null
  rating?: number
  date?: string | null
  genreIds?: number[]
  overview?: string
}

type PeekState = {
  item: PeekItem | null
  /** The card's box on screen (hover mode), to grow the preview out of it. */
  rect: DOMRect | null
  mode: 'hover' | 'sheet' | null
  /** When the last preview closed: moving along a row re-opens the next one without the delay. */
  closedAt: number
  open: (item: PeekItem, mode: 'hover' | 'sheet', rect?: DOMRect) => void
  close: () => void
}

export const usePeek = create<PeekState>()((set, get) => ({
  item: null,
  rect: null,
  mode: null,
  closedAt: 0,
  open: (item, mode, rect) => set({ item, mode, rect: rect ?? null }),
  close: () => {
    if (get().item) set({ item: null, mode: null, rect: null, closedAt: Date.now() })
  },
}))
