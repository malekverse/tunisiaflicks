// Server-side access to the UI language (server components, generateMetadata, route handlers).
import { cookies } from 'next/headers'
import { DEFAULT_LOCALE, LOCALE_COOKIE, createTranslator, isLocale, type Locale } from '.'

export function getLocale(): Locale {
  const value = cookies().get(LOCALE_COOKIE)?.value
  return isLocale(value) ? value : DEFAULT_LOCALE
}

export function getT() {
  return createTranslator(getLocale())
}
