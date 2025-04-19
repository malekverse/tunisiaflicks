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
import { FaHeart, FaBookmark, FaShareAlt, FaFacebook, FaWhatsapp, FaTelegram } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import { LuCopy } from "react-icons/lu";
import { SlOptions } from "react-icons/sl";
import { useMediaQuery } from '@/src/hooks/use-media-query';
import { Button } from './ui/button';
import Image from 'next/image';
import { Skeleton } from './ui/skeleton';
import { addToFavorites, saveForLater } from '@/src/lib/user-content';
import { useToast } from '@/src/hooks/use-toast';

const MovieCard = ({ backdropImg, title, voteAverage, releaseDate, dropDown, link }: { dropDown?: any, backdropImg: string, title: string, voteAverage: any, releaseDate: any, link: string }) => {
    return (
        <Link href={link || '/'}>
            <div className='w-full h-[200px] sm:h-[272px] lg:h-[310px] rounded-xl z-0 relative'
                style={{
                    backgroundImage: `url(https://image.tmdb.org/t/p/w500${backdropImg})`,
                    backgroundSize: 'cover', backgroundRepeat: 'no-repeat', backgroundPosition: 'center'
                }} >
                {dropDown ?
                    <div className='absolute z-50 left-0 top-0 scale-50 sm:scale-100'>
                        {dropDown}
                    </div>
                    : null}
                <div className='absolute left-0 top-0 w-full h-[200px] sm:h-[272px] lg:h-[310px] z-10 bg-black opacity-10
           transition-opacity ease-in-out duration-700 hover:opacity-0' />
                <div className='absolute bottom-3 left-5 sm:left-3'>
                    <p className='text-white text-lg sm:text-2xl font-semibold bbc-text-shadow'>{title}</p>
                    <p className='text-white text-sm sm:text-base font-semibold bbc-text-shadow'>{releaseDate}</p>
                    <label>
                        <Image src={"/imdb-logo.png"} alt='IDMB' width={100} height={100} className="inline-block w-[30px] sm:w-[40px] mr-2" />
                        <p className="inline-block bbc-text-shadow text-xs sm:text-base">{voteAverage} Rating</p>
                    </label>
                </div>
            </div>
        </Link>
    )
}

const CustomContextMenu = ({ children, title, id, backdropPath, mediaType }) => {
    const { toast } = useToast();
    
    const handleAddToFavorites = async () => {
        try {
            await addToFavorites({
                id,
                title,
                poster_path: backdropPath,
                media_type: mediaType || 'movie',
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
                poster_path: backdropPath,
                media_type: mediaType || 'movie',
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

const CustomDropDownMenu = ({ title, id, backdropPath, mediaType }) => {
    const { toast } = useToast();
    
    const handleAddToFavorites = async () => {
        try {
            await addToFavorites({
                id,
                title,
                poster_path: backdropPath,
                media_type: mediaType || 'movie',
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
                poster_path: backdropPath,
                media_type: mediaType || 'movie',
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
                <Button className='bg-gray-900 outline-none rounded-2xl scale-110'><SlOptions className='text-white scale-150' /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
                <DropdownMenuLabel className='font-bold text-base'>{title}</DropdownMenuLabel>
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
    return(
        <Skeleton className='w-full h-[200px] sm:h-[272px] lg:h-[310px] rounded-xl' />
    )
}


export default function MovieBackdropCard({ backdropImg, title, voteAverage, releaseDate, adult, link, id }: { backdropImg: string, title: string, voteAverage: any, releaseDate: any, adult?: boolean, link: string, id?: string }) {
    const isDesktop = useMediaQuery("(min-width: 640px)")
    const { toast } = useToast();
    
    // Extract movie ID from link if not provided directly
    const movieId = id || (link ? link.split('/').pop() : '');

    if (isDesktop) {
        return (
            <CustomContextMenu 
                title={title}
                id={movieId}
                backdropPath={backdropImg}
                mediaType="movie"
            >
                <MovieCard backdropImg={backdropImg} title={title} voteAverage={voteAverage} releaseDate={releaseDate} link={link} />
            </CustomContextMenu>
        )
    }
    return (
        <div>
            <MovieCard 
                backdropImg={backdropImg} 
                dropDown={
                    <CustomDropDownMenu 
                        title={title} 
                        id={movieId} 
                        backdropPath={backdropImg} 
                        mediaType="movie" 
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
