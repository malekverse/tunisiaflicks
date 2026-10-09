"use client"
// Who the viewer is, socially, on the client: guest, Kids, a TV, no page yet, or their page.
// One request per page load (GET /api/social/handle), shared by every component that asks.
import { useCallback, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import type { Translate } from '@/src/lib/i18n/translate'
import type { TKey } from '@/src/lib/i18n'
import type { PublicIdentity } from '@/src/lib/social/types'

export type SocialSelf = {
  handle: string | null
  identity: PublicIdentity | null
  /** The page's name, or the profile's name before there is a page. */
  name: string
  bio: string
  usePhoto: boolean
  color: string | null
  verified: boolean
  /** The account owner's profile (the only one that may use the account photo). */
  owner: boolean
  hasPhoto: boolean
  handleChangeAt: string | null
}

export type SocialSelfState =
  | { status: 'loading' | 'guest' | 'kids' | 'tv' | 'needs_pick' | 'error'; self: null }
  | { status: 'ready'; self: SocialSelf }

let pending: Promise<SocialSelfState> | null = null
let pendingFor: string | undefined

function load(userId: string, force = false): Promise<SocialSelfState> {
  if (!pending || pendingFor !== userId || force) {
    pendingFor = userId
    pending = fetch('/api/social/handle', { cache: 'no-store' })
      .then(async (response): Promise<SocialSelfState> => {
        if (response.ok) return { status: 'ready', self: await response.json() }
        const body = await response.json().catch(() => ({}))
        if (response.status === 401) return { status: 'guest', self: null }
        if (body.code === 'kids') return { status: 'kids', self: null }
        if (body.code === 'tv_session') return { status: 'tv', self: null }
        if (body.code === 'needs_pick') return { status: 'needs_pick', self: null }
        return { status: 'error', self: null }
      })
      .catch((): SocialSelfState => ({ status: 'error', self: null }))
  }
  return pending
}

/** Forget the cached answer (after creating or editing the page). */
export function invalidateSocialSelf() {
  pending = null
}

export function useSocialSelf(enabled = true) {
  const { data: session, status: sessionStatus } = useSession()
  const userId = session?.user?.id
  const [state, setState] = useState<SocialSelfState>({ status: 'loading', self: null })

  useEffect(() => {
    if (!enabled) return
    if (sessionStatus === 'loading') return
    if (!userId) {
      setState({ status: 'guest', self: null })
      return
    }
    let cancelled = false
    load(userId).then((value) => { if (!cancelled) setState(value) })
    return () => { cancelled = true }
  }, [enabled, userId, sessionStatus])

  const reload = useCallback(async () => {
    if (!userId) return
    setState(await load(userId, true))
  }, [userId])

  return { ...state, reload }
}

const KNOWN_ERRORS = new Set([
  'unverified', 'tv_session', 'kids', 'needs_handle', 'needs_pick', 'not_found', 'requests_off', 'not_owner_profile',
  'friends_cap', 'too_many_pending', 'self', 'too_soon', 'expired', 'used_up', 'invalid',
])

/** The words for an API error code ({error, code}), or the generic message. */
export function socialErrorText(t: Translate, body: { code?: unknown; error?: unknown } | null | undefined): string {
  const code = typeof body?.code === 'string' ? body.code : ''
  if (code === 'rate_limited') return t('api.tooManyAttempts')
  if (KNOWN_ERRORS.has(code)) return t(`social.errors.${code}` as TKey)
  return t('social.errors.generic')
}
