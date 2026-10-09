// Which kind of device a visitor is on, to offer the right app (src/components/apps). Pure and
// safe anywhere; the browser parts call it with navigator's values.

export type DevicePlatform = 'android-tv' | 'smart-tv' | 'android' | 'ios' | 'windows' | 'mac' | 'linux' | 'chromeos' | 'other'

/** The desktop platforms, where the site installs as an app from the browser. */
export const COMPUTERS: readonly DevicePlatform[] = ['windows', 'mac', 'linux', 'chromeos']

const ANDROID_TV = /Android ?TV|GoogleTV|BRAVIA|AFT[A-Z]|MiTV|Mi ?Box|TV ?Box|Amlogic|Chromecast|SHIELD Android TV/i

/** A TV's own browser on a TV that can't install Android apps: Samsung (Tizen), LG (webOS, NetCast),
 *  Hisense (VIDAA) and other HbbTV / SMART-TV sets. Their user agents also say "Linux". */
const SMART_TV = /Tizen|Web0S|webOS|NetCast|VIDAA|HbbTV|SMART-?TV/i

/** The browser of a Samsung, LG or other non-Android smart TV (see SMART_TV). */
export const isSmartTvBrowser = (userAgent: string) => !/Android/i.test(userAgent) && SMART_TV.test(userAgent)

export function detectPlatform({ userAgent, maxTouchPoints = 0, likelyTv = false }: { userAgent: string, maxTouchPoints?: number, likelyTv?: boolean }): DevicePlatform {
  const ua = userAgent || ''
  if (/Android/i.test(ua)) return likelyTv || ANDROID_TV.test(ua) ? 'android-tv' : 'android'
  // iPadOS asks for the desktop site: a "Macintosh" with a touchscreen.
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1)) return 'ios'
  if (SMART_TV.test(ua)) return 'smart-tv'
  if (/CrOS/.test(ua)) return 'chromeos'
  if (/Windows/.test(ua)) return 'windows'
  if (/Macintosh|Mac OS X/.test(ua)) return 'mac'
  if (/Linux|X11/.test(ua)) return 'linux'
  return 'other'
}

/** Safari on a Mac (no install prompt; "File > Add to Dock" instead). */
export const isMacSafari = (userAgent: string) =>
  /Macintosh/.test(userAgent) && /Safari\//.test(userAgent) && !/Chrome\/|Chromium\/|Edg\/|OPR\/|Firefox\//.test(userAgent)
