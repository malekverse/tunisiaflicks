"use client"
import * as React from 'react'
import { m } from 'framer-motion'
import { cn } from '@/src/lib/utils'
import { haptic, spring } from '@/src/lib/motion'
import { useDir } from '@/src/components/I18nProvider'

// Track 50px, 3px padding, 24px knob: the knob travels 20px.
const TRAVEL = 20

type SwitchProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange' | 'value'> & {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}

/**
 * An on/off switch: a pill track with a knob that springs to the other end. The button is a 44px
 * touch target around the smaller track. Lit (red) only when on: the room's signal light.
 * The knob travels towards the end side, so it follows the reading direction in RTL.
 */
export const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  function Switch({ checked, onCheckedChange, disabled, className, onClick, ...props }, ref) {
    const rtl = useDir() === 'rtl'
    return (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={(event) => {
        onClick?.(event)
        if (event.defaultPrevented) return
        haptic(8)
        onCheckedChange(!checked)
      }}
      className={cn(
        'group/switch relative -my-1.5 inline-flex h-11 w-[58px] shrink-0 cursor-pointer select-none items-center justify-center rounded-full outline-none [-webkit-tap-highlight-color:transparent] disabled:cursor-not-allowed disabled:opacity-40',
        className,
      )}
      {...props}
    >
      <span
        aria-hidden
        className={cn(
          'flex h-[30px] w-[50px] items-center rounded-full p-[3px] ring-1 ring-inset transition-[background-color,box-shadow] duration-200 ease-out group-focus-visible/switch:outline group-focus-visible/switch:outline-2 group-focus-visible/switch:outline-offset-2 group-focus-visible/switch:outline-red-500',
          checked ? 'bg-red-600 ring-white/10' : 'bg-white/[0.14] ring-white/[0.06] group-hover/switch:bg-white/[0.18]',
        )}
      >
        {/* initial={false}: the server-rendered knob already sits where it belongs (no slide on load). */}
        <m.span
          initial={false}
          animate={{ x: checked ? (rtl ? -TRAVEL : TRAVEL) : 0 }}
          transition={spring.snappy}
          className="block h-6 w-6 rounded-full bg-white shadow-[0_2px_6px_rgb(0_0_0/0.35)]"
        />
      </span>
    </button>
    )
  }
)

/**
 * A settings row: label and hint on the start side, the switch on the end side. The whole row is
 * clickable (the label points at the switch).
 */
export function SwitchRow({ id, checked, onCheckedChange, disabled, label, hint, className }: {
  id: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  label: React.ReactNode
  hint?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-center justify-between gap-5 py-3.5', className)}>
      <label htmlFor={id} className={cn('min-w-0 flex-1', disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer')}>
        <span className="block text-[15px] font-medium text-white">{label}</span>
        {hint && <span id={`${id}-hint`} className="mt-0.5 block text-[13px] leading-snug text-white/55">{hint}</span>}
      </label>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} aria-describedby={hint ? `${id}-hint` : undefined} />
    </div>
  )
}
