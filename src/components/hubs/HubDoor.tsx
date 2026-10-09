import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/src/lib/utils'

// A door into a hub: one card-wide link lit in the hub's colour. Used by SeasonalBanner (the same
// shell, see DOOR_SHELL), the Tunisian hub doors, /dramas and the /tunisian/cinema link to the map.
// Server-safe: no hooks, no client code.

/**
 * The card: a gradient of the accent from the start side (flipped in Arabic), a hairline of it
 * that brightens on hover, a slight press. Set `--door` ('r g b') on the element.
 */
export const DOOR_SHELL = cn(
  'group pressable relative isolate flex min-h-[72px] items-center gap-4 overflow-hidden rounded-[22px] px-4 py-4 outline-none sm:px-5',
  'bg-gradient-to-r from-[rgb(var(--door)/0.16)] via-[rgb(var(--door)/0.06)] to-transparent rtl:bg-gradient-to-l',
  // The press is quick (150ms, a strong ease-out, as .pressable); the ring's brightening rides along.
  'ring-1 ring-[rgb(var(--door)/0.22)] transition-[box-shadow,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:ring-[rgb(var(--door)/0.4)]',
  'active:scale-[0.985] focus-visible:ring-2 focus-visible:ring-red-500',
)

/** The icon disk: 40px on phones, 48px from sm, a wash and a glow of the accent. */
export const DOOR_DISK = cn(
  'grid h-10 w-10 shrink-0 place-items-center rounded-full sm:h-12 sm:w-12',
  'bg-[rgb(var(--door)/0.14)] text-[rgb(var(--door))] shadow-[0_0_28px_rgb(var(--door)/0.28)]',
)

/** The trailing chevron, pointing the reading way. */
export function DoorChevron({ className }: { className?: string }) {
  return (
    <ChevronRight
      aria-hidden
      className={cn(
        'h-5 w-5 shrink-0 text-white/60 transition-transform duration-200 ease-out group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5',
        className,
      )}
    />
  )
}

/**
 * A hub door: icon disk, title, one line of text, an optional badge (a LiveDot, a count) and a
 * chevron. `accent` is the hub's 'r g b' colour, used only for light (never for text a person
 * has to read).
 */
export default function HubDoor({ href, title, text, icon, accent, badge, className }: {
  href: string
  title: string
  text?: string
  icon: React.ReactNode
  accent: string
  badge?: React.ReactNode
  className?: string
}): JSX.Element {
  return (
    <Link href={href} className={cn(DOOR_SHELL, className)} style={{ '--door': accent } as React.CSSProperties}>
      <span aria-hidden className={DOOR_DISK}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-[17px] font-bold leading-tight text-white sm:text-[20px]" dir="auto">{title}</span>
        {text && <span className="mt-0.5 block truncate text-[13px] text-white/70 sm:text-[14px]">{text}</span>}
      </span>
      {badge && <span className="shrink-0">{badge}</span>}
      <DoorChevron />
    </Link>
  )
}
