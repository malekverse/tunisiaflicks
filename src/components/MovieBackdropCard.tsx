"use client"
import React from 'react'
import Link from 'next/link'
import { Star } from 'lucide-react'
import { Skeleton } from './ui/skeleton'
import { MediaContextMenu } from './MediaActions'
import TmdbImage from './TmdbImage'
import { usePeekTrigger } from '@/src/hooks/use-peek-trigger'
import { useMediaQuery } from '@/src/hooks/use-media-query'

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
    posterImg?: string | null
    genreIds?: number[]
    overview?: string
}

export function SkeletonLoader() {
    return <Skeleton className="aspect-video w-full rounded-tile" />
}

/** A 16:9 tile: the backdrop with the title over its lower edge. Hover / long press to peek. */
export default function MovieBackdropCard({ backdropImg, title, voteAverage, releaseDate, link, id, mediaType = 'movie', priority = false, posterImg, genreIds, overview }: BackdropCardProps) {
    const itemId = id || (link ? link.split('/').pop()?.split('?')[0] : '') || ''
    const rating = typeof voteAverage === 'number' ? voteAverage : parseFloat(voteAverage)
    const coarse = useMediaQuery('(hover: none)')
    const peek = usePeekTrigger(/^\d+$/.test(itemId) ? {
        id: itemId, kind: mediaType, title, poster: posterImg, backdrop: backdropImg,
        rating: Number.isFinite(rating) ? rating : undefined, date: releaseDate, genreIds, overview,
    } : null)

    const card = (
        <Link href={link || '/'} {...peek} className="group/card block select-none outline-none [-webkit-touch-callout:none]">
            <div className="relative aspect-video w-full overflow-hidden rounded-tile bg-white/[0.05] ring-1 ring-inset ring-white/[0.07] transition-[transform,box-shadow] duration-300 ease-out group-hover/card:-translate-y-1 group-hover/card:shadow-[0_18px_40px_-14px_rgb(0_0_0/0.9)] group-focus-visible/card:ring-2 group-focus-visible/card:ring-red-500 group-active/card:scale-[0.98]">
                <TmdbImage
                    kind="backdrop"
                    path={backdropImg}
                    alt=""
                    fill
                    sizes="(min-width: 1536px) 360px, (min-width: 640px) 320px, 74vw"
                    priority={priority}
                    draggable={false}
                    className="object-cover transition-[transform,filter] duration-500 ease-out group-hover/card:scale-[1.04] group-hover/card:brightness-110"
                />
                <div aria-hidden className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-3.5">
                    <p className="line-clamp-2 font-display text-[19px] font-bold leading-tight text-white drop-shadow-[0_2px_10px_rgb(0_0_0/0.7)]"><bdi>{title}</bdi></p>
                    <p className="mt-1 flex items-center gap-2 text-[12px] text-white/65">
                        {releaseDate && <span>{releaseDate.substring(0, 4)}</span>}
                        {Number.isFinite(rating) && rating > 0 && (
                            <span className="inline-flex items-center gap-1"><Star aria-hidden className="h-3 w-3 fill-star text-star" />{rating.toFixed(1)}</span>
                        )}
                    </p>
                </div>
            </div>
        </Link>
    )

    return (
        <MediaContextMenu id={itemId} title={title} posterPath={posterImg || backdropImg || undefined} mediaType={mediaType} disabled={coarse}>
            {card}
        </MediaContextMenu>
    )
}
