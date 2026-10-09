// Which kind of device a visitor is on, to offer the right app (src/components/apps). Pure and
// safe anywhere; the browser parts call it with navigator's values.

export type DevicePlatform = 'android-tv' | 'android' | 'ios' | 'windows' | 'mac' | 'linux' | 'chromeos' | 'other'

/** The desktop platforms, where the site installs as an app from the browser. */
export const COMPUTERS: readonly DevicePlatform[] = ['windows', 'mac', 'linux', 'chromeos']

const ANDROID_TV = /Android ?TV|GoogleTV|BRAVIA|AFT[A-Z]|MiTV|Mi ?Box|TV ?Box|Amlogic|Chromecast|SHIELD Android TV/i

export function detectPlatform({ userAgent, maxTouchPoints = 0, likelyTv = false }: { userAgent: string, maxTouchPoints?: number, likelyTv?: boolean }): DevicePlatform {
  const ua = userAgent || ''
  if (/Android/i.test(ua)) return likelyTv || ANDROID_TV.test(ua) ? 'android-tv' : 'android'
  // iPadOS asks for the desktop site: a "Macintosh" with a touchscreen.
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1)) return 'ios'
  if (/CrOS/.test(ua)) return 'chromeos'
  if (/Windows/.test(ua)) return 'windows'
  if (/Macintosh|Mac OS X/.test(ua)) return 'mac'
  if (/Linux|X11/.test(ua)) return 'linux'
  return 'other'
}

/** Safari on a Mac (no install prompt; "File > Add to Dock" instead). */
export const isMacSafari = (userAgent: string) =>
  /Macintosh/.test(userAgent) && /Safari\//.test(userAgent) && !/Chrome\/|Chromium\/|Edg\/|OPR\/|Firefox\//.test(userAgent)
