"use client"
import React, { createContext, useContext, useEffect, useRef } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'
import { cn } from '@/src/lib/utils'

/**
 * Chips and chip rows. Pick the ChipGroup mode by what the chips DO, never by looks:
 * - `single`: one filter at a time (radio group; arrows move and select, one tab stop).
 * - `multi`: toggles, several at once (aria-pressed).
 * - `nav`: links to other pages or views (a <nav>; the current one has aria-current="page").
 * - `tabs`: swaps panels on this page (tablist; arrows move focus, Enter or Space selects).
 * - `none`: a plain list (labels, removable values).
 * A removable chip's X is its own button beside the chip, never inside it.
 */
type ChipMode = 'single' | 'multi' | 'nav' | 'tabs' | 'none'

const ChipModeContext = createContext<ChipMode | null>(null)

export type ChipProps = {
  children: React.ReactNode
  active?: boolean
  icon?: React.ComponentType<{ className?: string }>
  count?: number
  href?: string
  onClick?: () => void
  onRemove?: () => void
  removeLabel?: string
  /** `tabs` mode: the id of the panel this tab shows. */
  controls?: string
  disabled?: boolean
  className?: string
}

const SHAPE = 'inline-flex h-10 shrink-0 select-none items-center whitespace-nowrap rounded-full text-[13.5px] font-medium [-webkit-touch-callout:none]'
const TONE = {
  on: 'bg-white text-black',
  off: 'bg-white/[0.06] text-white/75 hover:bg-white/[0.1] hover:text-white',
}

function ChipContent({ icon: Icon, count, active, children }: Pick<ChipProps, 'icon' | 'count' | 'active' | 'children'>) {
  return (
    <>
      {Icon && (
        <span aria-hidden className="-ms-0.5 grid shrink-0 place-items-center">
          <Icon className="h-4 w-4" />
        </span>
      )}
      <span className="min-w-0">{children}</span>
      {count !== undefined && <span className={cn('tabular-nums', active ? 'text-black/55' : 'text-white/50')}>{count}</span>}
    </>
  )
}

export function Chip({ children, active = false, icon, count, href, onClick, onRemove, removeLabel, controls, disabled, className }: ChipProps) {
  const mode = useContext(ChipModeContext)
  const content = <ChipContent icon={icon} count={count} active={active}>{children}</ChipContent>

  // A value with its own remove button: the chip is plain text, the X is a sibling button whose
  // 44px touch target hangs over the chip's edge (negative margins) around a 32px disc.
  if (onRemove) {
    return (
      <span className={cn(SHAPE, 'gap-2 ps-4 pe-1', active ? TONE.on : 'bg-white/[0.06] text-white/85', disabled && 'opacity-40', className)}>
        <ChipContent icon={icon} count={count} active={active}>{children}</ChipContent>
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          aria-label={removeLabel}
          title={removeLabel}
          className="group/remove -my-0.5 -me-1.5 -ms-1 grid h-11 w-11 shrink-0 select-none place-items-center rounded-full outline-none [-webkit-tap-highlight-color:transparent] disabled:pointer-events-none"
        >
          <span
            aria-hidden
            className={cn(
              'grid h-8 w-8 place-items-center rounded-full transition-[transform,background-color] duration-150 ease-out group-active/remove:scale-90 group-focus-visible/remove:ring-2 group-focus-visible/remove:ring-red-500',
              active ? 'group-hover/remove:bg-black/10' : 'text-white/70 group-hover/remove:bg-white/[0.12] group-hover/remove:text-white',
            )}
          >
            <X className="h-4 w-4" strokeWidth={2.2} />
          </span>
        </button>
      </span>
    )
  }

  const look = cn(
    SHAPE,
    'pressable gap-2 px-4 outline-none transition-[transform,background-color,color] duration-200 ease-out focus-visible:ring-2 focus-visible:ring-red-500',
    active ? TONE.on : TONE.off,
    disabled && 'pointer-events-none opacity-40',
    className,
  )

  if (href) {
    if (disabled) return <span aria-disabled className={look}>{content}</span>
    return (
      <Link href={href} data-chip="" aria-current={active ? 'page' : undefined} className={look}>
        {content}
      </Link>
    )
  }

  const roving = mode === 'single' || mode === 'tabs'
  const state =
    mode === 'single' ? { role: 'radio', 'aria-checked': active }
      : mode === 'tabs' ? { role: 'tab', 'aria-selected': active, 'aria-controls': controls }
        : mode === 'multi' || mode === null ? { 'aria-pressed': active }
          : {}
  return (
    <button
      type="button"
      data-chip=""
      {...state}
      tabIndex={roving ? (active ? 0 : -1) : undefined}
      disabled={disabled}
      onClick={onClick}
      className={look}
    >
      {content}
    </button>
  )
}

const chipsIn = (node: HTMLElement | null) =>
  Array.from(node?.querySelectorAll<HTMLElement>('[data-chip]:not([disabled])') ?? [])

/** A row of chips with the semantics of its `mode` (see above). `scroll`: a sideways rail on phones. */
export function ChipGroup({ label, mode = 'single', scroll = false, children, className }: {
  label: string
  mode?: ChipMode
  scroll?: boolean
  children: React.ReactNode
  className?: string
}) {
  const ref = useRef<HTMLDivElement & HTMLElement>(null)
  const roving = mode === 'single' || mode === 'tabs'

  // One tab stop: the selected chip, or the first one while nothing is selected.
  useEffect(() => {
    if (!roving) return
    const items = chipsIn(ref.current)
    if (items.length > 0 && !items.some((item) => item.tabIndex === 0)) items[0].tabIndex = 0
  })

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (!roving) return
    const items = chipsIn(ref.current)
    const current = items.indexOf(document.activeElement as HTMLElement)
    if (current < 0) return
    const rtl = getComputedStyle(ref.current!).direction === 'rtl'
    let next: number
    switch (event.key) {
      case 'ArrowRight': next = current + (rtl ? -1 : 1); break
      case 'ArrowLeft': next = current + (rtl ? 1 : -1); break
      case 'ArrowDown': next = current + 1; break
      case 'ArrowUp': next = current - 1; break
      case 'Home': next = 0; break
      case 'End': next = items.length - 1; break
      default: return
    }
    event.preventDefault()
    const target = items[(next + items.length) % items.length]
    target.focus()
    target.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    // Radios select as they move; tabs wait for Enter or Space (manual activation).
    if (mode === 'single') target.click()
  }

  const row = cn(
    'flex gap-2',
    scroll
      ? 'no-scrollbar -mx-[var(--gutter)] min-w-0 flex-nowrap overflow-x-auto overflow-y-hidden overscroll-x-contain px-[var(--gutter)] py-1 [scroll-padding-inline:var(--gutter)] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0'
      : 'shrink-0 flex-wrap',
    className,
  )

  let body: React.ReactNode
  if (mode === 'nav') {
    body = <nav ref={ref} aria-label={label} className={row}>{children}</nav>
  } else if (mode === 'none') {
    body = (
      <div ref={ref} role="list" aria-label={label} className={row}>
        {React.Children.map(children, (child) => child && <span role="listitem" className="inline-flex shrink-0">{child}</span>)}
      </div>
    )
  } else {
    const role = mode === 'single' ? 'radiogroup' : mode === 'tabs' ? 'tablist' : 'group'
    body = <div ref={ref} role={role} aria-label={label} onKeyDown={onKeyDown} className={row}>{children}</div>
  }
  return <ChipModeContext.Provider value={mode}>{body}</ChipModeContext.Provider>
}
