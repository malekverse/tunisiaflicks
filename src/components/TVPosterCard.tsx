"use client"
import React from 'react'
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
import Link from 'next/link';
import { IoMdStar } from "react-icons/io";
import { FaHeart, FaBookmark, FaShareAlt, FaFacebook, FaWhatsapp, FaTelegram } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import { LuCopy } from "react-icons/lu";
import { SlOptions } from "react-icons/sl";
import { useMediaQuery } from '@/src/hooks/use-media-query';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';
import { addToFavorites, saveForLater } from '@/src/lib/user-content';
import { useToast } from '@/src/hooks/use-toast';

export const TVShowCard = ({ posterImg, title, voteAverage, releaseDate, dropDown, link, externalImg }: { dropDown?: any, posterImg: string, title: string, voteAverage?: any, releaseDate?: any, link?: string, externalImg?: boolean }) => {
    const displayVoteAverage = voteAverage ? voteAverage.toString().substring(0, 3) : "N/A"; // Fallback value for voteAverage

    return (
        <Link href={link || ""}>
            <div className='w-full h-[216px] sm:h-[250px] rounded-xl p-0 z-0 relative'
                style={{
                    backgroundImage: (!externalImg ? `url(https://image.tmdb.org/t/p/w500${posterImg})` : `url(${posterImg})`),
                    backgroundSize: 'cover', backgroundRepeat: 'no-repeat', backgroundPosition: 'center'
                }} >
                <div className='absolute left-0 top-0 w-full h-[216px] sm:h-[250px] z-10 bg-black opacity-10 transition-opacity ease-in-out duration-700 hover:opacity-0' />
                {dropDown
                    ? <div className='absolute z-50 left-0 top-0 scale-50 sm:scale-100'>
                        {dropDown}
                    </div>
                    : voteAverage !== undefined && voteAverage !== null
                        ? <label className='absolute left-1 top-1 bg-gray-900 pb-1 px-2 rounded-xl scale-75 sm:scale-100'>
                            <IoMdStar className='inline-block mr-1 text-yellow-400' />
                            <p className="inline-block bbc-text-shadow p-0 text-xs">{displayVoteAverage}</p>
                        </label>
                        : null
                }
                 <div className='absolute bottom-5 left-3'>
                    <p className='text-white text-sm sm:text-base font-semibold bbc-text-shadow '>{title}</p>
                    {releaseDate ? <p className='text-white text-xs sm:text-xs font-semibold bbc-text-shadow'>{releaseDate.substring(0, 4)}</p> : null }
                </div>
            </div>
        </Link>
    )
}


const CustomContextMenu = ({ children, title, id, posterPath, mediaType }) => {
    const { toast } = useToast();
    
    const handleAddToFavorites = async () => {
        try {
            await addToFavorites({
                id,
                title,
                poster_path: posterPath,
                media_type: mediaType || 'tv',
                added_at: new Date()
            });
            toast({
                title: "Added to favorites",
                description: `${title} has been added to your favorites`
            });
        } catch (error) {
            console.error('Failed to add to favorites:', error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to add to favorites"
            });
        }
    };

    const handleSaveForLater = async () => {
        try {
            await saveForLater({
                id,
                title,
                poster_path: posterPath,
                media_type: mediaType || 'tv',
                added_at: new Date()
            });
            toast({
                title: "Saved for later",
                description: `${title} has been saved for later`
            });
        } catch (error) {
            console.error('Failed to save for later:', error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to save for later"
            });
        }
    };
    
    return (
        <ContextMenu>
            <ContextMenuTrigger>
                {children}
            </ContextMenuTrigger>
            <ContextMenuContent>
                <ContextMenuLabel className='font-bold text-base'>{title}</ContextMenuLabel>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={handleAddToFavorites}><FaHeart className='mr-2' />Add To Favorites</ContextMenuItem>
                <ContextMenuItem onClick={handleSaveForLater}><FaBookmark className='mr-2' />Add To BookMarks</ContextMenuItem>
                <ContextMenuSub>
                    <ContextMenuSubTrigger><FaShareAlt className='mr-2' />Share</ContextMenuSubTrigger>
                    <ContextMenuSubContent>
                        <ContextMenuItem><FaFacebook className='mr-2' />Facebook</ContextMenuItem>
                        <ContextMenuItem><FaXTwitter className='mr-2' />X</ContextMenuItem>
                        <ContextMenuItem><FaTelegram className='mr-2' />Telegram</ContextMenuItem>
                        <ContextMenuItem><FaWhatsapp className='mr-2' />WhatsApp</ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem><LuCopy className='mr-2' />Copy Link</ContextMenuItem>
                    </ContextMenuSubContent>
                </ContextMenuSub>
            </ContextMenuContent>
        </ContextMenu>
    )
}

const CustomDropDownMenu = ({ title, voteAverage, id, posterPath, mediaType }) => {
    const displayVoteAverage = voteAverage ? voteAverage.toString().substring(0, 3) : "N/A"; // Provide a fallback value
    const { toast } = useToast();
    
    const handleAddToFavorites = async () => {
        try {
            await addToFavorites({
                id,
                title,
                poster_path: posterPath,
                media_type: mediaType || 'tv',
                added_at: new Date()
            });
            toast({
                title: "Added to favorites",
                description: `${title} has been added to your favorites`
            });
        } catch (error) {
            console.error('Failed to add to favorites:', error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to add to favorites"
            });
        }
    };

    const handleSaveForLater = async () => {
        try {
            await saveForLater({
                id,
                title,
                poster_path: posterPath,
                media_type: mediaType || 'tv',
                added_at: new Date()
            });
            toast({
                title: "Saved for later",
                description: `${title} has been saved for later`
            });
        } catch (error) {
            console.error('Failed to save for later:', error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to save for later"
            });
        }
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button className='bg-gray-900 outline-none rounded-2xl scale-110'>
                    <SlOptions className='text-white scale-150' />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
                <DropdownMenuLabel className='font-bold text-base'>{title}</DropdownMenuLabel>
                <DropdownMenuLabel className='-mt-3 -ml-1'>
                    <label className='rounded-xl scale-75 sm:scale-100'>
                        <IoMdStar className='inline-block mr-1 text-yellow-400' />
                        <p className="inline-block bbc-text-shadow p-0 text-xs">{displayVoteAverage}</p>
                    </label>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                    <DropdownMenuItem onSelect={handleAddToFavorites}>
                        <FaHeart className='mr-2' />Add To Favorites
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={handleSaveForLater}>
                        <FaBookmark className='mr-2' />Add To BookMarks
                    </DropdownMenuItem>
                    <DropdownMenuSub>
                        <DropdownMenuSubTrigger><FaShareAlt className='mr-2' />Share</DropdownMenuSubTrigger>
                        <DropdownMenuPortal>
                            <DropdownMenuSubContent>
                                <DropdownMenuItem><FaFacebook className='mr-2' />Facebook</DropdownMenuItem>
                                <DropdownMenuItem><FaXTwitter className='mr-2' />X</DropdownMenuItem>
                                <DropdownMenuItem><FaTelegram className='mr-2' />Telegram</DropdownMenuItem>
                                <DropdownMenuItem><FaWhatsapp className='mr-2' />WhatsApp</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem><LuCopy className='mr-2' />Copy Link</DropdownMenuItem>
                            </DropdownMenuSubContent>
                        </DropdownMenuPortal>
                    </DropdownMenuSub>
                </DropdownMenuGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}


export function SkeletonLoader() {
    return (
        <Skeleton className='w-full h-[216px] sm:h-[250px] rounded-xl' />
    )
}

export default function TVPosterCard({ posterImg, title, voteAverage, releaseDate, adult, link, externalImg, id }: { dropDown?: any, posterImg: string, title: string, voteAverage?: any, releaseDate?: any, adult?: boolean, link?: string, externalImg?: boolean, id?: string }) {
    const isDesktop = useMediaQuery("(min-width: 640px)")
    const { toast } = useToast();
    
    // Extract TV show ID from link if not provided directly
    const tvId = id || (link ? link.split('/').pop() : '');
    
    if (isDesktop) {
        return (
            <CustomContextMenu 
                title={title}
                id={tvId}
                posterPath={posterImg}
                mediaType="tv"
            >
                <TVShowCard posterImg={posterImg} title={title} voteAverage={voteAverage} releaseDate={releaseDate} link={link} externalImg={externalImg} />
            </CustomContextMenu>
        )
    }
    return (
        <div>
            <TVShowCard 
                posterImg={posterImg} 
                dropDown={
                    <CustomDropDownMenu 
                        title={title} 
                        voteAverage={voteAverage} 
                        id={tvId} 
                        posterPath={posterImg} 
                        mediaType="tv"
                    />
                } 
                title={title} 
                voteAverage={voteAverage} 
                releaseDate={releaseDate} 
                link={link} 
            />
        </div>
    )
}