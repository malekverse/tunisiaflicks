"use client"
// The signed-in account's supporter status (GET/PATCH /api/supporters/me), for Settings #supporter
// and the code on /support. 'hidden' for guests, Kids profiles and before a profile is picked.
import { useCallback, useEffect, useState } from 'react'

export type SupporterState = {
  open: boolean
  code: string | null
  supporter: { since: string; badgePublic: boolean; listed: boolean; listName: string } | null
}

export type SupporterStatus = 'loading' | 'hidden' | 'error' | 'ready'

export function useSupporter() {
  const [status, setStatus] = useState<SupporterStatus>('loading')
  const [state, setState] = useState<SupporterState | null>(null)

  const load = useCallback(async () => {
    setStatus('loading')
    try {
      const response = await fetch('/api/supporters/me', { cache: 'no-store' })
      if (response.status === 401 || response.status === 403 || response.status === 409) return setStatus('hidden')
      if (!response.ok) throw new Error(String(response.status))
      setState(await response.json())
      setStatus('ready')
    } catch {
      setStatus('error')
    }
  }, [])

  useEffect(() => { void load() }, [load])

  /** Saves some preferences; resolves false (and keeps the old state) when it fails. */
  const save = useCallback(async (prefs: Partial<Pick<NonNullable<SupporterState['supporter']>, 'badgePublic' | 'listed' | 'listName'>>) => {
    const before = state
    if (before?.supporter) setState({ ...before, supporter: { ...before.supporter, ...prefs } })
    try {
      const response = await fetch('/api/supporters/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs),
      })
      if (!response.ok) throw new Error(String(response.status))
      setState(await response.json())
      return true
    } catch {
      setState(before)
      return false
    }
  }, [state])

  return { status, state, load, save }
}
