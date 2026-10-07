"use client"
import { useCallback, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'

export type Account = {
  name: string | null
  image: string | null
  email: string | null
  emailVerified: boolean
  hasPassword: boolean
}

// One /api/user request per page load, shared by every component that needs the account.
let pending: Promise<Account | null> | null = null
let pendingFor: string | undefined

function loadAccount(userId: string) {
  if (!pending || pendingFor !== userId) {
    pendingFor = userId
    pending = fetch('/api/user')
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => data?.user ?? null)
      .catch(() => null)
  }
  return pending
}

/** The signed-in user's account details (null while loading or when signed out). */
export function useAccount() {
  const { data: session } = useSession()
  const userId = session?.user?.id
  const [account, setAccount] = useState<Account | null>(null)

  useEffect(() => {
    if (!userId) {
      setAccount(null)
      return
    }
    let cancelled = false
    loadAccount(userId).then((value) => { if (!cancelled) setAccount(value) })
    return () => { cancelled = true }
  }, [userId])

  /** Re-fetch after a change (verification, password set...). */
  const refresh = useCallback(async () => {
    if (!userId) return
    pending = null
    setAccount(await loadAccount(userId))
  }, [userId])

  return { account, refresh }
}
