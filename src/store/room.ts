// The room light: the soft glow behind the page, in the colour of whatever the viewer is looking
// at. Pages set a base colour (the billboard slide, the detail page's poster); hovering a title
// briefly takes over. Colours are "r g b" triplets (see use-ambient-color).
import { create } from 'zustand'

type RoomLight = {
  base: string | null
  hover: string | null
  setBase: (color: string | null) => void
  setHover: (color: string | null) => void
}

export const useRoom = create<RoomLight>()((set) => ({
  base: null,
  hover: null,
  setBase: (base) => set({ base }),
  setHover: (hover) => set({ hover }),
}))
