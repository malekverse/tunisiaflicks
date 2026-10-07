import { cn } from '@/src/lib/utils'
import type { Profile } from '@/src/lib/models/Profile'

const SIZES = {
  sm: 'h-7 w-7 rounded-md text-sm',
  md: 'h-9 w-9 rounded-lg text-base',
  lg: 'h-24 w-24 sm:h-32 sm:w-32 rounded-xl text-5xl sm:text-6xl',
}

/** A profile's tile: its colour and initial (or the account photo for the owner's profile). */
export default function ProfileAvatar({ profile, image, size = 'md', className }: {
  profile: Pick<Profile, 'name' | 'color'>
  image?: string | null
  size?: keyof typeof SIZES
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={cn('relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden font-bold text-white', SIZES[size], className)}
      style={{ backgroundColor: profile.color }}
    >
      {image
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={image} alt="" className="h-full w-full object-cover" />
        : profile.name.charAt(0).toUpperCase()}
    </span>
  )
}

/** `label` is the translated "Kids" (this component is shared by server and client code). */
export function KidsBadge({ label = 'Kids', className }: { label?: string, className?: string }) {
  return (
    <span className={cn('rounded-md bg-gradient-to-r from-amber-400 to-pink-500 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white', className)}>
      {label}
    </span>
  )
}
