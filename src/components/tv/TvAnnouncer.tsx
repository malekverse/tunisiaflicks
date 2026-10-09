"use client"
// For screen readers on a TV (TalkBack, VoiceView): says which page opened after each move, since
// focus jumps into the page instead of following a link's text. Toasts are sized for the sofa in
// tv.css (Sonner's own elements).
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

export default function TvAnnouncer() {
  const pathname = usePathname()
  const [message, setMessage] = useState('')

  useEffect(() => {
    // Wait for the new page's title.
    const timer = window.setTimeout(() => setMessage(document.title.replace(/\s*\|\s*TunisiaFlicks$/, '')), 600)
    return () => window.clearTimeout(timer)
  }, [pathname])

  return (
    <div aria-live="polite" aria-atomic="true" className="sr-only">
      {message}
    </div>
  )
}
