import { cn } from '@/src/lib/utils'
import type { Profile } from '@/src/lib/models/Profile'

const SIZES = {
  sm: 'h-7 w-7 rounded-md text-sm',
  md: 'h-9 w-9 rounded-lg text-base',
  // "Who's watching?": big, soft-cornered tiles.
  lg: 'h-[104px] w-[104px] rounded-[26px] text-[44px] sm:h-[148px] sm:w-[148px] sm:rounded-[34px] sm:text-[64px]',
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
      className={cn('relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden font-display font-bold text-white', SIZES[size], className)}
      style={{ backgroundColor: profile.color }}
    >
      {/* A little light from above, like the rest of the room's surfaces. */}
      <span className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/20 via-transparent to-black/20" />
      {image
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={image} alt="" className="relative h-full w-full object-cover" />
        : <span className="relative leading-none drop-shadow-[0_2px_8px_rgb(0_0_0/0.25)]">{profile.name.charAt(0).toUpperCase()}</span>}
    </span>
  )
}

/** `label` is the translated "Kids" (this component is shared by server and client code). */
export function KidsBadge({ label = 'Kids', className }: { label?: string, className?: string }) {
  return (
    <span className={cn('rounded-full bg-gradient-to-r from-amber-400 to-pink-500 px-2 py-0.5 text-[11px] font-bold leading-4 text-white shadow-[0_2px_10px_-2px_rgb(236_72_153/0.5)]', className)}>
      {label}
    </span>
  )
}
