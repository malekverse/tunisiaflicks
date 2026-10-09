import { cn } from '@/src/lib/utils'

/**
 * "On air now": an 8px red dot with a soft glow. Red is right here, it is a signal. The ring
 * pulses every 2s only for people who haven't asked for reduced motion; screen readers hear `label`.
 */
export default function LiveDot({ label, className }: { label: string, className?: string }) {
  return (
    <span className={cn('relative inline-flex h-2 w-2 shrink-0', className)}>
      <span aria-hidden className="absolute inset-0 rounded-full bg-red-500 opacity-0 motion-safe:animate-pulse-ring" />
      <span aria-hidden className="relative h-2 w-2 rounded-full bg-red-500 shadow-[0_0_10px_rgb(255_36_20/0.85)]" />
      <span className="sr-only">{label}</span>
    </span>
  )
}
