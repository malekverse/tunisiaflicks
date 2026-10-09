"use client"
// "Add to a list…" as its own sheet (from a card's menu or the "Saved for later" toast). One at a
// time, and never on top of another sheet: opening it puts the ShareSheet and the quick-view sheet
// away first. AddToListHost shows it.
import { create } from 'zustand'
import { closeShare, openShare } from '@/src/store/share-sheet'
import { usePeek } from '@/src/store/peek'
import type { ShareMedia } from '@/src/lib/social/types'

type AddToListState = {
  media: ShareMedia | null
  /** Bumped on every open, so the same title opened twice starts fresh. */
  version: number
  open: (media: ShareMedia) => void
  close: () => void
}

export const useAddToList = create<AddToListState>((set) => ({
  media: null,
  version: 0,
  open: (media) => set((state) => ({ media, version: state.version + 1 })),
  close: () => set({ media: null }),
}))

export function openAddToList(media: ShareMedia): void {
  usePeek.getState().close()
  // No host on this page (the layout hasn't mounted one): the ShareSheet has the same picker.
  if (leaderId() === null) {
    openShare({ kind: 'title', media })
    return
  }
  closeShare()
  useAddToList.getState().open(media)
}

export function closeAddToList(): void {
  useAddToList.getState().close()
}

// Several hosts may be mounted (the layout's, and a fallback inside card menus): one shows the
// sheet. The layout's wins; otherwise the first fallback still mounted.
type Host = { id: number; fallback: boolean }
let hosts: Host[] = []
let nextId = 1
const listeners = new Set<() => void>()

export function registerHost(fallback: boolean): { id: number; unregister: () => void } {
  const host = { id: nextId++, fallback }
  hosts = [...hosts, host]
  listeners.forEach((listener) => listener())
  return {
    id: host.id,
    unregister: () => {
      hosts = hosts.filter((entry) => entry.id !== host.id)
      listeners.forEach((listener) => listener())
    },
  }
}

export function leaderId(): number | null {
  return (hosts.find((host) => !host.fallback) ?? hosts[0])?.id ?? null
}

export function onHostsChange(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
