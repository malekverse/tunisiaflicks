"use client"
// A line under the player on how to get rid of the third-party sources' ads: on Windows, the
// desktop app (its own ad-free player, and pop-ups blocked on every source); elsewhere, an ad
// blocker. Not shown inside the apps (the desktop app has no ads to warn about, and an app's web
// view takes no ad blocker), nor in TV mode. Dismissed for good on this device.
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ShieldCheck, X } from 'lucide-react'
import { useT } from '@/src/components/I18nProvider'
import { useDevice } from '@/src/components/apps/use-device'
import { useTvMode } from '@/src/hooks/use-tv-mode'
import { isDesktopApp } from '@/src/hooks/use-desktop-app'
import { COMPUTERS } from '@/src/lib/device-platform'

const DISMISSED_KEY = 'tf-ad-free-tip-dismissed'

export default function AdFreeTip() {
  const t = useT()
  const tv = useTvMode()
  const device = useDevice()
  // Hidden until storage is read, so a dismissed tip never flashes.
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISSED_KEY) === '1')
    } catch {
      setDismissed(false)
    }
  }, [])

  const dismiss = () => {
    setDismissed(true)
    try { localStorage.setItem(DISMISSED_KEY, '1') } catch { /* private mode: gone for this page only */ }
  }

  if (tv || dismissed || !device || isDesktopApp()) return null
  const windows = device.platform === 'windows'
  // A computer's installed site still runs in the browser, with its extensions; a phone's app doesn't.
  if (!windows && device.inApp && !COMPUTERS.includes(device.platform)) return null

  return (
    <p className="flex items-center gap-2 text-xs text-white/55">
      <ShieldCheck aria-hidden className="h-3.5 w-3.5 shrink-0 text-emerald-400/80" />
      {windows ? (
        <Link href="/desktop" className="font-medium text-white/75 underline-offset-2 transition-colors hover:text-white hover:underline">
          {t('stream.adFree.desktop')}
        </Link>
      ) : (
        <span>{t('stream.adFree.blocker')}</span>
      )}
      <button
        type="button"
        onClick={dismiss}
        aria-label={t('stream.adFree.dismiss')}
        className="-m-1 grid h-6 w-6 shrink-0 place-items-center rounded-full text-white/40 transition-colors hover:bg-white/[0.06] hover:text-white"
      >
        <X aria-hidden className="h-3.5 w-3.5" />
      </button>
    </p>
  )
}
