"use client"
// A remote key, drawn the way it looks on most remotes: OK in a round button, Back as a return
// arrow, the arrows as a D-pad. Read out by screen readers by its name.
import { Undo2 } from 'lucide-react'
import { useT } from '@/src/components/I18nProvider'
import { cn } from '@/src/lib/utils'

export default function KeyGlyph({ k, className }: { k: 'ok' | 'back' | 'arrows'; className?: string }) {
  const t = useT()
  const label = t(k === 'ok' ? 'tvMode.key.ok' : k === 'back' ? 'tvMode.key.back' : 'tvMode.key.arrows')
  return (
    <kbd
      aria-label={label}
      className={cn(
        'inline-grid h-[1.9em] min-w-[1.9em] shrink-0 place-items-center rounded-full bg-white/[0.1] px-[0.45em] font-sans text-[0.8em] font-semibold not-italic leading-none text-white ring-1 ring-inset ring-white/25',
        className,
      )}
    >
      {k === 'ok' && <span aria-hidden>OK</span>}
      {k === 'back' && <Undo2 aria-hidden className="h-[1.05em] w-[1.05em]" strokeWidth={2.4} />}
      {k === 'arrows' && (
        <svg aria-hidden viewBox="0 0 20 20" className="h-[1.2em] w-[1.2em]" fill="currentColor">
          <path d="M10 2.2 12.6 5.4H7.4Z" />
          <path d="M10 17.8 7.4 14.6h5.2Z" />
          <path d="M2.2 10 5.4 7.4v5.2Z" />
          <path d="M17.8 10 14.6 12.6V7.4Z" />
          <circle cx="10" cy="10" r="1.7" opacity="0.55" />
        </svg>
      )}
    </kbd>
  )
}
