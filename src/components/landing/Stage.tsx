"use client"
import { createContext, useContext, useEffect, useState, type RefObject } from 'react'
import { useInView } from 'framer-motion'

// The landing page's room: a fixed backdrop behind every section whose colour and light follow the
// section crossing the middle of the screen. Each section says how the room should look while it's
// there (useStageLook); the backdrop eases from one look to the next (background-color transitions
// on the compositor-friendly layers, no gradient repaint). The landing's take on the site's room
// light: here the room changes from black to Sidi Bou Said blue, lantern gold and back.

/** `base`: the room's colour (CSS). `light`: the glow at the top ('r g b'), or null for none. */
export type Look = { base: string, light: string | null }

const DARK: Look = { base: '#000000', light: '255 36 20' }

const StageContext = createContext<(look: Look) => void>(() => {})

export function LandingStage({ children }: { children: React.ReactNode }) {
  const [look, setLook] = useState<Look>(DARK)
  return (
    <StageContext.Provider value={setLook}>
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-[1] overflow-hidden">
        <div className="absolute inset-0 transition-colors duration-1000 ease-out" style={{ backgroundColor: look.base }} />
        <div
          className="absolute inset-x-0 top-0 h-[70vh] transition-[background-color,opacity] duration-1000 ease-out"
          style={{
            backgroundColor: look.light ? `rgb(${look.light})` : 'transparent',
            opacity: look.light ? 0.28 : 0,
            maskImage: 'radial-gradient(110% 80% at 50% -10%, #000 0%, rgb(0 0 0 / 0.35) 45%, transparent 75%)',
            WebkitMaskImage: 'radial-gradient(110% 80% at 50% -10%, #000 0%, rgb(0 0 0 / 0.35) 45%, transparent 75%)',
          }}
        />
      </div>
      {children}
    </StageContext.Provider>
  )
}

/** Sets the room to `look` while `ref`'s section crosses the middle of the screen. */
export function useStageLook(ref: RefObject<Element>, look: Look) {
  const set = useContext(StageContext)
  const here = useInView(ref, { margin: '-50% 0px -50% 0px' })
  const { base, light } = look
  useEffect(() => {
    if (here) set({ base, light })
  }, [here, base, light, set])
  return here
}

export const LOOKS = {
  dark: DARK,
  quiet: { base: '#000000', light: null },
  tunisia: { base: '#020b1f', light: '30 110 255' },
  ramadan: { base: '#120b02', light: '245 190 80' },
} satisfies Record<string, Look>
