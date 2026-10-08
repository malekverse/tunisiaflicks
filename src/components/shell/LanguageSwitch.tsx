"use client"
import { useEffect, useId, useRef, useState } from 'react'
import { m } from 'framer-motion'
import { Languages } from 'lucide-react'
import { cn } from '@/src/lib/utils'
import { spring } from '@/src/lib/motion'
import { useI18n } from '@/src/components/I18nProvider'
import { htmlLang, type Locale } from '@/src/lib/i18n'

const OPTIONS: { value: Locale, label: string }[] = [
  { value: 'en', label: 'EN' },
  { value: 'ar', label: 'عربي' },
  { value: 'tn', label: 'تونسي' },
]

const OPEN_DELAY = 60
const CLOSE_DELAY = 260

/**
 * EN / عربي / تونسي as a segmented control; the white pill slides to the chosen language.
 *
 * `compact` (the top bar): only the current language shows, next to a language icon. Resting on
 * it, tapping it or tabbing into it unfolds the other languages in place (their columns grow from
 * zero width, so nothing jumps), and it folds back when the pointer or focus leaves.
 */
export default function LanguageSwitch({ className, stretch = false, compact = false }: {
  className?: string
  stretch?: boolean
  compact?: boolean
}) {
  const { locale, setLocale, t } = useI18n()
  const id = useId()
  const [open, setOpen] = useState(!compact)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  const root = useRef<HTMLDivElement>(null)
  const expanded = !compact || open

  const schedule = (next: boolean, delay: number) => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setOpen(next), delay)
  }
  useEffect(() => () => clearTimeout(timer.current), [])

  // Touch screens: a tap elsewhere folds it.
  useEffect(() => {
    if (!compact || !open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [compact, open])

  const choose = (value: Locale) => {
    if (value !== locale) setLocale(value)
    // Let the pill slide to the new language before the others fold away.
    if (compact) schedule(false, 650)
  }

  return (
    <div
      ref={root}
      onMouseEnter={compact ? (event) => { if (event.nativeEvent instanceof MouseEvent && matchMedia('(hover: hover)').matches) schedule(true, OPEN_DELAY) } : undefined}
      onMouseLeave={compact ? () => schedule(false, CLOSE_DELAY) : undefined}
      onFocus={compact ? () => { clearTimeout(timer.current); setOpen(true) } : undefined}
      onBlur={compact ? (event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) schedule(false, 120) } : undefined}
      className={cn('relative flex items-center rounded-full bg-white/[0.07] p-1', stretch && 'w-full', className)}
    >
      {compact && (
        <button
          type="button"
          aria-label={t('lang.label')}
          aria-expanded={open}
          onClick={() => { clearTimeout(timer.current); setOpen((value) => !value) }}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-white/60 outline-none transition-colors duration-200 hover:text-white focus-visible:ring-2 focus-visible:ring-red-500"
        >
          <Languages aria-hidden className="h-4 w-4" />
        </button>
      )}
      <div role="radiogroup" aria-label={t('lang.label')} className={cn('flex items-center', stretch && 'w-full')}>
        {OPTIONS.map((option, index) => {
          const active = locale === option.value
          const shown = expanded || active
          return (
            // A grid column that grows from 0fr to 1fr: the real width animates, no measuring.
            <div
              key={option.value}
              className={cn(
                'grid transition-[grid-template-columns,opacity,filter] ease-out',
                stretch && 'flex-1',
                shown ? 'grid-cols-[1fr] opacity-100 blur-0' : 'grid-cols-[0fr] opacity-0 blur-[3px]',
              )}
              style={{ transitionDuration: shown ? '320ms' : '220ms', transitionDelay: shown && !active && compact ? `${index * 35}ms` : '0ms' }}
            >
              <div className="min-w-0 overflow-hidden">
                <button
                  type="button"
                  role="radio"
                  aria-checked={active}
                  tabIndex={shown ? 0 : -1}
                  aria-hidden={!shown || undefined}
                  lang={htmlLang(option.value)}
                  onClick={() => (active && compact ? setOpen((value) => !value) : choose(option.value))}
                  className={cn(
                    'relative h-8 whitespace-nowrap rounded-full px-3.5 text-[13px] font-medium outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-red-500',
                    stretch && 'w-full',
                    active ? 'text-black' : 'text-white/70 hover:text-white',
                  )}
                >
                  {active && <m.span layoutId={`lang-pill-${id}`} transition={spring.snappy} className="absolute inset-0 rounded-full bg-white" />}
                  <span className="relative">{option.label}</span>
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
