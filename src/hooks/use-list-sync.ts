"use client"
// Keeps a list page in step with the other people in the list, by asking for news (GET ?v=version:
// 204 = nothing new). Only for lists more than one person builds (or with invitations out), only
// while the tab is visible: every 6s, then 20s, then a minute while nothing changes; any change, or
// coming back to the tab, goes back to 6s; after half an hour nobody touched the page it stops, and
// starts again (at 6s) when they do. While a member looks, it also says so (POST /seen) about once a minute,
// so nobody's change pings them about a list they are watching.
import { useEffect, useRef } from 'react'
import { listFetch } from '@/src/components/lists/list-client'
import { POLL_IDLE_STOP_MS, pollDelay } from '@/src/lib/shared-lists/rules'
import type { SharedListView } from '@/src/lib/shared-lists/types'

const SEEN_EVERY_MS = 60_000

export function useListSync({ slug, version, live, member, onUpdate, onGone }: {
  slug: string
  /** The version the page shows now. */
  version: number
  /** Worth watching (several people, or invitations out). */
  live: boolean
  /** The viewer is in the list (says it's looking). */
  member: boolean
  onUpdate: (list: SharedListView) => void
  onGone: () => void
}) {
  const versionRef = useRef(version)
  versionRef.current = version
  const handlers = useRef({ onUpdate, onGone })
  handlers.current = { onUpdate, onGone }

  // "I'm looking": now, then about once a minute while the tab is visible.
  useEffect(() => {
    if (!member) return
    let last = 0
    const seen = () => {
      if (document.visibilityState !== 'visible' || Date.now() - last < SEEN_EVERY_MS - 1000) return
      last = Date.now()
      listFetch(`/api/lists/${encodeURIComponent(slug)}/seen`, { method: 'POST', body: {} }).catch(() => undefined)
    }
    seen()
    const timer = setInterval(seen, SEEN_EVERY_MS)
    document.addEventListener('visibilitychange', seen)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', seen)
    }
  }, [slug, member])

  useEffect(() => {
    if (!live) return
    let timer: ReturnType<typeof setTimeout> | undefined
    let quiet = 0
    let lastTouch = Date.now()
    let stopped = false
    let inflight: AbortController | null = null

    const schedule = (delay: number) => {
      clearTimeout(timer)
      if (stopped) return
      timer = setTimeout(check, delay)
    }

    const check = async () => {
      if (document.visibilityState !== 'visible') return
      if (Date.now() - lastTouch > POLL_IDLE_STOP_MS) return // asleep until someone touches the page
      inflight?.abort()
      const controller = new AbortController()
      inflight = controller
      try {
        const data = await listFetch<{ list: SharedListView }>(`/api/lists/${encodeURIComponent(slug)}?v=${versionRef.current}`, { signal: controller.signal })
        if (data?.list) {
          quiet = 0
          if (data.list.version !== versionRef.current) handlers.current.onUpdate(data.list)
        } else {
          quiet += 1
        }
      } catch (error) {
        if ((error as { name?: string })?.name === 'AbortError') return
        if ((error as { status?: number })?.status === 404) {
          stopped = true
          handlers.current.onGone()
          return
        }
        quiet += 1 // offline or a hiccup: try again, more slowly
      }
      schedule(pollDelay(quiet))
    }

    const wake = () => {
      const asleep = Date.now() - lastTouch > POLL_IDLE_STOP_MS
      lastTouch = Date.now()
      if (asleep) {
        quiet = 0
        schedule(0)
      }
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        lastTouch = Date.now()
        quiet = 0
        schedule(0)
      } else {
        clearTimeout(timer)
        inflight?.abort()
      }
    }

    schedule(pollDelay(0))
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('pointerdown', wake, { passive: true })
    window.addEventListener('keydown', wake)
    window.addEventListener('scroll', wake, { passive: true })
    return () => {
      stopped = true
      clearTimeout(timer)
      inflight?.abort()
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('pointerdown', wake)
      window.removeEventListener('keydown', wake)
      window.removeEventListener('scroll', wake)
    }
  }, [slug, live])
}
