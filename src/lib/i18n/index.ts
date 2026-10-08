// UI language: a tiny typed dictionary per locale (no i18n framework). The active locale lives in
// a cookie so server components and the root layout (<html lang dir>) can read it on every request.
import { en, type TKey } from './en'
import { ar } from './ar'
import { tn } from './tn'
import { featureStrings } from './features'

export type { TKey }
/** English, Modern Standard Arabic, and Tunisian Arabic (Derja). */
export type Locale = 'en' | 'ar' | 'tn'
export type Dir = 'ltr' | 'rtl'
export type TVars = Record<string, string | number>
export type Translate = (key: TKey, vars?: TVars) => string

export const LOCALES: Locale[] = ['en', 'ar', 'tn']
export const DEFAULT_LOCALE: Locale = 'en'
export const LOCALE_COOKIE = 'tf-locale'

// Each feature's strings (./features) join the core ones. Derja only overrides what it
// translates; the rest comes from Arabic, then English.
const english: Record<TKey, string> = { ...en, ...featureStrings('en') } as Record<TKey, string>
const arabic = { ...ar, ...featureStrings('ar') }
const dictionaries: Record<Locale, Partial<Record<TKey, string>>> = { en: english, ar: arabic, tn: { ...arabic, ...tn, ...featureStrings('tn') } }

export const isLocale = (value: unknown): value is Locale => value === 'en' || value === 'ar' || value === 'tn'
/** Arabic and Derja: right-to-left, Arabic font, Arabic TMDB data. */
export const isArabicScript = (locale: Locale) => locale !== 'en'
export const dirOf = (locale: Locale): Dir => (isArabicScript(locale) ? 'rtl' : 'ltr')
/** BCP 47 tag for <html lang>. */
export const htmlLang = (locale: Locale) => (locale === 'tn' ? 'ar-TN' : locale)

/**
 * Locale for `Intl` / `toLocaleDateString`. Arabic uses Tunisian month names with Latin digits
 * (`-u-nu-latn`); English keeps the browser default, as before.
 */
export const dateLocale = (locale: Locale): string | undefined => (isArabicScript(locale) ? 'ar-TN-u-nu-latn' : undefined)

/** `t('key', { name })` replaces `{name}` placeholders; a missing translation falls back to English. */
export function createTranslator(locale: Locale): Translate {
  const dictionary = dictionaries[locale]
  return (key, vars) => {
    const text = dictionary[key] ?? english[key] ?? key
    return vars ? text.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match)) : text
  }
}

// Messages the /api/auth/* routes answer with (always English), mapped to dictionary keys.
const API_MESSAGES: Record<string, TKey> = {
  'Email is required': 'api.emailRequired',
  'If your email is registered, you will receive a password reset link': 'api.resetIfRegistered',
  'An error occurred while processing your request': 'api.requestFailed',
  'Token and password are required': 'api.tokenRequired',
  'Invalid or expired reset token': 'api.invalidToken',
  'An error occurred while resetting your password': 'api.resetFailed',
  'Missing required fields': 'api.missingFields',
  'Password must be at least 8 characters': 'api.passwordMin8',
  'User already exists': 'api.userExists',
  'Error creating user': 'api.createFailed',
  'Too many attempts. Please try again later.': 'api.tooManyAttempts',
}

/** Translates a known API message; anything else is returned unchanged. */
export function translateApiMessage(t: Translate, message?: string): string | undefined {
  const key = message ? API_MESSAGES[message] : undefined
  return key ? t(key) : message
}
