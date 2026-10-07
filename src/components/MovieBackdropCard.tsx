"use client"
import React from 'react'
import Link from 'next/link';
import Image from 'next/image';
import { Skeleton } from './ui/skeleton';
import { MediaContextMenu, MediaOptionsMenu } from './MediaActions';
import { useT } from './I18nProvider';
import TmdbImage from './TmdbImage';

type BackdropCardProps = {
    backdropImg?: string | null
    title: string
    voteAverage?: any
    releaseDate?: string | null
    adult?: boolean
    link: string
    id?: string
    mediaType?: 'movie' | 'tv'
    /** Above the fold: fetch eagerly with high priority. */
    priority?: boolean
}

const HEIGHT = 'h-[200px] sm:h-[272px] lg:h-[310px]'

export function SkeletonLoader() {
    return <Skeleton className={`w-full ${HEIGHT} rounded-xl`} />
}

export default function MovieBackdropCard({ backdropImg, title, voteAverage, releaseDate, link, id, mediaType = 'movie', priority = false }: BackdropCardProps) {
    const t = useT()
    const itemId = id || (link ? link.split('/').pop() : '')

    const card = (
        <Link href={link || '/'} title={title} className='block'>
            <div className={`w-full ${HEIGHT} rounded-xl overflow-hidden z-0 relative bg-zinc-800`}>
                <TmdbImage
                    kind='backdrop'
                    path={backdropImg}
                    alt={title}
                    fill
                    sizes='(min-width: 1024px) 500px, (min-width: 640px) 400px, 300px'
                    priority={priority}
                    draggable={false}
                    className='object-cover'
                />
                <div className='absolute inset-0 z-10 bg-black opacity-10 transition-opacity ease-in-out duration-700 hover:opacity-0' />
                <div className='absolute z-20 bottom-3 start-5 end-3 sm:start-3'>
                    <p className='text-white text-lg sm:text-2xl font-semibold bbc-text-shadow'><bdi>{title}</bdi></p>
                    <p className='text-white text-sm sm:text-base font-semibold bbc-text-shadow'>{releaseDate}</p>
                    <label className='flex items-center'>
                        <Image src={"/imdb-logo.png"} alt='IMDb' width={100} height={100} unoptimized className="inline-block w-[30px] sm:w-[40px] h-auto me-2" />
                        <span className="inline-block bbc-text-shadow text-xs sm:text-base text-white">{t('card.rating', { rating: voteAverage })}</span>
                    </label>
                </div>
            </div>
        </Link>
    )

    const meta = { id: itemId, title, posterPath: backdropImg || undefined, mediaType }
    return (
        <div className='relative'>
            <MediaContextMenu {...meta}>{card}</MediaContextMenu>
            <div className='sm:hidden absolute z-30 start-0 top-0 scale-50 origin-top-left rtl:origin-top-right'>
                <MediaOptionsMenu {...meta} />
            </div>
        </div>
    )
}
