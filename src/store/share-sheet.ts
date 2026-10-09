// The one ShareSheet of the app: openShare() from anywhere, ShareSheetHost (mounted once in the
// root layout) shows it. Only one request at a time: a new one replaces the current one.
import { create } from 'zustand'
import type { ShareMedia } from '@/src/lib/social/types'

export type ShareRequest =
  | { kind: 'title'; media: ShareMedia }
  | {
    kind: 'invite'
    target: 'friend' | 'night' | 'list'
    /** The thing's own URL with ?invite=TOKEN (a path on this site or an absolute URL). */
    url: string
    title: string
    /** The message that goes with the link on WhatsApp, Telegram and X. */
    text?: string
    /** Also offer to send it to friends: POST `endpoint` with {...body, to: handles}. */
    sendTo?: { endpoint: string; body?: Record<string, unknown> }
  }

type ShareSheetState = {
  request: ShareRequest | null
  /** Bumped on every open, so reopening the same request starts fresh. */
  version: number
  open: (request: ShareRequest) => void
  close: () => void
}

export const useShareSheet = create<ShareSheetState>((set) => ({
  request: null,
  version: 0,
  open: (request) => set((state) => ({ request, version: state.version + 1 })),
  close: () => set({ request: null }),
}))

export function openShare(r: ShareRequest): void {
  useShareSheet.getState().open(r)
}

export function closeShare(): void {
  useShareSheet.getState().close()
}
