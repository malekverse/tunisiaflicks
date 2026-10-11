// The app's strings in the chosen language: const t = useT(); t('nav.home').
import { useCallback } from 'react'
import { I18nManager } from 'react-native'
import { useStore } from '@/lib/store'
import { isRtl, translate, type Locale, type StringKey } from './strings'

export { LOCALES, isRtl, type Locale, type StringKey } from './strings'

export function useT() {
  const locale = useStore((state) => state.locale)
  return useCallback((key: StringKey, vars?: Record<string, string | number>) => translate(locale, key, vars), [locale])
}

export const useLocale = () => useStore((state) => state.locale)

/** Whether the chosen language reads right to left (Arabic, Tunisian). */
export const useIsArabic = () => isRtl(useStore((state) => state.locale))

/**
 * Whether the layout the app started with doesn't match the chosen language's direction: Android
 * flips layouts only at launch, so the app has to restart (see the language setting).
 */
export const directionMismatch = (locale: Locale) => I18nManager.isRTL !== isRtl(locale)
