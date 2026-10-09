// TV mode for client components: whether this request is in TV mode (cookie tf-tv=1, read by the
// root layout) and whether the page runs inside the Android TV app (user agent 'TunisiaFlicksTV/').
// Read it with useTvMode() from src/hooks/use-tv-mode.ts. Real, not a stub: tv-mode owns it from
// wave 2 and keeps the signature.
"use client"
import React, { createContext, useMemo } from 'react'

type TvModeValue = { tv: boolean; inApp: boolean }

export const TvModeContext: React.Context<TvModeValue | null> = createContext<TvModeValue | null>(null)

export default function TvModeProvider({ tv, inApp, children }: { tv: boolean; inApp: boolean; children: React.ReactNode }): JSX.Element {
  const value = useMemo(() => ({ tv, inApp }), [tv, inApp])
  return <TvModeContext.Provider value={value}>{children}</TvModeContext.Provider>
}
