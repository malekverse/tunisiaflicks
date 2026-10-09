"use client"
// A list page's state: the list as shown, our own changes (shown at once, confirmed or undone by
// the server), other people's changes as they arrive (useListSync), and what to hold back while
// the viewer is busy. A change from someone else never moves things under a finger: while a
// reorder is being dragged or one of our changes is on its way, it waits (`held`) and lands after.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@/src/components/I18nProvider'
import { ListApiError, listErrorText, listFetch } from '@/src/components/lists/list-client'
import { toast } from '@/src/hooks/use-toast'
import { haptic } from '@/src/lib/motion'
import { itemKey, isLive, moveItem } from '@/src/lib/shared-lists/rules'
import type { SharedListActivity, SharedListItem, SharedListView } from '@/src/lib/shared-lists/types'
import { useListSync } from './use-list-sync'

const UNDO_MS = 5000

export type Candidate = { id: string; media_type: 'movie' | 'tv'; title: string; poster_path: string | null }

export function useSharedList(initial: SharedListView) {
  const t = useT()
  const router = useRouter()
  const [list, setList] = useState(initial)
  const [held, setHeld] = useState<SharedListView | null>(null)
  const [busy, setBusy] = useState(0)
  const [gone, setGone] = useState(false)
  /** The latest change someone else made, as it arrived (for the live line). */
  const [news, setNews] = useState<SharedListActivity | null>(null)

  const listRef = useRef(list)
  listRef.current = list
  const latest = useRef(initial.version)
  const inflight = useRef(0)
  const holding = useRef(false)
  const heldRef = useRef<SharedListView | null>(null)
  const known = useRef(new Set(initial.activity.map((entry) => entry.id)))
  // What was new when the page opened: it keeps its dot for this whole visit.
  const firstSeen = useRef(initial.seenAt)

  const show = useCallback((next: SharedListView) => {
    if (next.version < latest.current) return
    latest.current = next.version
    setList(next)
  }, [])

  const hold = useCallback((next: SharedListView | null) => {
    heldRef.current = next
    setHeld(next)
  }, [])

  /** Lands what was held back, once nothing of ours is on its way and nobody is dragging. */
  const flush = useCallback(() => {
    const waiting = heldRef.current
    if (!waiting || holding.current || inflight.current > 0) return
    hold(null)
    show(waiting)
  }, [hold, show])

  const receive = useCallback((remote: SharedListView) => {
    if (remote.version <= latest.current) return
    const fresh = remote.activity.filter((entry) => !known.current.has(entry.id))
    for (const entry of fresh) known.current.add(entry.id)
    const theirs = fresh.find((entry) => entry.by !== remote.you)
    if (theirs) setNews(theirs)
    if (holding.current || inflight.current > 0) hold(remote)
    else show(remote)
  }, [hold, show])

  useListSync({
    slug: list.slug,
    version: list.version,
    live: isLive(list),
    member: list.role === 'owner' || list.role === 'editor',
    onUpdate: receive,
    onGone: () => setGone(true),
  })

  /** Holds other people's changes while the viewer drags (true), and lands them after (false). */
  const setHolding = useCallback((value: boolean) => {
    holding.current = value
    if (!value) flush()
  }, [flush])

  /**
   * Sends one change. `optimistic` shows it right away; a refusal puts the list back. A 409 means
   * someone changed it at the same moment: the list as it is now comes with it.
   */
  const patch = useCallback(async (body: Record<string, unknown>, opts: { optimistic?: (current: SharedListView) => SharedListView; quiet?: boolean } = {}) => {
    inflight.current += 1
    setBusy((count) => count + 1)
    const before = opts.optimistic ? listRef.current : null
    if (opts.optimistic) {
      const next = opts.optimistic(listRef.current)
      listRef.current = next
      setList(next)
    }
    try {
      const data = await listFetch<{ list: SharedListView }>(`/api/lists/${encodeURIComponent(initial.slug)}`, { method: 'PATCH', body })
      if (data?.list) {
        for (const entry of data.list.activity) known.current.add(entry.id)
        if (heldRef.current && heldRef.current.version <= data.list.version) hold(null)
        latest.current = Math.max(latest.current, data.list.version)
        setList(data.list)
      }
      return true
    } catch (error) {
      if (error instanceof ListApiError && error.code === 'conflict' && error.body.list) {
        const now = error.body.list as SharedListView
        latest.current = Math.max(latest.current, now.version)
        setList(now)
        toast({ title: t('sharedLists.conflict') })
      } else {
        if (before) setList(before)
        if (error instanceof ListApiError && error.status === 404) setGone(true)
        if (!opts.quiet) toast({ variant: 'destructive', title: listErrorText(t, error) })
      }
      return false
    } finally {
      inflight.current -= 1
      setBusy((count) => count - 1)
      flush()
    }
  }, [initial.slug, hold, flush, t])

  const add = useCallback(async (candidate: Candidate) => {
    haptic(8)
    const ok = await patch({ add: { media_type: candidate.media_type, id: candidate.id } })
    if (ok) toast({ title: t('lists.addedTitle', { title: candidate.title }), duration: 2000 })
    return ok
  }, [patch, t])

  /** Takes a title out at once, with 5 seconds to take it back (it returns to the same place). */
  const remove = useCallback((item: SharedListItem) => {
    const key = itemKey(item)
    const index = list.items.findIndex((entry) => itemKey(entry) === key)
    patch(
      { remove: { media_type: item.media_type, id: item.id } },
      { optimistic: (current) => ({ ...current, items: current.items.filter((entry) => itemKey(entry) !== key) }) },
    ).then((ok) => {
      if (!ok) return
      toast({
        title: t('sharedLists.removedTitle', { title: item.title }),
        duration: UNDO_MS,
        action: {
          label: t('library.undo'),
          onClick: async () => {
            const back = await patch({ add: { media_type: item.media_type, id: item.id } }, { quiet: true })
            if (back && index >= 0) await patch({ move: { key, to: index } }, { quiet: true })
            if (!back) toast({ variant: 'destructive', title: t('library.undoFailed') })
          },
        },
      })
    })
  }, [list.items, patch, t])

  /** Moves one title to a new position (arrows, or the end of a drag). */
  const move = useCallback((key: string, to: number) => {
    const current = list.items.findIndex((item) => itemKey(item) === key)
    if (current < 0 || current === to) return Promise.resolve(true)
    return patch({ move: { key, to } }, { optimistic: (state) => ({ ...state, items: moveItem(state.items, key, to) ?? state.items }) })
  }, [list.items, patch])

  /** Puts back a title someone removed (from "Recent changes"). */
  const putBack = useCallback(async (entry: SharedListActivity) => {
    if (!entry.item) return
    const ok = await patch({ add: { media_type: entry.item.media_type, id: entry.item.id } }, { quiet: true })
    toast(ok ? { title: t('sharedLists.recent.back'), description: entry.item.title, duration: 2000 } : { variant: 'destructive', title: t('sharedLists.putBackFailed') })
  }, [patch, t])

  const saveDetails = useCallback((title: string, description: string) => patch({ title, description }), [patch])

  const setVisibility = useCallback((visibility: SharedListView['visibility']) =>
    patch({ visibility }, { optimistic: (current) => ({ ...current, visibility }) }), [patch])

  /** The people sheet changed something (someone joined or left, a new owner): read the list again. */
  const refresh = useCallback(async () => {
    try {
      const data = await listFetch<{ list: SharedListView }>(`/api/lists/${encodeURIComponent(initial.slug)}`)
      if (data?.list) {
        for (const entry of data.list.activity) known.current.add(entry.id)
        latest.current = Math.max(latest.current, data.list.version)
        setList(data.list)
        if (data.list.role === 'viewer' || data.list.role === 'none') router.refresh()
      }
    } catch (error) {
      if (error instanceof ListApiError && error.status === 404) setGone(true)
    }
  }, [initial.slug, router])

  const newKeys = useMemo(() => {
    const since = firstSeen.current ? new Date(firstSeen.current).getTime() : null
    if (since === null || list.memberCount < 2) return new Set<string>()
    return new Set(list.items.filter((item) => item.by && item.by !== list.you && item.addedAt && new Date(item.addedAt).getTime() > since).map(itemKey))
  }, [list.items, list.memberCount, list.you])

  // Deleted, or no longer ours to see: say so, and go back to the lists.
  useEffect(() => {
    if (!gone) return
    toast({ variant: 'destructive', title: t('sharedLists.gone') })
    router.replace('/lists')
  }, [gone, t, router])

  return {
    list, held, busy: busy > 0, gone, news, newKeys,
    add, remove, move, putBack, saveDetails, setVisibility, refresh, setHolding,
    showHeld: () => { const waiting = heldRef.current; if (waiting) { hold(null); show(waiting) } },
  }
}
