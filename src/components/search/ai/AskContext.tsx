"use client"
import { createContext, useContext } from 'react'

const AskAvailable = createContext(false)

/** Set by the search layout (server): Ask is on, the profile isn't Kids, and this isn't TV mode. */
export function AskAvailableProvider({ value, children }: { value: boolean, children: React.ReactNode }) {
  return <AskAvailable.Provider value={value}>{children}</AskAvailable.Provider>
}

/** Whether the search page offers Ask. */
export const useAskAvailable = () => useContext(AskAvailable)
