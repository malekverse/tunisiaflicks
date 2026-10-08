// Telling the server about a new UI language (browser only). The cookie already makes pages render
// in it; this also saves it with the account (for e-mails) and with this device's push
// subscription (so notifications arrive in it). Best effort: failures are ignored.
import type { Locale } from './locales'

/** This browser's push subscription endpoint, if notifications are on (never waits long). */
async function pushEndpoint(): Promise<string | undefined> {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return undefined
    const registration = await Promise.race([
      navigator.serviceWorker.getRegistration(),
      new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), 1500)),
    ])
    const subscription = await registration?.pushManager.getSubscription()
    return subscription?.endpoint || undefined
  } catch {
    return undefined
  }
}

/** POST /api/locale { locale, endpoint? }, with keepalive so it survives the page refreshing. */
export async function syncLocale(locale: Locale): Promise<void> {
  try {
    const endpoint = await pushEndpoint()
    await fetch('/api/locale', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(endpoint ? { locale, endpoint } : { locale }),
      keepalive: true,
      credentials: 'same-origin',
    })
  } catch {
    // Offline or blocked: the cookie still holds the choice; the next switch will sync again.
  }
}
