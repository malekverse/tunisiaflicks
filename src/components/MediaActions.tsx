"use client"
import React, { useCallback, useMemo } from 'react'
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuLabel,
    ContextMenuSeparator,
    ContextMenuSub,
    ContextMenuSubContent,
    ContextMenuSubTrigger,
    ContextMenuTrigger,
} from "@/src/components/ui/context-menu"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuPortal,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from "@/src/components/ui/dropdown-menu"
import { IoMdStar } from "react-icons/io";
import { FaHeart, FaBookmark, FaShareAlt, FaFacebook, FaWhatsapp, FaTelegram } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import { LuCopy } from "react-icons/lu";
import { SlOptions } from "react-icons/sl";
import { Button } from './ui/button';
import { toast } from '@/src/hooks/use-toast';
import { addToFavorites, saveForLater } from '@/src/lib/user-content';

export type MediaMeta = {
    id?: string
    title: string
    posterPath?: string
    mediaType: 'movie' | 'tv'
}

const isUnauthorized = (error: unknown) => error instanceof Error && error.message === 'Unauthorized'

/** Add-to-favorites / bookmark / share handlers shared by every media card menu. */
function useMediaActions({ id, title, posterPath, mediaType }: MediaMeta) {
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
                ? { variant: "destructive", title: "Login Required", description: "Please login first" }
                : { variant: "destructive", title: "Error", description: failure })
        }
    }, [id, title, posterPath, mediaType])

    return useMemo(() => {
        const url = () => `${window.location.origin}/${mediaType}/${id}`
        const open = (shareUrl: string) => window.open(shareUrl, '_blank', 'noopener,noreferrer')
        return {
            favorite: () => save(addToFavorites,
                { title: "Added to favorites", description: `${title} has been added to your favorites` },
                "Failed to add to favorites"),
            bookmark: () => save(saveForLater,
                { title: "Saved for later", description: `${title} has been saved for later` },
                "Failed to save for later"),
            facebook: () => open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url())}`),
            x: () => open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(url())}&text=${encodeURIComponent(title)}`),
            telegram: () => open(`https://t.me/share/url?url=${encodeURIComponent(url())}&text=${encodeURIComponent(title)}`),
            whatsapp: () => open(`https://wa.me/?text=${encodeURIComponent(`${title} ${url()}`)}`),
            copy: async () => {
                try {
                    await navigator.clipboard.writeText(url())
                    toast({ title: "Link copied", description: `${title} link copied to clipboard` })
                } catch {
                    toast({ variant: "destructive", title: "Error", description: "Couldn't copy the link" })
                }
            },
        }
    }, [save, id, title, mediaType])
}

/** Right-click (desktop) / long-press (touch) menu wrapped around a card. */
export function MediaContextMenu({ children, ...meta }: MediaMeta & { children: React.ReactNode }) {
    const actions = useMediaActions(meta)
    return (
        <ContextMenu>
            <ContextMenuTrigger asChild>
                {children}
            </ContextMenuTrigger>
            <ContextMenuContent>
                <ContextMenuLabel className='font-bold text-base'>{meta.title}</ContextMenuLabel>
                <ContextMenuSeparator />
                <ContextMenuItem onSelect={actions.favorite}><FaHeart className='mr-2' />Add To Favorites</ContextMenuItem>
                <ContextMenuItem onSelect={actions.bookmark}><FaBookmark className='mr-2' />Add To BookMarks</ContextMenuItem>
                <ContextMenuSub>
                    <ContextMenuSubTrigger><FaShareAlt className='mr-2' />Share</ContextMenuSubTrigger>
                    <ContextMenuSubContent>
                        <ContextMenuItem onSelect={actions.facebook}><FaFacebook className='mr-2' />Facebook</ContextMenuItem>
                        <ContextMenuItem onSelect={actions.x}><FaXTwitter className='mr-2' />X</ContextMenuItem>
                        <ContextMenuItem onSelect={actions.telegram}><FaTelegram className='mr-2' />Telegram</ContextMenuItem>
                        <ContextMenuItem onSelect={actions.whatsapp}><FaWhatsapp className='mr-2' />WhatsApp</ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem onSelect={actions.copy}><LuCopy className='mr-2' />Copy Link</ContextMenuItem>
                    </ContextMenuSubContent>
                </ContextMenuSub>
            </ContextMenuContent>
        </ContextMenu>
    )
}

/** The "..." button shown on small screens, where there is no right-click. */
export function MediaOptionsMenu({ voteAverage, ...meta }: MediaMeta & { voteAverage?: any }) {
    const actions = useMediaActions(meta)
    const displayVoteAverage = voteAverage ? voteAverage.toString().substring(0, 3) : "N/A"
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button aria-label={`Options for ${meta.title}`} className='bg-gray-900 outline-none rounded-2xl scale-110'>
                    <SlOptions className='text-white scale-150' />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
                <DropdownMenuLabel className='font-bold text-base'>{meta.title}</DropdownMenuLabel>
                {voteAverage !== undefined && (
                    <DropdownMenuLabel className='-mt-3 -ml-1'>
                        <span className='rounded-xl scale-75 sm:scale-100'>
                            <IoMdStar className='inline-block mr-1 text-yellow-400' />
                            <span className="inline-block bbc-text-shadow p-0 text-xs">{displayVoteAverage}</span>
                        </span>
                    </DropdownMenuLabel>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                    <DropdownMenuItem onSelect={actions.favorite}><FaHeart className='mr-2' />Add To Favorites</DropdownMenuItem>
                    <DropdownMenuItem onSelect={actions.bookmark}><FaBookmark className='mr-2' />Add To BookMarks</DropdownMenuItem>
                    <DropdownMenuSub>
                        <DropdownMenuSubTrigger><FaShareAlt className='mr-2' />Share</DropdownMenuSubTrigger>
                        <DropdownMenuPortal>
                            <DropdownMenuSubContent>
                                <DropdownMenuItem onSelect={actions.facebook}><FaFacebook className='mr-2' />Facebook</DropdownMenuItem>
                                <DropdownMenuItem onSelect={actions.x}><FaXTwitter className='mr-2' />X</DropdownMenuItem>
                                <DropdownMenuItem onSelect={actions.telegram}><FaTelegram className='mr-2' />Telegram</DropdownMenuItem>
                                <DropdownMenuItem onSelect={actions.whatsapp}><FaWhatsapp className='mr-2' />WhatsApp</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onSelect={actions.copy}><LuCopy className='mr-2' />Copy Link</DropdownMenuItem>
                            </DropdownMenuSubContent>
                        </DropdownMenuPortal>
                    </DropdownMenuSub>
                </DropdownMenuGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
