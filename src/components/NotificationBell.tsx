"use client"
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Bell } from 'lucide-react'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/src/components/ui/dropdown-menu'
import { cn } from '@/src/lib/utils'
import TmdbImage from '@/src/components/TmdbImage'
import { useI18n } from '@/src/components/I18nProvider'
import type { Translate } from '@/src/lib/i18n'
import type { NotificationItem } from '@/src/lib/models/Follow'

function timeAgo(iso: string, locale: string | undefined) {
    const format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'short' })
    const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
    if (minutes < 60) return format.format(-Math.max(minutes, 1), 'minute')
    const hours = Math.round(minutes / 60)
    if (hours < 24) return format.format(-hours, 'hour')
    const days = Math.round(hours / 24)
    return days < 30 ? format.format(-days, 'day') : new Date(iso).toLocaleDateString(locale)
}

function describe(item: NotificationItem, t: Translate) {
    if (item.kind === 'movie_released') return t('alerts.outNow')
    if (!item.episode) return t('alerts.newEpisode')
    const code = t('common.seasonEpisode', { season: item.episode.season, episode: item.episode.episode })
    return `${t('alerts.newEpisodeCode', { episode: code })}${item.episode.name ? ` · ${item.episode.name}` : ''}`
}

/** Navbar bell: release / new-episode alerts, with an unread badge. Renders nothing for guests. */
export default function NotificationBell({ className }: { className?: string }) {
    const router = useRouter()
    const { t, dateLocale } = useI18n()
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

    const label = unread > 0 ? t('alerts.bellLabelUnread', { count: unread }) : t('alerts.bellLabel')
    return (
        <DropdownMenu onOpenChange={onOpenChange}>
            <DropdownMenuTrigger
                aria-label={label}
                title={label}
                className={cn("pressable relative grid h-10 w-10 place-items-center rounded-full text-white/75 outline-none transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:ring-2 focus-visible:ring-red-500 data-[state=open]:bg-white/[0.1] data-[state=open]:text-white", className)}
            >
                <Bell aria-hidden className="h-[21px] w-[21px]" strokeWidth={1.9} />
                {unread > 0 && (
                    <span className="absolute end-1 top-1 grid h-[17px] min-w-[17px] place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-black">
                        {unread > 9 ? '9+' : unread}
                    </span>
                )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={10} className="w-[340px] max-w-[calc(100vw-1.5rem)] p-0">
                <DropdownMenuLabel className="px-4 pb-2 pt-3.5 text-[15px] font-semibold">{t('alerts.menuTitle')}</DropdownMenuLabel>
                {items.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 px-6 pb-8 pt-4 text-center">
                        <span className="grid h-12 w-12 place-items-center rounded-full bg-white/[0.06]">
                            <Bell aria-hidden className="h-5 w-5 text-white/50" />
                        </span>
                        <p className="text-sm text-white/55">{t('alerts.empty')}</p>
                    </div>
                ) : (
                    <div className="max-h-[420px] overflow-y-auto overscroll-contain px-1.5 pb-1.5">
                        {items.map((item) => (
                            <DropdownMenuItem
                                key={item.id}
                                onSelect={() => router.push(`/${item.media_type}/${item.tmdbId}`)}
                                className="flex cursor-pointer items-start gap-3 rounded-xl p-2.5"
                            >
                                <span className="relative block aspect-[2/3] w-11 shrink-0 overflow-hidden rounded-md bg-white/5">
                                    <TmdbImage kind="poster" path={item.poster_path} alt="" fill sizes="44px" className="object-cover" />
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className="line-clamp-2 font-medium leading-snug">{item.title}</p>
                                    <p className="mt-0.5 line-clamp-2 text-xs text-white/60">{describe(item, t)}</p>
                                    <p className="mt-1 text-[11px] text-white/40">{timeAgo(item.created_at, dateLocale)}</p>
                                </div>
                                {!item.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-red-500 shadow-[0_0_8px_rgb(255_36_20)]" aria-label={t('alerts.unread')} />}
                            </DropdownMenuItem>
                        ))}
                    </div>
                )}
                <DropdownMenuSeparator className="my-0" />
                <DropdownMenuItem onSelect={() => router.push('/profile#following')} className="m-1.5 cursor-pointer justify-center rounded-xl text-sm text-white/70">
                    {t('alerts.manage')}
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
