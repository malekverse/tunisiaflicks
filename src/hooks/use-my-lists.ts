"use client"
// The viewer's lists (GET /api/lists): their own, the ones they help build, and invitations.
// `contains` ('movie-550') also says, per list, whether that title is in it ("Add to a list").
// `refreshOnFocus`: coming back to the tab reloads, at most every 30 seconds (/lists).
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { listFetch } from '@/src/components/lists/list-client'
import type { MyListsResponse } from '@/src/lib/shared-lists/types'

export type MyListsState = { status: 'loading' | 'guest' | 'error' | 'ready'; data: MyListsResponse | null }

const FOCUS_THROTTLE_MS = 30_000

export function useMyLists(opts: { contains?: string | null; refreshOnFocus?: boolean; enabled?: boolean } = {}) {
  const { status: session } = useSession()
  const enabled = opts.enabled !== false
  const [state, setState] = useState<MyListsState>({ status: 'loading', data: null })
  const lastLoad = useRef(0)
  const request = useRef(0)
  const url = `/api/lists${opts.contains ? `?editable=1&contains=${encodeURIComponent(opts.contains)}` : ''}`

  const load = useCallback(async (quiet = false) => {
    const id = ++request.current
    lastLoad.current = Date.now()
    if (!quiet) setState((current) => ({ status: current.data ? current.status : 'loading', data: current.data }))
    try {
      const data = await listFetch<MyListsResponse>(url)
      if (id === request.current && data) setState({ status: 'ready', data })
    } catch (error) {
      if (id !== request.current) return
      const unauthorized = (error as { status?: number })?.status === 401
      setState((current) => (unauthorized ? { status: 'guest', data: null } : current.data ? current : { status: 'error', data: null }))
    }
  }, [url])

  useEffect(() => {
    if (!enabled || session === 'loading') return
    if (session === 'unauthenticated') {
      setState({ status: 'guest', data: null })
      return
    }
    load()
  }, [enabled, session, load])

  useEffect(() => {
    if (!enabled || !opts.refreshOnFocus || session !== 'authenticated') return
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastLoad.current > FOCUS_THROTTLE_MS) load(true)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [enabled, opts.refreshOnFocus, session, load])

  /** Change the answer locally (an invitation answered, a list joined) without a reload. */
  const update = useCallback((change: (data: MyListsResponse) => MyListsResponse) => {
    setState((current) => (current.data ? { ...current, data: change(current.data) } : current))
  }, [])

  return { ...state, reload: load, update }
}
