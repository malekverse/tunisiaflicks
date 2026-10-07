// Small helpers shared by the login and sign-up forms (client side).

/** The address typed on the sign-up form, handed to the login form once (never through the URL). */
export const SIGNUP_EMAIL_KEY = 'tf-signup-email'

/** Where to go after signing in: the profile picker, then back to where the visitor came from. */
export const afterSignIn = (callbackUrl?: string) => (callbackUrl ? `/profiles?next=${encodeURIComponent(callbackUrl)}` : '/profiles')

/** Carries the return address between the login and sign-up pages. */
export function withCallback(path: string, callbackUrl?: string, extra?: Record<string, string>) {
  const query = new URLSearchParams({ ...(callbackUrl ? { callbackUrl } : {}), ...extra }).toString()
  return query ? `${path}?${query}` : path
}
