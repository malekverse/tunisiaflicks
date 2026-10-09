"use client"
// Shows "Add to a list…" (openAddToList()). Meant to be mounted once in the root layout, beside
// ShareSheetHost; card menus also mount a `fallback` host, so the sheet works on any page with a
// card even without it. Only one host ever renders the sheet. A ShareSheet opening puts it away
// (never two sheets at once). The sheet's code loads the first time it's needed.
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { useShareSheet } from '@/src/store/share-sheet'
import type { ShareMedia } from '@/src/lib/social/types'
import { leaderId, onHostsChange, registerHost, useAddToList } from './add-to-list-store'

const AddToListDrawer = dynamic(() => import('./AddToListDrawer'), { ssr: false })

export default function AddToListHost({ fallback = false }: { fallback?: boolean }): JSX.Element | null {
  const [id, setId] = useState<number | null>(null)
  const [leader, setLeader] = useState(false)
  // Hosts that don't show the sheet don't even re-render when it opens.
  const media = useAddToList((state) => (leader ? state.media : null))
  const version = useAddToList((state) => (leader ? state.version : 0))
  const close = useAddToList((state) => state.close)
  const sharing = useShareSheet((state) => leader && !!state.request)
  // The last title stays mounted while the sheet animates away.
  const [shown, setShown] = useState<{ media: ShareMedia; version: number } | null>(null)

  useEffect(() => {
    const host = registerHost(fallback)
    setId(host.id)
    const update = () => setLeader(leaderId() === host.id)
    const stop = onHostsChange(update)
    update()
    return () => {
      stop()
      host.unregister()
    }
  }, [fallback])

  useEffect(() => {
    if (media) setShown({ media, version })
  }, [media, version])

  // The ShareSheet opened: this one goes.
  useEffect(() => {
    if (sharing && media) close()
  }, [sharing, media, close])

  if (!leader || id === null || !shown) return null
  return <AddToListDrawer key={shown.version} media={shown.media} open={!!media} onClose={close} />
}
