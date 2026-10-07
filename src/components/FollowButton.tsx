"use client"
import React from 'react'
import { FaBell, FaRegBell } from 'react-icons/fa'
import { Button } from '@/src/components/ui/button'
import { useFollow } from '@/src/hooks/use-follow'
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

/** "Notify me" (upcoming movie) / "Follow" (TV show) toggle for release and new-episode alerts. */
export default function FollowButton({ mediaType, id, title, variant = 'hero', className }: FollowButtonProps) {
    const { following, busy, toggle } = useFollow(mediaType, id)
    const isMovie = mediaType === 'movie'
    const label = following
        ? (isMovie ? `Stop release alerts for ${title}` : `Unfollow ${title}`)
        : (isMovie ? `Notify me when ${title} is out` : `Follow ${title} for new episodes`)
    const Icon = following ? FaBell : FaRegBell

    if (variant === 'card') {
        return (
            <button
                type="button"
                aria-label={label}
                aria-pressed={following}
                title={label}
                disabled={busy}
                onClick={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    toggle(title)
                }}
                className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center shadow-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500",
                    following ? "bg-red-500 text-white" : "bg-gray-900/80 text-white hover:text-red-500",
                    className
                )}
            >
                <Icon className="w-4 h-4" />
            </button>
        )
    }

    return (
        <Button
            variant="outline"
            aria-pressed={following}
            title={label}
            disabled={busy}
            onClick={() => toggle(title)}
            className={cn(
                "transition-all duration-75 ease-in-out",
                following
                    ? "bg-red-500 border-red-500 text-white hover:bg-red-500 hover:text-white"
                    : "border-white bg-transparent text-white hover:text-red-500 hover:border-red-500 hover:bg-transparent",
                className
            )}
        >
            <Icon className="mr-2" />
            {isMovie ? (following ? 'Notifying you' : 'Notify me') : (following ? 'Following' : 'Follow')}
        </Button>
    )
}
