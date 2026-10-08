import React from 'react'
import { cn } from '@/src/lib/utils'

/**
 * One settings panel: its anchor (`id`, linked from the section nav and from elsewhere in the
 * app, e.g. /profile#following), a title, a one-line description, then the content.
 * Server-safe (no hooks), so client components can render it too.
 */
export default function SettingsSection({ id, title, description, action, tone = 'default', children, className }: {
  id: string
  title: React.ReactNode
  description?: React.ReactNode
  /** Something small on the end side of the title (a link, a count). */
  action?: React.ReactNode
  /** `danger`: a faint red edge (delete account). */
  tone?: 'default' | 'danger'
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      data-settings-section
      className={cn(
        'scroll-mt-[calc(var(--topbar)+env(safe-area-inset-top,0px)+20px)] rounded-[22px] bg-white/[0.04] p-5 ring-1 sm:p-7',
        tone === 'danger' ? 'ring-red-500/20' : 'ring-white/[0.07]',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 id={`${id}-title`} className="font-display text-[21px] font-bold leading-tight text-white sm:text-[24px]">{title}</h2>
          {description && <p className="mt-1.5 max-w-[62ch] text-[14px] leading-relaxed text-white/55">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className="mt-6">{children}</div>
    </section>
  )
}

/** A row inside a panel, separated from the next by a hairline. */
export function SettingsGroup({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('divide-y divide-white/[0.07] rounded-2xl bg-white/[0.03] px-4 ring-1 ring-inset ring-white/[0.05] sm:px-5', className)} {...props}>{children}</div>
}
