"use client"
// The active profile's e-mail settings (GET/PUT /api/digest), shared by the "By email" group in
// Settings > Notifications and the release-e-mail switch in Settings > Following: one request
// serves both, and a change made in one shows in the other.
import { useEffect } from 'react'
import { create } from 'zustand'
import type { DigestChange, DigestState } from '@/src/lib/digest/state'
import type { Translate } from '@/src/lib/i18n/translate'

export type DigestStatus = 'idle' | 'loading' | 'ready' | 'error' | 'signedOut'
export type DigestSaveResult = { ok: boolean; code?: 'unverified' | 'unavailable' | 'limited' | 'failed' }

type Store = {
  status: DigestStatus
  state: DigestState | null
  /** Which fields are being saved right now. */
  saving: Partial<Record<keyof DigestChange, boolean>>
  load: (force?: boolean) => Promise<void>
  save: (change: DigestChange) => Promise<DigestSaveResult>
}

let inflight: Promise<void> | null = null

export const useDigestStore = create<Store>((set, get) => ({
  status: 'idle',
  state: null,
  saving: {},
  load: async (force = false) => {
    if (inflight) return inflight
    if (!force && get().status === 'ready') return
    set((current) => ({ status: current.state ? current.status : 'loading' }))
    inflight = (async () => {
      try {
        const response = await fetch('/api/digest', { cache: 'no-store' })
        if (response.status === 401) return set({ status: 'signedOut', state: null })
        if (!response.ok) throw new Error(String(response.status))
        set({ status: 'ready', state: await response.json() })
      } catch {
        set((current) => ({ status: current.state ? 'ready' : 'error' }))
      } finally {
        inflight = null
      }
    })()
    return inflight
  },
  save: async (change) => {
    const before = get().state
    if (!before) return { ok: false, code: 'failed' }
    const keys = Object.keys(change) as (keyof DigestChange)[]
    // Shown at once; put back if the server says no.
    set((current) => ({
      state: { ...before, ...change, ...(change.enabled ? { pausedReason: null } : {}) },
      saving: { ...current.saving, ...Object.fromEntries(keys.map((key) => [key, true])) },
    }))
    const done = () => set((current) => ({ saving: Object.fromEntries(Object.entries(current.saving).filter(([key]) => !keys.includes(key as keyof DigestChange))) }))
    try {
      const response = await fetch('/api/digest', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(change),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) {
        set({ state: before })
        const code = body?.code === 'unverified' || body?.code === 'unavailable' ? body.code : response.status === 429 ? 'limited' : 'failed'
        return { ok: false, code }
      }
      set({ state: body as DigestState, status: 'ready' })
      return { ok: true }
    } catch {
      set({ state: before })
      return { ok: false, code: 'failed' }
    } finally {
      done()
    }
  },
}))

/** The settings, loaded once per page; `reload` after something changed elsewhere (a confirmed e-mail). */
export function useDigest() {
  const status = useDigestStore((store) => store.status)
  const state = useDigestStore((store) => store.state)
  const saving = useDigestStore((store) => store.saving)
  const load = useDigestStore((store) => store.load)
  const save = useDigestStore((store) => store.save)
  useEffect(() => { void load() }, [load])
  return { status, state, saving, save, reload: () => load(true) }
}

/** What to tell the person when a change didn't save (null when it did). */
export function saveErrorMessage(t: Translate, result: DigestSaveResult) {
  if (result.ok) return null
  if (result.code === 'unverified') return t('digest.unverifiedBlocked')
  if (result.code === 'unavailable') return t('digest.unavailable')
  if (result.code === 'limited') return t('api.tooManyAttempts')
  return t('digest.saveFailed')
}
