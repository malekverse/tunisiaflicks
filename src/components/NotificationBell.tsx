"use client"
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { FaBell, FaRegBell } from 'react-icons/fa'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/src/components/ui/dropdown-menu'
import { cn } from '@/src/lib/utils'
import { episodeCode, type NotificationItem } from '@/src/lib/models/Follow'

function timeAgo(iso: string) {
    const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
    if (minutes < 60) return `${Math.max(minutes, 1)}m ago`
    const hours = Math.round(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.round(hours / 24)
    return days < 30 ? `${days}d ago` : new Date(iso).toLocaleDateString()
}

const describe = (item: NotificationItem) =>
    item.kind === 'movie_released'
        ? 'Out now'
        : item.episode ? `New episode ${episodeCode(item.episode)}${item.episode.name ? ` · ${item.episode.name}` : ''}` : 'New episode'

/** Navbar bell: release / new-episode alerts, with an unread badge. Renders nothing for guests. */
export default function NotificationBell({ className }: { className?: string }) {
    const router = useRouter()
    const { data: session } = useSession()
    const userId = session?.user?.id
    const [items, setItems] = useState<NotificationItem[]>([])
    const [unread, setUnread] = useState(0)
    // Bumped whenever local state changes, so a response that started before it is dropped.
    const version = useRef(0)
    const markingRead = useRef<Promise<unknown> | null>(null)

    const refresh = useCallback(async () => {
        try {
            await markingRead.current
            const requested = version.current
            const response = await fetch('/api/notifications')
            if (!response.ok || requested !== version.current) return
            const data = await response.json()
            if (requested !== version.current) return
            setItems(data.items || [])
            setUnread(data.unread || 0)
        } catch (error) {
            console.error('Error fetching notifications:', error)
        }
    }, [])

    // Alerts are produced once a day, so loading on sign-in and when the tab regains focus is plenty.
    useEffect(() => {
        if (!userId) return
        refresh()
        const onFocus = () => refresh()
        window.addEventListener('focus', onFocus)
        return () => window.removeEventListener('focus', onFocus)
    }, [userId, refresh])

    const onOpenChange = (open: boolean) => {
        if (!open || unread === 0) return
        version.current++
        setUnread(0)
        markingRead.current = fetch('/api/notifications', { method: 'PATCH' })
            .catch((error) => console.error('Error marking notifications read:', error))
            .finally(() => { markingRead.current = null })
    }

    if (!userId) return null

    const label = unread > 0 ? `Notifications (${unread} unread)` : 'Notifications'
    return (
        <DropdownMenu onOpenChange={onOpenChange}>
            <DropdownMenuTrigger
                aria-label={label}
                title={label}
                className={cn("relative p-2 rounded-full text-gray-300 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500", className)}
            >
                {unread > 0 ? <FaBell className="text-xl" /> : <FaRegBell className="text-xl" />}
                {unread > 0 && (
                    <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-[18px] text-center">
                        {unread > 9 ? '9+' : unread}
                    </span>
                )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 max-w-[calc(100vw-1rem)]">
                <DropdownMenuLabel>Alerts</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {items.length === 0 ? (
                    <p className="px-2 py-4 text-sm text-gray-400 text-center">
                        No alerts yet. Tap Notify me on an upcoming movie or Follow a TV show.
                    </p>
                ) : (
                    <div className="max-h-96 overflow-y-auto">
                        {items.map((item) => (
                            <DropdownMenuItem
                                key={item.id}
                                onSelect={() => router.push(`/${item.media_type}/${item.tmdbId}`)}
                                className="flex gap-3 items-start cursor-pointer"
                            >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={item.poster_path ? `https://image.tmdb.org/t/p/w92${item.poster_path}` : '/404.png'}
                                    alt=""
                                    loading="lazy"
                                    className="w-10 aspect-[2/3] object-cover rounded shrink-0"
                                />
                                <div className="min-w-0 flex-1">
                                    <p className="font-semibold leading-tight line-clamp-2">{item.title}</p>
                                    <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{describe(item)}</p>
                                    <p className="text-[11px] text-gray-500 mt-0.5">{timeAgo(item.created_at)}</p>
                                </div>
                                {!item.read && <span className="mt-1 w-2 h-2 rounded-full bg-red-500 shrink-0" aria-label="Unread" />}
                            </DropdownMenuItem>
                        ))}
                    </div>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => router.push('/profile#following')} className="justify-center text-sm cursor-pointer">
                    Manage alerts
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
