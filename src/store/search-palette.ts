import { create } from 'zustand'

/** Open state of the ⌘K search palette (opened from the top bar, "/" or Ctrl/⌘+K). */
export const useSearchPalette = create<{ open: boolean, setOpen: (open: boolean) => void }>()((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}))
