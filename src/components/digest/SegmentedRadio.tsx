"use client"
import React, { useId, useRef } from 'react'
import { m } from 'framer-motion'
import { useDir } from '@/src/components/I18nProvider'
import { spring } from '@/src/lib/motion'
import { cn } from '@/src/lib/utils'

export type SegmentedOption<V extends string> = {
  value: V
  label: React.ReactNode
  /** Read instead of the label (e.g. the language's own name for 'FR'). */
  ariaLabel?: string
  /** For a label in another language. */
  lang?: string
  icon?: React.ReactNode
}

/**
 * A few mutually exclusive choices as one control (a radio group): the white pill slides to the
 * chosen one, like the language switch. Arrow keys move the choice (in reading order, so they
 * follow RTL), Home/End jump to the ends; only the chosen option is in the tab order.
 */
export default function SegmentedRadio<V extends string>({ label, value, options, onChange, disabled, className, stretch }: {
  label: string
  value: V
  options: SegmentedOption<V>[]
  onChange: (value: V) => void
  disabled?: boolean
  className?: string
  /** Fill the width, options sharing it equally ('phone': only below the sm breakpoint). */
  stretch?: boolean | 'phone'
}) {
  const id = useId()
  const rtl = useDir() === 'rtl'
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  const choose = (index: number) => {
    const option = options[(index + options.length) % options.length]
    refs.current[(index + options.length) % options.length]?.focus()
    if (option.value !== value) onChange(option.value)
  }

  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    const forward = rtl ? 'ArrowLeft' : 'ArrowRight'
    const backward = rtl ? 'ArrowRight' : 'ArrowLeft'
    if (event.key === forward || event.key === 'ArrowDown') choose(index + 1)
    else if (event.key === backward || event.key === 'ArrowUp') choose(index - 1)
    else if (event.key === 'Home') choose(0)
    else if (event.key === 'End') choose(options.length - 1)
    else return
    event.preventDefault()
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-disabled={disabled || undefined}
      className={cn(
        'relative inline-flex items-center rounded-full bg-white/[0.07] p-1 ring-1 ring-inset ring-white/[0.05]',
        stretch === true && 'flex w-full',
        stretch === 'phone' && 'flex w-full sm:inline-flex sm:w-auto',
        disabled && 'opacity-50',
        className,
      )}
    >
      {options.map((option, index) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            ref={(node) => { refs.current[index] = node }}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={option.ariaLabel}
            lang={option.lang}
            tabIndex={active ? 0 : -1}
            disabled={disabled}
            onClick={() => !active && onChange(option.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              // The ::before stretches the touch target to the control's full height.
              'relative flex h-10 min-w-0 select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-[13.5px] font-medium outline-none transition-colors duration-200 [-webkit-tap-highlight-color:transparent] before:absolute before:inset-x-0 before:-inset-y-1 focus-visible:ring-2 focus-visible:ring-red-500 disabled:cursor-not-allowed',
              stretch === true && 'flex-1',
              stretch === 'phone' && 'flex-1 sm:flex-none',
              active ? 'text-black' : 'text-white/70 hover:text-white',
            )}
          >
            {active && <m.span layoutId={`segmented-${id}`} transition={spring.snappy} className="absolute inset-0 rounded-full bg-white shadow-[0_1px_8px_rgb(0_0_0/0.25)]" />}
            {option.icon && <span aria-hidden className="relative [&_svg]:h-4 [&_svg]:w-4">{option.icon}</span>}
            <span className="relative">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}
