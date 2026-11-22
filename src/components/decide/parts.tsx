"use client"
// Small pieces every way of deciding shares: the full-screen stage it plays on, a person's badge,
// a poster tile, and the segmented switch.
import React, { useEffect, useId, useRef } from 'react'
import { m } from 'framer-motion'
import { X } from 'lucide-react'
import TmdbImage from '@/src/components/TmdbImage'
import { useT } from '@/src/components/I18nProvider'
import { spring, tween } from '@/src/lib/motion'
import { cn } from '@/src/lib/utils'
import type { Pick } from '@/src/lib/decide'
import { PERSON_COLORS, type DecidePerson } from './storage'

/** A person's first letter on their colour. */
export function Avatar({ person, size = 28, className }: { person: DecidePerson, size?: number, className?: string }) {
  const letter = Array.from(person.name.trim())[0]?.toLocaleUpperCase() ?? '?'
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, background: PERSON_COLORS[person.color % PERSON_COLORS.length], fontSize: Math.round(size * 0.46) }}
      className={cn('inline-grid shrink-0 place-items-center rounded-full font-bold leading-none text-black/85', className)}
    >
      {letter}
    </span>
  )
}

/** A poster, 2:3, with its title for screen readers. */
export function Poster({ pick, sizes, className, priority = false, children }: {
  pick: Pick
  sizes: string
  className?: string
  priority?: boolean
  children?: React.ReactNode
}) {
  return (
    <span className={cn('relative block aspect-[2/3] overflow-hidden rounded-[12px] bg-white/[0.06] ring-1 ring-inset ring-white/10', className)}>
      {pick.poster_path ? (
        <TmdbImage kind="poster" path={pick.poster_path} fill sizes={sizes} alt="" priority={priority} className="object-cover" />
      ) : (
        <span className="absolute inset-0 grid place-items-center p-3 text-center text-[13px] font-semibold leading-snug text-white/70">
          <bdi dir="auto">{pick.title}</bdi>
        </span>
      )}
      {children}
    </span>
  )
}

/** A two-or-three-way switch (the pill that slides). */
export function Segmented<T extends string | number>({ value, options, onChange, label, className }: {
  value: T
  options: { value: T, label: string, disabled?: boolean }[]
  onChange: (value: T) => void
  label: string
  className?: string
}) {
  const id = useId()
  return (
    <div role="radiogroup" aria-label={label} className={cn('relative flex rounded-full bg-white/[0.06] p-1', className)}>
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              'relative h-10 min-w-0 flex-1 rounded-full px-3 text-[13.5px] font-medium outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-40',
              active ? 'text-black' : 'text-white/70 hover:text-white',
            )}
          >
            {active && <m.span layoutId={`${id}-pill`} transition={spring.snappy} className="absolute inset-0 rounded-full bg-white" />}
            <span className="relative block truncate">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}

/**
 * The full-screen stage a way of deciding plays on: its name at the top, a way out, and the room
 * dimmed in the light of the picks. Escape closes it.
 */
export function Stage({ title, subtitle, onClose, glow, children }: {
  title: string
  subtitle?: string | null
  onClose: () => void
  /** A poster to light the room with. */
  glow?: string | null
  children: React.ReactNode
}) {
  const t = useT()
  const titleId = useId()
  const heading = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    heading.current?.focus({ preventScroll: true })
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [onClose])

  return (
    <m.div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: tween.base }}
      exit={{ opacity: 0, transition: tween.fast }}
      className="fixed inset-0 z-[70] overflow-y-auto overscroll-contain bg-black"
    >
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        {glow && <TmdbImage kind="poster" path={glow} fill sizes="30vw" shimmer={false} alt="" className="scale-125 object-cover opacity-30 blur-3xl" />}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgb(0_0_0/0.35),rgb(0_0_0/0.92)_70%)]" />
      </div>

      <div className="sticky top-0 z-10 flex items-center gap-3 bg-gradient-to-b from-black/80 to-transparent px-4 pb-6 pt-[calc(env(safe-area-inset-top,0px)+14px)] sm:px-6">
        <div className="min-w-0 flex-1">
          <h2 id={titleId} ref={heading} tabIndex={-1} className="truncate font-display text-[22px] font-bold leading-tight text-white outline-none sm:text-[26px]">{title}</h2>
          {subtitle && <p className="mt-0.5 truncate text-[13px] text-white/60">{subtitle}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('common.close')}
          className="pressable glass grid h-11 w-11 shrink-0 place-items-center rounded-full text-white/85 outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-red-500"
        >
          <X aria-hidden className="h-5 w-5" />
        </button>
      </div>

      <div className="mx-auto w-full max-w-[980px] px-4 pb-[calc(env(safe-area-inset-bottom,0px)+40px)] sm:px-6">{children}</div>
    </m.div>
  )
}
