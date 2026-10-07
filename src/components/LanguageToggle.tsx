"use client"
import React from 'react'
import { useI18n } from '@/src/components/I18nProvider'
import type { Locale } from '@/src/lib/i18n'

const OPTIONS: { value: Locale, label: string }[] = [
  { value: 'en', label: 'EN' },
  { value: 'ar', label: 'عربي' },
]

/** EN / عربي switch for the desktop navbar (the mobile drawer has its own row in the Sidebar). */
export default function LanguageToggle() {
  const { locale, setLocale, t } = useI18n()

  return (
    <div role="group" aria-label={t('lang.label')} className="flex shrink-0 items-center gap-0.5 rounded-xl bg-zinc-900 p-1 text-xs font-semibold">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          lang={option.value}
          aria-pressed={locale === option.value}
          onClick={() => locale !== option.value && setLocale(option.value)}
          className={`rounded-lg px-2.5 py-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 ${locale === option.value
            ? 'bg-red-500 text-white'
            : 'text-gray-300 hover:bg-zinc-700 hover:text-white'}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
