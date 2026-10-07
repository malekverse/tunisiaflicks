"use client"
import { useCallback, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import type { ProfilesResponse } from '@/src/lib/models/Profile'

// The shell (top bar, tab bar, profile gate) and pages all ask at once: share one request.
let inflight: Promise<ProfilesResponse | null> | null = null

function fetchProfiles(force = false) {
  if (!inflight || force) {
    const request: Promise<ProfilesResponse | null> = fetch('/api/profiles', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .catch((error) => {
        console.error('Error loading profiles:', error)
        return null
      })
    inflight = request
    // Forget it once settled, so the next mount (another page) gets fresh data.
    request.finally(() => setTimeout(() => { if (inflight === request) inflight = null }, 1000))
  }
  return inflight
}

/** The signed-in account's profiles and the one active on this device (null for guests / while loading). */
export function useProfiles(initial: ProfilesResponse | null = null) {
  const { status } = useSession()
  const [data, setData] = useState<ProfilesResponse | null>(initial)

  const reload = useCallback(async () => {
    setData(await fetchProfiles(true))
  }, [])

  useEffect(() => {
    let cancelled = false
    if (status === 'authenticated') fetchProfiles().then((value) => { if (!cancelled) setData(value) })
    else if (status === 'unauthenticated') setData(null)
    return () => { cancelled = true }
  }, [status])

  const active = data?.profiles.find((profile) => profile.id === data.activeId) ?? null
  return { data, active, reload }
}

export type SelectResult = { ok: boolean, error?: string, needsPassword?: boolean }

/** Makes `profileId` the active profile on this device. Leaving a Kids profile needs the account password. */
export async function selectProfile(profileId: string, password?: string): Promise<SelectResult> {
  try {
    const response = await fetch('/api/profiles/active', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileId, password }),
    })
    if (response.ok) return { ok: true }
    const body = await response.json().catch(() => ({}))
    return { ok: false, error: body.error ?? 'Could not switch profile', needsPassword: body.needsPassword }
  } catch {
    return { ok: false, error: 'Could not switch profile, please try again' }
  }
}

/** Forgets the profile picked on this device (on sign-out, so the next account starts at the picker). */
export const forgetProfile = () => fetch('/api/profiles/active', { method: 'DELETE' }).catch(() => undefined)

/** Only same-site paths are followed after picking a profile. */
export const safeNext = (value: string | null | undefined) =>
  value && /^\/(?![/\\])/.test(value) && !value.startsWith('/profiles') ? value : '/'
