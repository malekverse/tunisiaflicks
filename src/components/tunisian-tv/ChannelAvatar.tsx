import { cn } from '@/src/lib/utils'
import { channelInitials, type TvChannelView } from '@/src/lib/tunisian-tv/view'

const SIZES = {
  24: 'h-6 w-6 text-[10px]',
  32: 'h-8 w-8 text-[12px]',
  40: 'h-10 w-10 text-[14px]',
  56: 'h-14 w-14 text-[19px]',
  88: 'h-[88px] w-[88px] text-[30px]',
} as const

/**
 * A channel's picture: our own copy of its YouTube picture (never Google's address), or, until the
 * cron has one, a monogram lit in the channel's colour. Decorative: the name is always next to it.
 * Server-safe (no hooks).
 */
export default function ChannelAvatar({ channel, size = 40, className }: {
  channel: Pick<TvChannelView, 'name' | 'avatar' | 'color'>
  size?: keyof typeof SIZES
  className?: string
}) {
  const look = cn('relative inline-grid shrink-0 select-none place-items-center overflow-hidden rounded-full', SIZES[size], className)
  if (channel.avatar) {
    return (
      <span aria-hidden className={cn(look, 'bg-white/[0.06]')}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={channel.avatar} alt="" width={size} height={size} loading="lazy" decoding="async" draggable={false} className="h-full w-full object-cover" />
      </span>
    )
  }
  return (
    <span
      aria-hidden
      className={cn(look, 'font-display font-extrabold leading-none tracking-tight text-white')}
      style={{
        background: `radial-gradient(120% 120% at 30% 20%, rgb(${channel.color} / 0.75), rgb(${channel.color} / 0.28) 60%, rgb(${channel.color} / 0.16))`,
        boxShadow: `inset 0 0 0 1px rgb(${channel.color} / 0.5)`,
      }}
    >
      {channelInitials(channel.name)}
    </span>
  )
}
