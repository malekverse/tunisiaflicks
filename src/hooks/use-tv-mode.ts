// TV mode in client components (see src/components/tv/TvModeProvider.tsx).
import { useContext, useEffect, useState } from 'react'
import { TvModeContext } from '@/src/components/tv/TvModeProvider'

/** Whether the page is in TV mode. Never throws: false outside the provider. */
export function useTvMode(): boolean {
  return useContext(TvModeContext)?.tv ?? false
}

/** Whether the page runs inside the Android TV app (its WebView adds 'TunisiaFlicksTV/' to the user agent). */
export function useInTvApp(): boolean {
  return useContext(TvModeContext)?.inApp ?? false
}

/** TV platforms and TV boxes, by user agent. */
export const TV_USER_AGENT = /Android ?TV|GoogleTV|BRAVIA|AFT[A-Z]|SMART-?TV|Tizen|Web0S|HbbTV|MiTV|Mi ?Box|TV ?Box|Amlogic/i

/**
 * A device with no pointer and no touch, in landscape and at least 900px wide: a browser on a TV
 * driven by a remote (or a keyboard). Pure, for the hook below and the tests.
 */
export function looksLikeTv(env: { userAgent: string; inApp: boolean; anyPointerNone: boolean; maxTouchPoints: number; width: number; height: number }): boolean {
  if (env.inApp) return true
  if (TV_USER_AGENT.test(env.userAgent)) return true
  return env.anyPointerNone && env.maxTouchPoints === 0 && env.width > env.height && env.width >= 900
}

/**
 * Whether this device is probably a TV (to offer TV mode). Starts false, so the server render and
 * hydration agree, and is only worked out in an effect.
 */
export function useLikelyTv(): boolean {
  const inApp = useInTvApp()
  const [likely, setLikely] = useState(false)
  useEffect(() => {
    try {
      setLikely(looksLikeTv({
        userAgent: navigator.userAgent,
        inApp,
        anyPointerNone: window.matchMedia('(any-pointer: none)').matches,
        maxTouchPoints: navigator.maxTouchPoints ?? 0,
        width: window.innerWidth,
        height: window.innerHeight,
      }))
    } catch {
      setLikely(inApp)
    }
  }, [inApp])
  return likely
}
