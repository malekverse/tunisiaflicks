// Server-side access to the UI language (server components, generateMetadata, route handlers).
import { cookies, headers } from 'next/headers'
import { LOCALE_COOKIE, createTranslator, resolveLocale, type Locale } from '.'

/**
 * The chosen UI language: the cookie set by the language switch; before any choice, the first of
 * English, French or Arabic in the browser's `Accept-Language`; English otherwise. Derja is never
 * guessed (no browser asks for it): only chosen.
 */
export function getLocale(): Locale {
  return resolveLocale(cookies().get(LOCALE_COOKIE)?.value, headers().get('accept-language'))
}

export function getT() {
  return createTranslator(getLocale())
}
