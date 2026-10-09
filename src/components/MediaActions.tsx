"use client"
import React, { useCallback, useMemo, useRef } from 'react'
import { useSession } from 'next-auth/react'
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
import { Bookmark, Ellipsis, Heart, ListPlus, Share2, Star } from "lucide-react";
import { Button } from './ui/button';
import { toast } from '@/src/hooks/use-toast';
import { useProfiles } from '@/src/hooks/use-profiles';
import { addToFavorites, saveForLater } from '@/src/lib/user-content';
import { openShare } from '@/src/store/share-sheet';
import AddToListHost from '@/src/components/lists/AddToListHost';
import { openAddToList } from '@/src/components/lists/add-to-list-store';
import { useT } from './I18nProvider';

export type MediaMeta = {
    id?: string
    title: string
    posterPath?: string
    mediaType: 'movie' | 'tv'
}

const isUnauthorized = (error: unknown) => error instanceof Error && error.message === 'Unauthorized'

/** Add-to-favorites / bookmark / share / add-to-a-list handlers shared by every media card menu. */
function useMediaActions({ id, title, posterPath, mediaType }: MediaMeta) {
    const t = useT()
    const { status } = useSession()
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

    // Lists are for signed-in people (the menu item itself hides on Kids profiles).
    const lists = !!id && status === 'authenticated'

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
        addToList: lists
            ? () => openAddToList({ media_type: mediaType, id: String(id), title, poster_path: posterPath ?? null })
            : null,
    }), [save, id, title, posterPath, mediaType, t, lists])
}

/**
 * "Add to a list…" opens its sheet only once the menu has closed (and given focus back), so the
 * two never fight over focus or stack.
 */
function useAfterClose() {
    const pending = useRef<(() => void) | null>(null)
    const later = useCallback((run: () => void) => () => { pending.current = run }, [])
    const onCloseAutoFocus = useCallback((event: Event) => {
        const run = pending.current
        if (!run) return
        pending.current = null
        event.preventDefault()
        run()
    }, [])
    return { later, onCloseAutoFocus }
}

/** Whether the profile in use is a Kids one, as last known on this page (null until first known). */
let lastKnownKids: boolean | null = null

/** "Add to a list…": rendered only while a menu is open, and never on a Kids profile (nor before we know). */
function AddToListItem({ as: Item, onSelect }: { as: typeof ContextMenuItem | typeof DropdownMenuItem, onSelect: () => void }) {
    const t = useT()
    const { data, active } = useProfiles()
    if (data) lastKnownKids = !!active?.kids
    const kids = data ? !!active?.kids : lastKnownKids
    if (kids !== false) return null
    return <Item onSelect={onSelect}><ListPlus className='me-2.5 h-4 w-4 text-white/60' />{t('sharedLists.add.menu')}</Item>
}

/** Right-click (desktop) / long-press (touch) menu wrapped around a card. */
export function MediaContextMenu({ children, disabled, ...meta }: MediaMeta & { children: React.ReactNode, disabled?: boolean }) {
    const actions = useMediaActions(meta)
    const { later, onCloseAutoFocus } = useAfterClose()
    const t = useT()
    return (
        <>
            <ContextMenu>
                <ContextMenuTrigger asChild disabled={disabled}>
                    {children}
                </ContextMenuTrigger>
                <ContextMenuContent onCloseAutoFocus={onCloseAutoFocus}>
                    <ContextMenuLabel className='font-bold text-base'><bdi>{meta.title}</bdi></ContextMenuLabel>
                    <ContextMenuSeparator />
                    <ContextMenuItem onSelect={actions.favorite}><Heart className='me-2.5 h-4 w-4 text-white/60' />{t('card.addFavorites')}</ContextMenuItem>
                    <ContextMenuItem onSelect={actions.bookmark}><Bookmark className='me-2.5 h-4 w-4 text-white/60' />{t('card.addBookmarks')}</ContextMenuItem>
                    {actions.addToList && <AddToListItem as={ContextMenuItem} onSelect={later(actions.addToList)} />}
                    {actions.share && (
                        <ContextMenuItem onSelect={actions.share}><Share2 className='me-2.5 h-4 w-4 text-white/60' />{t('social.share.menuItem')}</ContextMenuItem>
                    )}
                </ContextMenuContent>
            </ContextMenu>
            {actions.addToList && <AddToListHost fallback />}
        </>
    )
}

/** The "..." button shown on small screens, where there is no right-click. */
export function MediaOptionsMenu({ voteAverage, ...meta }: MediaMeta & { voteAverage?: any }) {
    const actions = useMediaActions(meta)
    const { later, onCloseAutoFocus } = useAfterClose()
    const t = useT()
    const displayVoteAverage = voteAverage ? voteAverage.toString().substring(0, 3) : t('common.notAvailable')
    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button size="icon-sm" variant="secondary" aria-label={t('card.optionsFor', { title: meta.title })}>
                        <Ellipsis className='h-4 w-4' />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent onCloseAutoFocus={onCloseAutoFocus}>
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
                        {actions.addToList && <AddToListItem as={DropdownMenuItem} onSelect={later(actions.addToList)} />}
                        {actions.share && (
                            <DropdownMenuItem onSelect={actions.share}><Share2 className='me-2.5 h-4 w-4 text-white/60' />{t('social.share.menuItem')}</DropdownMenuItem>
                        )}
                    </DropdownMenuGroup>
                </DropdownMenuContent>
            </DropdownMenu>
            {actions.addToList && <AddToListHost fallback />}
        </>
    )
}
