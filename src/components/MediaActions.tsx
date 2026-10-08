"use client"
import React, { useCallback, useMemo } from 'react'
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuLabel,
    ContextMenuSeparator,
    ContextMenuTrigger,
} from "@/src/components/ui/context-menu"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/src/components/ui/dropdown-menu"
import { Bookmark, Ellipsis, Heart, Share2, Star } from "lucide-react";
import { Button } from './ui/button';
import { toast } from '@/src/hooks/use-toast';
import { addToFavorites, saveForLater } from '@/src/lib/user-content';
import { openShare } from '@/src/store/share-sheet';
import { useT } from './I18nProvider';

export type MediaMeta = {
    id?: string
    title: string
    posterPath?: string
    mediaType: 'movie' | 'tv'
}

const isUnauthorized = (error: unknown) => error instanceof Error && error.message === 'Unauthorized'

/** Add-to-favorites / bookmark / share handlers shared by every media card menu. */
function useMediaActions({ id, title, posterPath, mediaType }: MediaMeta) {
    const t = useT()
    const save = useCallback(async (
        action: typeof addToFavorites,
        success: { title: string, description: string },
        failure: string,
    ) => {
        try {
            await action({ id, title, poster_path: posterPath, media_type: mediaType, added_at: new Date() } as any)
            toast(success)
        } catch (error) {
            console.error(failure, error)
            toast(isUnauthorized(error)
                ? { variant: "destructive", title: t('common.loginRequired'), description: t('common.pleaseLogin') }
                : { variant: "destructive", title: t('common.error'), description: failure })
        }
    }, [id, title, posterPath, mediaType, t])

    return useMemo(() => ({
        favorite: () => save(addToFavorites,
            { title: t('toast.addedFavorites'), description: t('toast.addedFavoritesDesc', { title }) },
            t('toast.addFavoritesFailed')),
        bookmark: () => save(saveForLater,
            { title: t('toast.savedForLater'), description: t('toast.savedForLaterDesc', { title }) },
            t('toast.saveFailed')),
        // One sheet for every way of sharing: friends, a night, a list, WhatsApp and the rest, the link.
        share: id
            ? () => openShare({ kind: 'title', media: { media_type: mediaType, id: String(id), title, poster_path: posterPath ?? null } })
            : null,
    }), [save, id, title, posterPath, mediaType, t])
}

/** Right-click (desktop) / long-press (touch) menu wrapped around a card. */
export function MediaContextMenu({ children, disabled, ...meta }: MediaMeta & { children: React.ReactNode, disabled?: boolean }) {
    const actions = useMediaActions(meta)
    const t = useT()
    return (
        <ContextMenu>
            <ContextMenuTrigger asChild disabled={disabled}>
                {children}
            </ContextMenuTrigger>
            <ContextMenuContent>
                <ContextMenuLabel className='font-bold text-base'><bdi>{meta.title}</bdi></ContextMenuLabel>
                <ContextMenuSeparator />
                <ContextMenuItem onSelect={actions.favorite}><Heart className='me-2.5 h-4 w-4 text-white/60' />{t('card.addFavorites')}</ContextMenuItem>
                <ContextMenuItem onSelect={actions.bookmark}><Bookmark className='me-2.5 h-4 w-4 text-white/60' />{t('card.addBookmarks')}</ContextMenuItem>
                {actions.share && (
                    <ContextMenuItem onSelect={actions.share}><Share2 className='me-2.5 h-4 w-4 text-white/60' />{t('social.share.menuItem')}</ContextMenuItem>
                )}
            </ContextMenuContent>
        </ContextMenu>
    )
}

/** The "..." button shown on small screens, where there is no right-click. */
export function MediaOptionsMenu({ voteAverage, ...meta }: MediaMeta & { voteAverage?: any }) {
    const actions = useMediaActions(meta)
    const t = useT()
    const displayVoteAverage = voteAverage ? voteAverage.toString().substring(0, 3) : t('common.notAvailable')
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button size="icon-sm" variant="secondary" aria-label={t('card.optionsFor', { title: meta.title })}>
                    <Ellipsis className='h-4 w-4' />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
                <DropdownMenuLabel className='font-bold text-base'><bdi>{meta.title}</bdi></DropdownMenuLabel>
                {voteAverage !== undefined && (
                    <DropdownMenuLabel className='-mt-3 -ms-1'>
                        <span className='inline-flex items-center gap-1 text-xs text-white/70'>
                            <Star className='h-3 w-3 fill-star text-star' />
                            {displayVoteAverage}
                        </span>
                    </DropdownMenuLabel>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                    <DropdownMenuItem onSelect={actions.favorite}><Heart className='me-2.5 h-4 w-4 text-white/60' />{t('card.addFavorites')}</DropdownMenuItem>
                    <DropdownMenuItem onSelect={actions.bookmark}><Bookmark className='me-2.5 h-4 w-4 text-white/60' />{t('card.addBookmarks')}</DropdownMenuItem>
                    {actions.share && (
                        <DropdownMenuItem onSelect={actions.share}><Share2 className='me-2.5 h-4 w-4 text-white/60' />{t('social.share.menuItem')}</DropdownMenuItem>
                    )}
                </DropdownMenuGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
