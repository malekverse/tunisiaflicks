"use client"
import { UserRound } from 'lucide-react'
import { cn } from '@/src/lib/utils'
import ProfileAvatar from '@/src/components/profiles/ProfileAvatar'
import type { Profile } from '@/src/lib/models/Profile'

/** The signed-in viewer: their profile tile (or account photo), or a neutral person for guests. */
export default function AccountAvatar({ active, image, isOwner, name, className }: {
  active: Profile | null
  image: string | null
  isOwner: boolean
  name: string | null
  className?: string
}) {
  if (active) {
    return <ProfileAvatar profile={active} image={isOwner ? image : null} size="md" className={cn('rounded-full', className)} />
  }
  if (image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={image} alt="" className={cn('h-9 w-9 rounded-full object-cover', className)} />
  }
  return (
    <span aria-hidden className={cn('grid h-9 w-9 place-items-center rounded-full bg-white/10 text-sm font-semibold', className)}>
      {name ? name.charAt(0).toUpperCase() : <UserRound className="h-[18px] w-[18px]" />}
    </span>
  )
}
