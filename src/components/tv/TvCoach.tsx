"use client"
// The first time TV mode opens on a device: a card that says how the remote works, with [Got it].
// It holds the focus until it's dismissed (OK, or Back), then never shows again on this device.
import { useEffect, useState } from 'react'
import { useT } from '@/src/components/I18nProvider'
import KeyGlyph from './KeyGlyph'

const SEEN_KEY = 'tf-tv-coach'

export default function TvCoach({ paused = false }: { paused?: boolean }) {
  const t = useT()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    try {
      setOpen(localStorage.getItem(SEEN_KEY) !== '1')
    } catch {
      setOpen(false)
    }
  }, [])

  const dismiss = () => {
    setOpen(false)
    try { localStorage.setItem(SEEN_KEY, '1') } catch { /* private mode */ }
  }

  useEffect(() => {
    if (!open || paused) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') dismiss() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, paused])

  if (!open || paused) return null
  return (
    <div
      role="dialog"
      aria-labelledby="tv-coach-title"
      aria-describedby="tv-coach-text"
      data-tv-layer
      className="glass-strong fixed bottom-[var(--tv-safe-y)] end-[var(--tv-safe-x)] z-[65] w-[min(30rem,calc(100vw-2*var(--tv-safe-x)))] rounded-[22px] p-[1.4em] shadow-[0_24px_70px_-18px_rgb(0_0_0/0.95)] animate-in fade-in slide-in-from-bottom-4 duration-300 motion-reduce:slide-in-from-bottom-0"
    >
      <h2 id="tv-coach-title" className="font-display text-[1.6rem] font-bold leading-tight text-white">{t('tvMode.coach.title')}</h2>
      <p id="tv-coach-text" className="mt-2 text-[16px] leading-relaxed text-white/70">{t('tvMode.coach.text')}</p>
      <div aria-hidden className="mt-4 flex items-center gap-3 text-[18px] text-white">
        <KeyGlyph k="arrows" />
        <KeyGlyph k="ok" />
        <KeyGlyph k="back" />
      </div>
      <button
        type="button"
        data-tv-autofocus
        autoFocus
        onClick={dismiss}
        className="mt-5 inline-flex h-[2.9em] items-center rounded-full bg-white px-[1.4em] text-[16px] font-semibold text-black outline-none"
      >
        {t('tvMode.coach.gotIt')}
      </button>
    </div>
  )
}
