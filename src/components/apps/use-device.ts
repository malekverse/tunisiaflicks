"use client"
// The visitor's device (src/lib/device-platform.ts), and whether they already use one of the apps.
// Both are known only in the browser: null until then, so nothing flashes on the server render.
import { useEffect, useState } from 'react'
import { detectPlatform, type DevicePlatform } from '@/src/lib/device-platform'
import { isStandalone } from '@/src/hooks/use-install-prompt'
import { isDesktopApp } from '@/src/hooks/use-desktop-app'
import { useInTvApp, useLikelyTv } from '@/src/hooks/use-tv-mode'

/** Set once the Android app has opened the site (its start address carries ?source=android-app). */
const ANDROID_APP_KEY = 'tf-android-app'

export type Device = {
  platform: DevicePlatform
  /** Inside the Android TV app, the Android app, the desktop app, or the site installed from a browser. */
  inApp: boolean
  userAgent: string
}

export function useDevice(): Device | null {
  const likelyTv = useLikelyTv()
  const inTvApp = useInTvApp()
  const [device, setDevice] = useState<Device | null>(null)

  useEffect(() => {
    let androidApp = false
    try {
      const url = new URL(window.location.href)
      if (url.searchParams.get('source') === 'android-app') {
        localStorage.setItem(ANDROID_APP_KEY, '1')
        url.searchParams.delete('source')
        window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
      }
      // The app shares Chrome's storage, so the mark also quiets the offers in Chrome on that
      // phone: fine, the app is installed there.
      androidApp = localStorage.getItem(ANDROID_APP_KEY) === '1' || document.referrer.startsWith('android-app://com.tunisiaflicks.app')
    } catch { /* private mode: no mark, no harm */ }
    setDevice({
      platform: detectPlatform({ userAgent: navigator.userAgent, maxTouchPoints: navigator.maxTouchPoints ?? 0, likelyTv }),
      inApp: inTvApp || androidApp || isDesktopApp() || isStandalone(),
      userAgent: navigator.userAgent,
    })
  }, [likelyTv, inTvApp])

  return device
}
