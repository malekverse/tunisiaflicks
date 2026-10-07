"use client"
import { useEffect } from 'react'
import { useLibrarySync } from '@/src/store/library'
import { useProfileGate } from './use-shell-account'

/**
 * App-wide side effects with no UI: send signed-in users to "Who's watching?" until a profile is
 * picked, and load their lists once so every card knows what's in them.
 */
export default function ShellEffects() {
  useProfileGate()
  useLibrarySync()
  // Marks the page as interactive (handy for automated checks and CSS that needs JS).
  useEffect(() => { document.documentElement.dataset.hydrated = 'true' }, [])
  return null
}
