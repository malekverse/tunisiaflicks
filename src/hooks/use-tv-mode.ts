// TV mode in client components (see src/components/tv/TvModeProvider.tsx).
// useLikelyTv is a STUB: implemented by tv-mode in wave 2; keep the signature.
import { useContext } from 'react'
import { TvModeContext } from '@/src/components/tv/TvModeProvider'

/** Whether the page is in TV mode. Never throws: false outside the provider. */
export function useTvMode(): boolean {
  return useContext(TvModeContext)?.tv ?? false
}

/**
 * Whether this device is probably a TV (to offer TV mode). Starts false, so the server render and
 * hydration agree, and is only worked out in an effect.
 */
export function useLikelyTv(): boolean {
  return false
}
