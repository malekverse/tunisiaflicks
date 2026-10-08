// The one ShareSheet of the app (Dialog on md+, Drawer on phones), opened with openShare() from
// src/store/share-sheet.ts. Mounted once in the root layout, after PeekLayer (not in TV mode). The
// sheet's code only loads the first time something is shared.
"use client"
import { useCallback, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { useShareSheet, type ShareRequest } from '@/src/store/share-sheet'

const ShareSheet = dynamic(() => import('./ShareSheet'), { ssr: false })

export default function ShareSheetHost(): JSX.Element | null {
  const request = useShareSheet((state) => state.request)
  const version = useShareSheet((state) => state.version)
  const close = useShareSheet((state) => state.close)
  // The last request stays mounted while the sheet animates away.
  const [shown, setShown] = useState<{ request: ShareRequest; version: number } | null>(null)
  useEffect(() => {
    if (request) setShown({ request, version })
  }, [request, version])
  const onClose = useCallback(() => close(), [close])

  if (!shown) return null
  return <ShareSheet key={shown.version} request={shown.request} open={!!request} onClose={onClose} />
}
