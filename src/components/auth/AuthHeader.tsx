/** Title and one line under it, at the top of an auth panel (server or client). */
export default function AuthHeader({ title, subtitle, icon, className }: {
  title: React.ReactNode
  subtitle?: React.ReactNode
  icon?: React.ReactNode
  className?: string
}) {
  return (
    <header className={className ?? 'mb-7'}>
      {icon}
      <h1 className="text-balance font-display text-[32px] font-extrabold leading-[1.02] text-white sm:text-[36px]">{title}</h1>
      {subtitle && <p className="mt-2.5 text-pretty text-[15px] leading-relaxed text-white/60">{subtitle}</p>}
    </header>
  )
}
