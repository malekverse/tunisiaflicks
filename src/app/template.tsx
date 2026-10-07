"use client"
import { useEffect } from 'react'

// Set after the first page has painted: the very first render must not start hidden (that would
// delay the LCP until hydration), but every navigation after it eases in.
let navigated = false

/**
 * Wraps every page and is re-created on each navigation. Pages arrive with a short fade and lift.
 * It is a CSS animation on purpose: it runs off the main thread while the new page is still busy.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  const animate = navigated
  useEffect(() => { navigated = true }, [])
  return <div className={animate ? 'animate-page-in' : undefined}>{children}</div>
}
