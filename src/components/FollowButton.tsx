"use client"
import React, { useRef } from 'react'
import { m } from 'framer-motion'
import { Bell, BellRing } from 'lucide-react'
import { useFollow } from '@/src/hooks/use-follow'
import { useT } from '@/src/components/I18nProvider'
import { haptic, spring } from '@/src/lib/motion'
import { cn } from '@/src/lib/utils'
import type { FollowMediaType } from '@/src/lib/models/Follow'

type FollowButtonProps = {
    mediaType: FollowMediaType
    id: string
    title: string
    /** `hero`: labelled pill on the detail page. `card`: small round bell over a poster card. */
    variant?: 'hero' | 'card'
    className?: string
}

/**
 * The bell, popping in when it changes. Only a change the user made animates: follows loading in
 * the background just swap it.
 */
function BellIcon({ on, animate, className }: { on: boolean, animate: boolean, className: string }) {
    const Icon = on ? BellRing : Bell
    return (
        <m.span
            key={on ? 'on' : 'off'}
            aria-hidden
            initial={animate ? { scale: 0.55, rotate: on ? -28 : 0 } : false}
            animate={{ scale: 1, rotate: 0 }}
            transition={spring.pop}
            className="grid place-items-center"
        >
            <Icon className={cn(className, on && 'fill-current')} strokeWidth={2} />
        </m.span>
    )
}

/** "Notify me" (upcoming movie) / "Follow" (TV show) toggle for release and new-episode alerts. */
export default function FollowButton({ mediaType, id, title, variant = 'hero', className }: FollowButtonProps) {
    const t = useT()
    const { following, busy, toggle } = useFollow(mediaType, id)
    const touched = useRef(false)
    const isMovie = mediaType === 'movie'
    const label = following
        ? t(isMovie ? 'alerts.stopMovieAria' : 'alerts.unfollowAria', { title })
        : t(isMovie ? 'alerts.notifyMeAria' : 'alerts.followAria', { title })

    const onClick = (event: React.MouseEvent) => {
        if (variant === 'card') {
            // The bell sits on a link: don't open the title.
            event.preventDefault()
            event.stopPropagation()
        }
        if (busy) return
        touched.current = true
        haptic(10)
        toggle(title)
    }

    if (variant === 'card') {
        return (
            <button
                type="button"
                aria-label={label}
                aria-pressed={following}
                aria-busy={busy}
                title={label}
                onClick={onClick}
                className={cn('group/bell -m-1.5 grid h-11 w-11 select-none place-items-center rounded-full outline-none [-webkit-tap-highlight-color:transparent]', className)}
            >
                <span
                    className={cn(
                        'grid h-8 w-8 place-items-center rounded-full shadow-[0_6px_18px_-6px_rgb(0_0_0/0.9)] transition-[transform,background-color,color] duration-150 ease-out group-active/bell:scale-90 group-focus-visible/bell:ring-2 group-focus-visible/bell:ring-red-500 group-focus-visible/bell:ring-offset-2 group-focus-visible/bell:ring-offset-black',
                        following ? 'bg-red-600 text-white' : 'glass text-white group-hover/bell:bg-white/25',
                    )}
                >
                    <BellIcon on={following} animate={touched.current} className="h-4 w-4" />
                </span>
            </button>
        )
    }

    return (
        <button
            type="button"
            aria-pressed={following}
            aria-busy={busy}
            title={label}
            onClick={onClick}
            className={cn(
                'pressable inline-flex h-12 select-none items-center gap-2 rounded-full border px-5 text-[14.5px] font-medium outline-none transition-[background-color,border-color,color] duration-200 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-black',
                following
                    ? 'border-white bg-white text-black'
                    : 'border-white/25 bg-white/[0.06] text-white backdrop-blur-md hover:border-white/60 hover:bg-white/[0.12]',
                className
            )}
        >
            <BellIcon on={following} animate={touched.current} className="h-[18px] w-[18px]" />
            {isMovie ? t(following ? 'alerts.notifying' : 'alerts.notifyMe') : t(following ? 'alerts.following' : 'alerts.follow')}
        </button>
    )
}
