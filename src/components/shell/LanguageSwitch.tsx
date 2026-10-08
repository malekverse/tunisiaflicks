"use client"
import React, { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { m } from 'framer-motion'
import { Languages } from 'lucide-react'
import { cn } from '@/src/lib/utils'
import { haptic, spring } from '@/src/lib/motion'
import { useI18n } from '@/src/components/I18nProvider'
import { LOCALES, LOCALE_META, htmlLang, type Locale } from '@/src/lib/i18n/locales'

const OPEN_DELAY = 60
const CLOSE_DELAY = 260
/** Let the pill slide to the new language before the others fold away. */
const FOLD_AFTER_CHOICE = 650

/**
 * EN / FR / عربي / تونسي as a segmented control; the white pill slides to the chosen language
 * (it moves the moment you choose, while the page re-renders in that language behind it).
 *
 * - `compact` (the desktop top bar): only the current language shows, next to a language icon.
 *   Resting on it, tapping it or tabbing into it unfolds the others in place (their columns grow
 *   from zero width, 35ms apart, so nothing jumps); it folds back when the pointer or focus
 *   leaves, or on Escape.
 * - `stretch` (Settings, the phone menu): full width, 44px segments, the language names from
 *   420px up ('Français' doesn't fit a quarter of a 375px screen) and the short forms below.
 *
 * A radio group with roving focus: Tab reaches the chosen language, the arrow keys move between
 * languages (mirrored right to left), Home and End jump to the ends, and Enter or Space chooses.
 * Each option speaks its own name in its own language ("Français", "العربية").
 */
export default function LanguageSwitch({ className, stretch = false, compact = false, labelledBy, describedBy }: {
  className?: string
  stretch?: boolean
  compact?: boolean
  /** The id of a visible label for the group; otherwise it is labelled "Language". */
  labelledBy?: string
  /** The id of a hint describing the group. */
  describedBy?: string
}) {
  const { locale, pendingLocale, switching, setLocale, t, dir } = useI18n()
  const selected = pendingLocale ?? locale
  const id = useId()
  const [open, setOpen] = useState(!compact)
  const [focusIndex, setFocusIndex] = useState(() => LOCALES.indexOf(selected))
  const timer = useRef<ReturnType<typeof setTimeout>>()
  const root = useRef<HTMLDivElement>(null)
  const radios = useRef<(HTMLButtonElement | null)[]>([])
  const expanded = !compact || open
  // The one radio Tab reaches: the chosen language, or the one the arrow keys moved to.
  const tabStop = expanded ? focusIndex : LOCALES.indexOf(selected)

  // The tab stop goes back to the chosen language when nothing in here has focus.
  useEffect(() => {
    if (!root.current?.contains(document.activeElement)) setFocusIndex(LOCALES.indexOf(selected))
  }, [selected])
  const onGroupBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node)) setFocusIndex(LOCALES.indexOf(selected))
  }

  const schedule = (next: boolean, delay: number) => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setOpen(next), delay)
  }
  useEffect(() => () => clearTimeout(timer.current), [])

  // Touch screens: a tap elsewhere folds it; Escape folds it from anywhere.
  useEffect(() => {
    if (!compact || !open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [compact, open])

  const choose = (value: Locale) => {
    if (value !== selected) {
      haptic(8)
      setLocale(value)
    }
    if (compact) schedule(false, FOLD_AFTER_CHOICE)
  }

  const moveFocus = (index: number) => {
    const next = (index + LOCALES.length) % LOCALES.length
    setFocusIndex(next)
    radios.current[next]?.focus()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const forward = dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight'
    const back = dir === 'rtl' ? 'ArrowRight' : 'ArrowLeft'
    const current = Math.max(0, radios.current.findIndex((radio) => radio === document.activeElement))
    if (event.key === forward || event.key === 'ArrowDown') moveFocus(current + 1)
    else if (event.key === back || event.key === 'ArrowUp') moveFocus(current - 1)
    else if (event.key === 'Home') moveFocus(0)
    else if (event.key === 'End') moveFocus(LOCALES.length - 1)
    else if (event.key === 'Escape' && compact && open) {
      setOpen(false)
      radios.current[LOCALES.indexOf(selected)]?.focus()
    } else return
    event.preventDefault()
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
          tabIndex={-1}
          onClick={() => { clearTimeout(timer.current); setOpen((value) => !value) }}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-white/60 outline-none transition-colors duration-200 hover:text-white focus-visible:ring-2 focus-visible:ring-red-500"
        >
          <Languages aria-hidden className="h-4 w-4" />
        </button>
      )}
      <div
        role="radiogroup"
        aria-label={labelledBy ? undefined : t('lang.label')}
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        aria-busy={switching || undefined}
        onKeyDown={onKeyDown}
        onBlur={onGroupBlur}
        className={cn('flex items-center', stretch && 'w-full')}
      >
        {LOCALES.map((value, index) => {
          const meta = LOCALE_META[value]
          const active = selected === value
          const shown = expanded || active
          return (
            // A grid column that grows from 0fr to 1fr: the real width animates, no measuring.
            <div
              key={value}
              className={cn(
                'grid transition-[grid-template-columns,opacity,filter] ease-out',
                stretch && 'flex-1',
                shown ? 'grid-cols-[1fr] opacity-100 blur-0' : 'grid-cols-[0fr] opacity-0 blur-[3px]',
              )}
              style={{ transitionDuration: shown ? '320ms' : '220ms', transitionDelay: shown && !active && compact ? `${index * 35}ms` : '0ms' }}
            >
              <div className="min-w-0 overflow-hidden">
                <button
                  ref={(node) => { radios.current[index] = node }}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-label={meta.endonym}
                  aria-hidden={!shown || undefined}
                  tabIndex={shown && index === tabStop ? 0 : -1}
                  lang={htmlLang(value)}
                  onFocus={() => setFocusIndex(index)}
                  onClick={() => (active && compact ? setOpen((current) => !current) : choose(value))}
                  // The focus ring is drawn inside the option (an inset outline, and an inset ring on
                  // the white pill, which covers the outline): the column around each option clips
                  // anything outside it (that's how it folds), so a ring would show only at the corners.
                  className={cn(
                    'group/lang relative whitespace-nowrap rounded-full font-medium outline-none transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-red-500',
                    stretch ? 'h-11 w-full px-3 text-[14px]' : 'h-8 px-3.5 text-[13px]',
                    active ? 'text-black' : 'text-white/70 hover:text-white',
                  )}
                >
                  {active && <m.span layoutId={`lang-pill-${id}`} transition={spring.snappy} className="absolute inset-0 rounded-full bg-white ring-red-500 ring-inset group-focus-visible/lang:ring-2" />}
                  {stretch ? (
                    <>
                      <span className="relative min-[420px]:hidden">{meta.short}</span>
                      <span className="relative hidden min-[420px]:inline">{meta.label}</span>
                    </>
                  ) : (
                    <span className="relative">{meta.short}</span>
                  )}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
