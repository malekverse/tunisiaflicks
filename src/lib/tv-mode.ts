// TV mode is a mode, not a set of routes: the cookie tf-tv=1 (set by /?tv=1, cleared by /?tv=0 or
// POST /api/tv-mode, see src/middleware.ts) swaps the shell for the remote-friendly one on the same
// URLs. Also where the apps are published (the /app page reads these).
import { cookies } from 'next/headers'

export const TV_COOKIE = 'tf-tv'

/** The TV cookie's settings (1 year, readable by the page so the TV settings can show the state). */
export const TV_COOKIE_OPTIONS = {
  path: '/',
  maxAge: 60 * 60 * 24 * 365,
  sameSite: 'lax' as const,
  httpOnly: false,
}

/** Whether this request is in TV mode (server components and route handlers). */
export function isTvMode(): boolean {
  try {
    return cookies().get(TV_COOKIE)?.value === '1'
  } catch {
    // Outside a request (build time, scripts): never TV mode.
    return false
  }
}

/** An https URL from the environment, or null (anything else is ignored). */
function httpsUrl(value: string | undefined): string | null {
  const url = value?.trim()
  if (!url) return null
  try {
    return new URL(url).protocol === 'https:' ? url : null
  } catch {
    return null
  }
}

/** A SHA-256 fingerprint as 64 hex digits, shown in pairs ('AB:CD:…'), or null. */
export function formatFingerprint(value: string | undefined): string | null {
  const hex = value?.replace(/[^a-fA-F0-9]/g, '').toUpperCase() ?? ''
  return hex.length === 64 ? hex.match(/.{2}/g)!.join(':') : null
}

/**
 * The Android TV app (a signed APK attached to a GitHub Release by .github/workflows/android-tv.yml).
 * Unset until the first release: the /app page then leaves the TV app panel out.
 */
export function androidApkUrl(): string | null {
  return httpsUrl(process.env.NEXT_PUBLIC_ANDROID_APK_URL)
}

/** What /app shows next to the APK so it can be checked before installing (from the release notes). */
export function androidApkChecks(): { apkSha256: string | null; certSha256: string | null; releaseUrl: string | null } {
  return {
    apkSha256: formatFingerprint(process.env.NEXT_PUBLIC_ANDROID_APK_SHA256),
    certSha256: formatFingerprint(process.env.NEXT_PUBLIC_ANDROID_CERT_SHA256),
    releaseUrl: httpsUrl(process.env.NEXT_PUBLIC_ANDROID_RELEASE_URL),
  }
}

/** The phone app on Google Play (a Trusted Web Activity, see docs/play-store.md), or null. */
export function playStoreUrl(): string | null {
  const url = httpsUrl(process.env.NEXT_PUBLIC_PLAY_STORE_URL)
  return url && /^https:\/\/play\.google\.com\//.test(url) ? url : null
}
