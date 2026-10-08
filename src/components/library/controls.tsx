"use client"
import React from 'react'
import { ArrowDownUp } from 'lucide-react'
import { cn } from '@/src/lib/utils'

/**
 * A small round button laid over a poster's corner (remove, reorder). The visible disc is 32px;
 * the button around it is a 44px touch target. Touch screens always show it; with a mouse it
 * appears when the card is hovered or focused (the card is `group/item`).
 */
export function CardAction({ label, onClick, disabled, children, className, tone = 'default' }: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
  className?: string
  /** `danger` turns red under the pointer. */
  tone?: 'default' | 'danger'
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onClick()
      }}
      className={cn(
        'group/action z-20 grid h-11 w-11 select-none place-items-center rounded-full outline-none transition-opacity duration-200 ease-out [-webkit-tap-highlight-color:transparent] disabled:pointer-events-none [@media(hover:hover)_and_(pointer:fine)]:opacity-0 group-hover/item:opacity-100 group-focus-within/item:opacity-100 focus-visible:opacity-100',
        className,
      )}
    >
      <span
        className={cn(
          'glass grid h-8 w-8 place-items-center rounded-full text-white shadow-[0_6px_18px_-6px_rgb(0_0_0/0.9)] transition-[transform,background-color,color] duration-150 ease-out group-active/action:scale-90 group-disabled/action:opacity-40 group-focus-visible/action:ring-2 group-focus-visible/action:ring-red-500',
          tone === 'danger' ? 'group-hover/action:bg-red-600 group-hover/action:text-white' : 'group-hover/action:bg-white/25',
        )}
      >
        {children}
      </span>
    </button>
  )
}

// The filter chips moved to the shared chip primitive (default mode: a single-choice radio group,
// as these always were). Re-exported so the library's toolbars keep their imports.
export { Chip, ChipGroup } from '@/src/components/ui/chip'

/** Newest first / oldest first, as one button that flips. */
export function SortToggle({ label, value, onToggle, ariaLabel }: { label: string, value: 'newest' | 'oldest', onToggle: () => void, ariaLabel: string }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={`${ariaLabel}: ${label}`}
      className="pressable inline-flex h-10 shrink-0 select-none items-center gap-2 whitespace-nowrap rounded-full bg-white/[0.06] px-4 text-[13.5px] font-medium text-white/80 outline-none transition-colors duration-200 hover:bg-white/[0.1] hover:text-white focus-visible:ring-2 focus-visible:ring-red-500"
    >
      <ArrowDownUp aria-hidden className={cn('h-4 w-4 transition-transform duration-300 ease-out', value === 'oldest' && 'rotate-180')} strokeWidth={2} />
      {label}
    </button>
  )
}

/** A strip of controls that scrolls sideways on phones and wraps on bigger screens. */
export function Toolbar({ children }: { children: React.ReactNode }) {
  return (
    <div className="no-scrollbar -mx-[var(--gutter)] flex items-center gap-2 overflow-x-auto overflow-y-hidden overscroll-x-contain px-[var(--gutter)] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
      {children}
    </div>
  )
}

export const ToolbarDivider = () => <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-white/10" />
