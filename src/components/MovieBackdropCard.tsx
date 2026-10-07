"use client"
import React from 'react'
import Link from 'next/link';
import Image from 'next/image';
import { Skeleton } from './ui/skeleton';
import { MediaContextMenu, MediaOptionsMenu } from './MediaActions';

type BackdropCardProps = {
    backdropImg?: string | null
    title: string
    voteAverage?: any
    releaseDate?: string | null
    adult?: boolean
    link: string
    id?: string
    mediaType?: 'movie' | 'tv'
}

const HEIGHT = 'h-[200px] sm:h-[272px] lg:h-[310px]'

export function SkeletonLoader() {
    return <Skeleton className={`w-full ${HEIGHT} rounded-xl`} />
}

export default function MovieBackdropCard({ backdropImg, title, voteAverage, releaseDate, link, id, mediaType = 'movie' }: BackdropCardProps) {
    const itemId = id || (link ? link.split('/').pop() : '')
    const src = backdropImg ? `https://image.tmdb.org/t/p/w780${backdropImg}` : '/404.png'

    const card = (
        <Link href={link || '/'} title={title} className='block'>
            <div className={`w-full ${HEIGHT} rounded-xl overflow-hidden z-0 relative bg-zinc-800`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={src}
                    alt={title}
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                    className='absolute inset-0 w-full h-full object-cover'
                />
                <div className='absolute inset-0 z-10 bg-black opacity-10 transition-opacity ease-in-out duration-700 hover:opacity-0' />
                <div className='absolute z-20 bottom-3 left-5 right-3 sm:left-3'>
                    <p className='text-white text-lg sm:text-2xl font-semibold bbc-text-shadow'>{title}</p>
                    <p className='text-white text-sm sm:text-base font-semibold bbc-text-shadow'>{releaseDate}</p>
                    <label className='flex items-center'>
                        <Image src={"/imdb-logo.png"} alt='IMDb' width={100} height={100} className="inline-block w-[30px] sm:w-[40px] h-auto mr-2" />
                        <span className="inline-block bbc-text-shadow text-xs sm:text-base text-white">{voteAverage} Rating</span>
                    </label>
                </div>
            </div>
        </Link>
    )

    const meta = { id: itemId, title, posterPath: backdropImg || undefined, mediaType }
    return (
        <div className='relative'>
            <MediaContextMenu {...meta}>{card}</MediaContextMenu>
            <div className='sm:hidden absolute z-30 left-0 top-0 scale-50 origin-top-left'>
                <MediaOptionsMenu {...meta} />
            </div>
        </div>
    )
}
