"use client"
// One action inside the ShareSheet ("Plan a movie night", "Add to a list"): an icon disk, a label,
// an optional hint, and a chevron. A link when it goes somewhere, a button when it does something.
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/src/lib/utils'

export function ShareActionRow({ icon, label, hint, href, onSelect }: { icon: React.ReactNode; label: string; hint?: string; href?: string; onSelect?: () => void }): JSX.Element {
  const className = cn(
    'group pressable flex min-h-[56px] w-full items-center gap-3.5 rounded-2xl px-3 py-2 text-start outline-none transition-colors duration-150',
    'hover:bg-white/[0.06] focus-visible:bg-white/[0.08] focus-visible:ring-2 focus-visible:ring-red-500',
  )
  const content = (
    <>
      <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/[0.08] text-white [&_svg]:h-5 [&_svg]:w-5">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium text-white">{label}</span>
        {hint && <span className="mt-0.5 block truncate text-[13px] text-white/55">{hint}</span>}
      </span>
      <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-white/40 transition-transform duration-200 ease-out group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
    </>
  )
  if (href) return <Link href={href} onClick={onSelect} className={className}>{content}</Link>
  return <button type="button" onClick={onSelect} className={className}>{content}</button>
}
