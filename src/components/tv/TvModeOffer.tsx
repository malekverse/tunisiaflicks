"use client"
// A one-time suggestion on devices that look like a TV (useLikelyTv), outside TV mode: "Watching on
// a TV? Switch to TV mode". A floating card at the bottom end, like VerifyEmailBanner, and never at
// the same time: it waits while that banner shows. "Not now" hides it for 30 days on this device.
// Mounted in the root layout after VerifyEmailBanner (not in TV mode).
import { useEffect, useRef, useState } from 'react'
import { TvMinimal } from 'lucide-react'
import { useT } from '@/src/components/I18nProvider'
import { Button } from '@/src/components/ui/button'
import { useAccount } from '@/src/hooks/use-account'
import { useLikelyTv, useTvMode } from '@/src/hooks/use-tv-mode'

const DISMISSED_KEY = 'tf-tv-offer-dismissed'
const QUIET_MS = 30 * 24 * 60 * 60 * 1000
// VerifyEmailBanner's own "dismissed for this session" key.
const VERIFY_DISMISSED_KEY = 'tf-verify-banner-dismissed'

function dismissedRecently(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISSED_KEY))
    return Number.isFinite(at) && at > 0 && Date.now() - at < QUIET_MS
  } catch {
    return true
  }
}

export default function TvModeOffer(): JSX.Element | null {
  const t = useT()
  const tv = useTvMode()
  const likelyTv = useLikelyTv()
  const { account } = useAccount()
  const [quiet, setQuiet] = useState(true)
  const [verifyShowing, setVerifyShowing] = useState(false)
  const [busy, setBusy] = useState(false)
  const switchRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (likelyTv) setQuiet(dismissedRecently())
  }, [likelyTv])

  // The e-mail reminder goes first; this card waits until it's verified or dismissed.
  const verifyPending = !!account && !account.emailVerified && !!account.email
  useEffect(() => {
    if (!verifyPending) return setVerifyShowing(false)
    const check = () => {
      try { setVerifyShowing(sessionStorage.getItem(VERIFY_DISMISSED_KEY) !== '1') } catch { setVerifyShowing(false) }
    }
    check()
    const timer = window.setInterval(check, 2000)
    return () => window.clearInterval(timer)
  }, [verifyPending])

  const open = likelyTv && !tv && !quiet && !verifyShowing

  // A remote has no pointer: put the focus on the card's answer.
  useEffect(() => {
    if (open) switchRef.current?.focus({ preventScroll: true })
  }, [open])

  if (!open) return null

  const later = () => {
    setQuiet(true)
    try { localStorage.setItem(DISMISSED_KEY, String(Date.now())) } catch { /* private mode */ }
  }

  const switchOn = async () => {
    setBusy(true)
    const response = await fetch('/api/tv-mode', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ on: true }) }).catch(() => null)
    // The shell is chosen on the server: load this page again, in TV mode.
    if (response?.ok) window.location.reload()
    else window.location.assign('/?tv=1')
  }

  return (
    <div
      role="region"
      aria-labelledby="tv-offer-title"
      className="glass-strong fixed inset-x-3 bottom-[calc(var(--tabbar-space)+8px)] z-30 mx-auto flex max-w-md items-start gap-3.5 rounded-[20px] p-4 shadow-[0_18px_50px_-12px_rgb(0_0_0/0.9)] animate-in fade-in slide-in-from-bottom-4 duration-500 motion-reduce:slide-in-from-bottom-0 lg:inset-x-auto lg:bottom-6 lg:end-6 lg:mx-0"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/[0.08] text-white">
        <TvMinimal aria-hidden className="h-5 w-5" strokeWidth={1.9} />
      </span>
      <div className="min-w-0 flex-1">
        <p id="tv-offer-title" className="text-[15px] font-semibold text-white">{t('tvMode.offer.title')}</p>
        <p className="mt-0.5 text-[13.5px] leading-snug text-white/65">{t('tvMode.offer.text')}</p>
        <div className="mt-3.5 flex flex-wrap gap-2">
          <Button ref={switchRef} size="sm" onClick={switchOn} disabled={busy} className="h-10">{t('tvMode.offer.switch')}</Button>
          <Button variant="ghost" size="sm" onClick={later} className="h-10 text-white/70">{t('tvMode.offer.notNow')}</Button>
        </div>
      </div>
    </div>
  )
}
