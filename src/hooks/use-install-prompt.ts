"use client"
// Installing the site as an app (Chrome and Edge on Windows, Mac, Linux, ChromeOS and Android).
//
// The browser offers it once, with 'beforeinstallprompt', often before React has started; the
// root layout's INSTALL_PROMPT_SCRIPT (src/lib/install-prompt-script.ts) keeps that event on window
// for whoever asks later (the app offer, /app). Calling preventDefault() also keeps Chrome's own
// mini-infobar away: the site asks at a better moment.
import { useCallback, useSyncExternalStore } from 'react'
import { INSTALL_PROMPT_EVENT as EVENT } from '@/src/lib/install-prompt-script'

type InstallPromptEvent = Event & { prompt: () => Promise<void>, userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

declare global {
  interface Window {
    __tfInstallPrompt?: InstallPromptEvent | null
    __tfInstalled?: boolean
  }
}

/** The site already runs as an installed app (a home screen app, the Android app, a desktop window). */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.matchMedia('(display-mode: standalone)').matches
      || window.matchMedia('(display-mode: fullscreen)').matches
      || window.matchMedia('(display-mode: minimal-ui)').matches
      || (navigator as { standalone?: boolean }).standalone === true
  } catch {
    return false
  }
}

const subscribe = (onChange: () => void) => {
  window.addEventListener(EVENT, onChange)
  return () => window.removeEventListener(EVENT, onChange)
}
const canInstallNow = () => !!window.__tfInstallPrompt
const installedNow = () => !!window.__tfInstalled

export function useInstallPrompt() {
  const canInstall = useSyncExternalStore(subscribe, canInstallNow, () => false)
  const installed = useSyncExternalStore(subscribe, installedNow, () => false)

  /** Shows the browser's install dialog. 'unavailable' when the browser hasn't offered one. */
  const install = useCallback(async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    const event = window.__tfInstallPrompt
    if (!event) return 'unavailable'
    // An event can prompt only once.
    window.__tfInstallPrompt = null
    window.dispatchEvent(new Event(EVENT))
    try {
      await event.prompt()
      const choice = await event.userChoice
      if (choice.outcome === 'accepted') {
        window.__tfInstalled = true
        window.dispatchEvent(new Event(EVENT))
      }
      return choice.outcome
    } catch {
      return 'dismissed'
    }
  }, [])

  return { canInstall, installed, install }
}
