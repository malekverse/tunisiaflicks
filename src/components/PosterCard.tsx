"use client"
import React from 'react'
import Link from 'next/link';
import { IoMdStar } from "react-icons/io";
import { Skeleton } from './ui/skeleton';
import { MediaContextMenu, MediaOptionsMenu } from './MediaActions';

export type PosterCardProps = {
    posterImg?: string | null
    title: string
    voteAverage?: any
    releaseDate?: string | null
    adult?: boolean
    link?: string
    /** `posterImg` is already a full URL (not a TMDB path). */
    externalImg?: boolean
    id?: string
    mediaType?: 'movie' | 'tv'
    /** Show the media type as a small badge (used by mixed search results). */
    showTypeBadge?: boolean
    /** Right-click / "..." menu (favorites, bookmarks, share). Off for non-TMDB items. */
    actions?: boolean
}

const FALLBACK_POSTER = '/404.png'

/**
 * The poster card used across carousels and grids. It fills its parent's width and keeps a 2:3
 * ratio, so the parent (a carousel slide, or a fixed-width grid cell) decides the size.
 */
export default function PosterCard({
    posterImg, title, voteAverage, releaseDate, link, externalImg, id,
    mediaType = 'movie', showTypeBadge = false, actions = true,
}: PosterCardProps) {
    const displayVoteAverage = voteAverage ? voteAverage.toString().substring(0, 3) : "N/A"
    const itemId = id || (link ? link.split('/').pop() : '')
    const src = !posterImg ? FALLBACK_POSTER : externalImg ? posterImg : `https://image.tmdb.org/t/p/w342${posterImg}`
    const hasRating = voteAverage !== undefined && voteAverage !== null

    const isExternalLink = !!link && /^https?:\/\//.test(link)
    const linkProps = isExternalLink ? { target: '_blank', rel: 'noopener noreferrer' } : {}
    const Wrapper: any = !link ? 'div' : isExternalLink ? 'a' : Link
    const card = (
        <Wrapper {...(link ? { href: link } : {})} {...linkProps} title={title} className='block'>
            <div className='w-full aspect-[2/3] rounded-xl overflow-hidden z-0 relative bg-zinc-800'>
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
                {hasRating &&
                    <label className='hidden sm:block absolute z-20 left-1 top-1 bg-gray-900 pb-1 px-2 rounded-xl'>
                        <IoMdStar className='inline-block mr-1 text-yellow-400' />
                        <span className="inline-block bbc-text-shadow p-0 text-xs text-white">{displayVoteAverage}</span>
                    </label>
                }
                {showTypeBadge && mediaType &&
                    <div className='absolute z-20 right-1 top-1 bg-gray-900 pb-1 px-2 rounded-xl scale-75 sm:scale-100 opacity-75 text-white'>
                        <p>{mediaType}</p>
                    </div>
                }
                <div className='absolute z-20 bottom-5 left-3 right-2'>
                    <p className='text-white text-sm sm:text-base font-semibold bbc-text-shadow leading-tight line-clamp-3'>{title}</p>
                    {releaseDate ? <p className='text-white text-xs font-semibold bbc-text-shadow'>{releaseDate.substring(0, 4)}</p> : null}
                </div>
            </div>
        </Wrapper>
    )

    if (!actions) return card

    const meta = { id: itemId, title, posterPath: posterImg || undefined, mediaType }
    return (
        <div className='relative'>
            <MediaContextMenu {...meta}>{card}</MediaContextMenu>
            {/* No right-click on touch screens: an explicit "..." button instead (outside the link). */}
            <div className='sm:hidden absolute z-30 left-0 top-0 scale-50 origin-top-left'>
                <MediaOptionsMenu {...meta} voteAverage={voteAverage} />
            </div>
        </div>
    )
}

export function SkeletonLoader() {
    return <Skeleton className='w-full aspect-[2/3] rounded-xl' />
}
