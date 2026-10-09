// UI language: a tiny typed dictionary per locale (no i18n framework). The active locale lives in
// a cookie so server components and the root layout (<html lang dir>) can read it on every request.
//
// This module holds the dictionaries. The dependency-free parts live in ./locales (languages,
// direction, date locale) and ./translate (building `t()`), and are re-exported here; client
// components import those two files directly so the dictionaries stay out of their bundle (the
// server hands the I18nProvider the strings they need in the active language, see clientMessages).
import { en, type TKey } from './en'
import { ar } from './ar'
import { tn } from './tn'
import { fr } from './fr'
import { featureStrings } from './features'
import { type Locale } from './locales'
import { translatorFrom, type Translate } from './translate'
import { SCOPE_KEYS, SERVER_ONLY_KEYS, type MessageScope } from './client-keys'

export type { TKey, MessageScope }
export * from './locales'
export * from './translate'

// Each feature's strings (./features) join the core ones. English is complete. Arabic covers every
// key; Derja only overrides what it translates (the rest comes from Arabic, then English); French
// covers the core keys and whatever each feature translates (the rest comes from English).
const english: Record<TKey, string> = { ...en, ...featureStrings('en') } as Record<TKey, string>
const arabic = { ...ar, ...featureStrings('ar') }
const dictionaries: Record<Locale, Partial<Record<TKey, string>>> = {
  en: english,
  fr: { ...fr, ...featureStrings('fr') },
  ar: arabic,
  tn: { ...arabic, ...tn, ...featureStrings('tn') },
}

/** `t('key', { name })` replaces `{name}` placeholders; a missing translation falls back to English. */
export function createTranslator(locale: Locale): Translate {
  return translatorFrom(dictionaries[locale] as Record<string, string>, english)
}

const complete = new Map<Locale, Record<string, string>>()

/** Every string of `locale`, English filling the gaps. */
export function dictionaryFor(locale: Locale): Record<string, string> {
  let messages = complete.get(locale)
  if (!messages) {
    messages = { ...english, ...dictionaries[locale] } as Record<string, string>
    complete.set(locale, messages)
  }
  return messages
}

const serverOnly = new Set(SERVER_ONLY_KEYS)
const scoped = new Set(Object.values<readonly string[]>(SCOPE_KEYS).flat())
const sent = new Map<string, Record<string, string>>()

/**
 * The strings of `locale` that client components translate with, so they don't bundle every
 * language, and pages don't carry every string in their HTML (see ./client-keys.ts). Without a
 * scope, the shell: what the root layout hands the I18nProvider, on every page. With one, what the
 * client components under that <ClientMessages scope> add.
 */
export function clientMessages(locale: Locale, scope?: MessageScope): Record<string, string> {
  const id = `${locale}:${scope ?? ''}`
  let messages = sent.get(id)
  if (!messages) {
    const all = dictionaryFor(locale)
    const keys = scope ? SCOPE_KEYS[scope] : Object.keys(all).filter((key) => !serverOnly.has(key) && !scoped.has(key))
    messages = Object.fromEntries(keys.filter((key) => key in all).map((key) => [key, all[key]]))
    sent.set(id, messages)
  }
  return messages
}
