"use client"
// "Play on my TV", the TV's side (lib/tv-send): on a TV signed in with a code, asks now and then for
// a title sent from a phone or a computer, and offers it: "{name} sent you {title}" [Play now]
// [Not now]. It asks while the page is in view and someone used the remote in the last half hour
// (right away on a key press), so an idle TV costs nothing.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { MonitorPlay, Play } from 'lucide-react'
import { useT } from '@/src/components/I18nProvider'
import { pushTvBackHandler } from './use-focus-engine'

const EVERY_MS = 20_000
const IDLE_MS = 30 * 60_000

type Sent = { title: string, fromName: string, path: string }

export default function TvInbox() {
  const t = useT()
  const { data: session } = useSession()
  const onTv = session?.scope === 'tv'
  const [sent, setSent] = useState<Sent | null>(null)
  const lastKey = useRef(Date.now())
  const asking = useRef(false)

  const ask = useCallback(async () => {
    if (asking.current || document.visibilityState !== 'visible') return
    asking.current = true
    try {
      const response = await fetch('/api/tv/inbox', { cache: 'no-store' })
      const data = response.ok ? await response.json() : null
      if (data?.sent?.path && typeof data.sent.path === 'string' && data.sent.path.startsWith('/')) setSent(data.sent)
    } catch { /* offline: next time */ } finally {
      asking.current = false
    }
  }, [])

  useEffect(() => {
    if (!onTv) return
    ask()
    const id = window.setInterval(() => { if (Date.now() - lastKey.current < IDLE_MS) ask() }, EVERY_MS)
    const onKey = () => {
      const idle = Date.now() - lastKey.current > EVERY_MS
      lastKey.current = Date.now()
      if (idle) ask()
    }
    const onVisible = () => { if (document.visibilityState === 'visible') ask() }
    document.addEventListener('keydown', onKey, true)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('keydown', onKey, true)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [onTv, ask])

  useEffect(() => {
    if (!sent) return
    return pushTvBackHandler(() => { setSent(null); return true })
  }, [sent])

  if (!sent) return null
  return (
    <div
      role="dialog"
      aria-labelledby="tv-inbox-title"
      data-tv-layer
      // Bottom corner: clear of the first-time remote card (top corner) and the bar.
      className="glass-strong fixed bottom-[5vh] end-[var(--tv-safe-x)] z-[66] w-[min(32rem,calc(100vw-2*var(--tv-safe-x)))] rounded-[22px] p-[1.4em] shadow-[0_24px_70px_-18px_rgb(0_0_0/0.95)] animate-in fade-in slide-in-from-bottom-2 duration-300 motion-reduce:slide-in-from-bottom-0"
    >
      <p className="flex items-center gap-2 text-[15px] text-white/65">
        <MonitorPlay aria-hidden className="h-5 w-5 text-red-500" />{t('tvSend.inbox.from', { name: sent.fromName })}
      </p>
      <h2 id="tv-inbox-title" dir="auto" className="mt-2 font-display text-[1.7rem] font-bold leading-tight text-white">{sent.title}</h2>
      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          data-tv-autofocus
          autoFocus
          onClick={() => window.location.assign(sent.path)}
          className="inline-flex h-[2.9em] items-center gap-2 rounded-full bg-red-600 px-[1.4em] text-[16px] font-semibold text-white outline-none"
        >
          <Play aria-hidden className="h-4 w-4 fill-current rtl:-scale-x-100" />{t('tvSend.inbox.play')}
        </button>
        <button type="button" onClick={() => setSent(null)} className="inline-flex h-[2.9em] items-center rounded-full bg-white/[0.12] px-[1.4em] text-[16px] font-semibold text-white outline-none">
          {t('tvSend.inbox.later')}
        </button>
      </div>
    </div>
  )
}
