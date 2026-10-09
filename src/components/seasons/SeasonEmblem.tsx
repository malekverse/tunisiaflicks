import { CalendarHeart, Moon, MoonStar, PartyPopper } from 'lucide-react'
import TunisiaMark from '@/src/components/tunisian/TunisiaMark'
import { DOOR_DISK } from '@/src/components/hubs/HubDoor'
import type { SeasonalBannerModel } from '@/src/lib/seasons'
import { cn } from '@/src/lib/utils'

/**
 * The disc at the start of the seasonal banner, and on a moment page in season: a crescent
 * (Ramadan), a crescent and star (the Eids), the flag's crescent and star in #E70013 on white (the
 * national days; never mirrored), a calendar (Your year) or a popper (New Year). Lit in the accent
 * set as `--door` on an ancestor, or here with `accent`.
 */
export default function SeasonEmblem({ emblem, id, accent, size = 'door', className }: {
  emblem: SeasonalBannerModel['emblem']
  id?: string
  accent?: string
  size?: 'door' | 'header'
  className?: string
}) {
  const header = size === 'header'
  const glyph = header ? 'h-7 w-7 sm:h-8 sm:w-8' : 'h-5 w-5 sm:h-6 sm:w-6'
  const style = accent ? ({ '--door': accent } as React.CSSProperties) : undefined
  const disk = cn(DOOR_DISK, header && 'h-14 w-14 sm:h-16 sm:w-16', className)

  if (emblem === 'tunisia') {
    return (
      <span aria-hidden style={style} className={cn(disk, 'bg-white text-[#E70013] shadow-[0_0_28px_rgb(231_0_19/0.45)]')}>
        <TunisiaMark className={header ? 'h-12 w-12 sm:h-14 sm:w-14' : 'h-9 w-9 sm:h-11 sm:w-11'} />
      </span>
    )
  }
  const Icon = emblem === 'crescent' ? Moon : emblem === 'crescent-star' ? MoonStar : id === 'new-year' ? PartyPopper : CalendarHeart
  return (
    <span aria-hidden style={style} className={disk}>
      <Icon className={glyph} strokeWidth={1.9} />
    </span>
  )
}
