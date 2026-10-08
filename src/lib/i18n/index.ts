// UI language: a tiny typed dictionary per locale (no i18n framework). The active locale lives in
// a cookie so server components and the root layout (<html lang dir>) can read it on every request.
//
// This module holds the dictionaries. The dependency-free parts live in ./locales (languages,
// direction, date locale) and ./translate (building `t()`), and are re-exported here; client
// components import those two files directly so the dictionaries stay out of their bundle.
import { en, type TKey } from './en'
import { ar } from './ar'
import { tn } from './tn'
import { featureStrings } from './features'
import { type Locale } from './locales'
import { translatorFrom, type Translate } from './translate'

export type { TKey }
export * from './locales'
export * from './translate'

// Each feature's strings (./features) join the core ones. Derja only overrides what it
// translates; the rest comes from Arabic, then English.
const english: Record<TKey, string> = { ...en, ...featureStrings('en') } as Record<TKey, string>
const arabic = { ...ar, ...featureStrings('ar') }
const dictionaries: Record<Locale, Partial<Record<TKey, string>>> = { en: english, ar: arabic, tn: { ...arabic, ...tn, ...featureStrings('tn') } }

/** `t('key', { name })` replaces `{name}` placeholders; a missing translation falls back to English. */
export function createTranslator(locale: Locale): Translate {
  return translatorFrom(dictionaries[locale] as Record<string, string>, english)
}
