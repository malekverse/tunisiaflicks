"use client"
import { useId } from 'react'
import { m } from 'framer-motion'
import { cn } from '@/src/lib/utils'
import { spring } from '@/src/lib/motion'
import { useI18n } from '@/src/components/I18nProvider'
import { htmlLang, type Locale } from '@/src/lib/i18n'

const OPTIONS: { value: Locale, label: string }[] = [
  { value: 'en', label: 'EN' },
  { value: 'ar', label: 'عربي' },
  { value: 'tn', label: 'تونسي' },
]

/** EN / عربي / تونسي as a segmented control; the white pill slides to the chosen language. */
export default function LanguageSwitch({ className, stretch = false }: { className?: string, stretch?: boolean }) {
  const { locale, setLocale, t } = useI18n()
  const id = useId()
  return (
    <div role="radiogroup" aria-label={t('lang.label')} className={cn('relative flex rounded-full bg-white/[0.07] p-1', stretch && 'w-full', className)}>
      {OPTIONS.map((option) => {
        const active = locale === option.value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            lang={htmlLang(option.value)}
            onClick={() => !active && setLocale(option.value)}
            className={cn('relative h-8 rounded-full px-3.5 text-[13px] font-medium outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-red-500', stretch && 'flex-1', active ? 'text-black' : 'text-white/70 hover:text-white')}
          >
            {active && <m.span layoutId={`lang-pill-${id}`} transition={spring.snappy} className="absolute inset-0 rounded-full bg-white" />}
            <span className="relative">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}
