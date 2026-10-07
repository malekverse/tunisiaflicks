import { cn } from '@/src/lib/utils'

/**
 * The top of a browse page: a big display title (no eyebrow label), an optional one-line
 * subtitle, and actions on the end side (Movies / TV switch, filters...).
 */
export default function PageHeader({ title, subtitle, children, className, icon }: {
  title: React.ReactNode
  subtitle?: React.ReactNode
  children?: React.ReactNode
  className?: string
  icon?: React.ReactNode
}) {
  return (
    <header className={cn('page-x page-top flex flex-col gap-5 pb-6 sm:pb-8 md:flex-row md:items-end md:justify-between', className)}>
      <div className="min-w-0 animate-focus-in">
        {icon && <div className="mb-4">{icon}</div>}
        <h1 className="text-balance font-display text-[clamp(36px,5.4vw,72px)] font-extrabold leading-[0.95] text-white">{title}</h1>
        {subtitle && <p className="mt-3 max-w-[60ch] text-[15px] text-white/55">{subtitle}</p>}
      </div>
      {children && <div className="flex shrink-0 flex-wrap items-center gap-3">{children}</div>}
    </header>
  )
}
