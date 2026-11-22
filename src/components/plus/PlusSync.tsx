"use client"
// Keeps this device's TunisiaFlicks+ accent in step with the account, once per visit: the accent
// chosen on another device arrives here, and once Plus has ended the site goes back to its red.
// (The layout paints the accent from a cookie, with no database read on every page.)
import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { ACCENT_COOKIE, isAccent, type Accent } from '@/src/lib/plus-rules'

const CHECKED = 'tf-plus-synced'

function readCookie(): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${ACCENT_COOKIE}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

/** Paints an accent right away and remembers it for the next pages ('red': none). */
export function applyAccent(accent: Accent) {
  const root = document.documentElement
  if (accent === 'red') {
    delete root.dataset.accent
    document.cookie = `${ACCENT_COOKIE}=; path=/; max-age=0; samesite=lax`
  } else {
    root.dataset.accent = accent
    document.cookie = `${ACCENT_COOKIE}=${accent}; path=/; max-age=${365 * 86400}; samesite=lax`
  }
}

export default function PlusSync() {
  const { data: session, status } = useSession()
  const userId = session?.user?.id ?? null

  useEffect(() => {
    if (status === 'loading') return
    if (status === 'unauthenticated') {
      // Signed out: the site's own colour.
      if (readCookie()) applyAccent('red')
      return
    }
    try {
      if (sessionStorage.getItem(CHECKED) === userId) return
    } catch { /* private mode: check anyway */ }
    let cancelled = false
    fetch('/api/plus?light=1', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((state) => {
        if (cancelled || !state) return
        const wanted: Accent = state.active && isAccent(state.accent) ? state.accent : 'red'
        if ((readCookie() ?? 'red') !== wanted) applyAccent(wanted)
        try { sessionStorage.setItem(CHECKED, userId ?? '') } catch { /* fine */ }
      })
      .catch(() => undefined)
    return () => { cancelled = true }
  }, [status, userId])

  return null
}
