import { Check } from 'lucide-react'
import { cn } from '@/src/lib/utils'

/** A password requirement that lights up once it's met (e.g. "At least 8 characters"). */
export default function PasswordRule({ met, label }: { met: boolean, label: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 transition-colors duration-200', met && 'text-white/75')}>
      <span
        aria-hidden
        className={cn(
          'grid h-4 w-4 place-items-center rounded-full transition-[background-color,color,transform] duration-200 ease-out',
          met ? 'scale-100 bg-white text-black' : 'scale-90 bg-white/10 text-transparent',
        )}
      >
        <Check className="h-3 w-3" strokeWidth={3} />
      </span>
      {label}
    </span>
  )
}
