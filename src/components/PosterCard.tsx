"use client"
import React from 'react'
import Link from 'next/link'
import { Star } from 'lucide-react'
import { cn } from '@/src/lib/utils'
import { Skeleton } from './ui/skeleton'
import { MediaContextMenu } from './MediaActions'
import { useT } from './I18nProvider'
import TmdbImage from './TmdbImage'
import FollowButton from './FollowButton'
import { usePeekTrigger } from '@/src/hooks/use-peek-trigger'
import { useMediaQuery } from '@/src/hooks/use-media-query'

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
    /** Right-click menu, hover preview and long-press sheet. Off for non-TMDB items. */
    actions?: boolean
    /** Show a "Notify me" bell (upcoming movies). */
    notify?: boolean
    /** Extra data for the hover preview / quick-view sheet. */
    backdropImg?: string | null
    genreIds?: number[]
    overview?: string
    /** Hide the title and year under the poster (the poster says it already). */
    bare?: boolean
    /** Above the fold: load first. */
    priority?: boolean
    /** Something to lay over the poster (badges, progress...). */
    overlay?: React.ReactNode
    className?: string
}

const FALLBACK_POSTER = '/404.png'
// Cards are ~130-220px wide (rows and grids).
const POSTER_SIZES = '(min-width: 1536px) 220px, (min-width: 640px) 180px, 140px'

/**
 * The poster card used across rows and grids. It fills its parent's width with a 2:3 poster, and
 * the title and year sit underneath. On a mouse, resting on it opens the preview card; on a touch
 * screen, a long press opens the quick-view sheet. The whole card is one link to the title.
 */
export default function PosterCard({
    posterImg, title, voteAverage, releaseDate, link, externalImg, id,
    mediaType = 'movie', showTypeBadge = false, actions = true, notify = false,
    backdropImg, genreIds, overview, bare = false, priority = false, overlay, className,
}: PosterCardProps) {
    const t = useT()
    const itemId = id || (link ? link.split('/').pop()?.split('?')[0] : '') || ''
    const rating = typeof voteAverage === 'number' ? voteAverage : parseFloat(voteAverage)
    const year = releaseDate ? releaseDate.substring(0, 4) : ''
    const peekable = actions && !externalImg && /^\d+$/.test(itemId)
    const coarse = useMediaQuery('(hover: none)')
    const peek = usePeekTrigger(peekable ? {
        id: itemId, kind: mediaType, title, poster: posterImg, backdrop: backdropImg,
        rating: Number.isFinite(rating) ? rating : undefined, date: releaseDate, genreIds, overview,
    } : null)

    const isExternalLink = !!link && /^https?:\/\//.test(link)
    const linkProps = isExternalLink ? { target: '_blank', rel: 'noopener noreferrer' } : {}
    const Wrapper: any = !link ? 'div' : isExternalLink ? 'a' : Link

    const card = (
        <Wrapper
            {...(link ? { href: link } : {})}
            {...linkProps}
            {...(peekable ? peek : {})}
            className={cn('group/card block select-none outline-none [-webkit-touch-callout:none]', className)}
        >
            <div className="relative aspect-[2/3] w-full overflow-hidden rounded-poster bg-white/[0.05] ring-1 ring-inset ring-white/[0.07] transition-[transform,box-shadow] duration-300 ease-out group-hover/card:-translate-y-1 group-hover/card:shadow-[0_18px_40px_-14px_rgb(0_0_0/0.9)] group-focus-visible/card:ring-2 group-focus-visible/card:ring-red-500 group-active/card:scale-[0.98]">
                {externalImg ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={posterImg || FALLBACK_POSTER}
                        alt={title}
                        loading="lazy"
                        decoding="async"
                        draggable={false}
                        className="absolute inset-0 h-full w-full object-cover"
                    />
                ) : (
                    <TmdbImage
                        kind="poster"
                        path={posterImg}
                        fallback={FALLBACK_POSTER}
                        alt={title}
                        fill
                        sizes={POSTER_SIZES}
                        priority={priority}
                        draggable={false}
                        className="object-cover transition-[transform,filter] duration-500 ease-out group-hover/card:scale-[1.04] group-hover/card:brightness-110"
                    />
                )}
                {showTypeBadge && (
                    <span className="glass absolute start-2 top-2 rounded-full px-2 py-0.5 text-[10.5px] font-medium text-white/90">
                        {t(mediaType === 'tv' ? 'common.tvShow' : 'common.movie')}
                    </span>
                )}
                {overlay}
            </div>
            {!bare && (
                <div className="mt-2.5 px-0.5">
                    <p className="truncate text-[13.5px] font-medium text-white/90 transition-colors group-hover/card:text-white"><bdi>{title}</bdi></p>
                    <p className="mt-0.5 flex items-center gap-2 text-[12px] text-white/45">
                        {year && <span>{year}</span>}
                        {Number.isFinite(rating) && rating > 0 && (
                            <span className="inline-flex items-center gap-1">
                                <Star aria-hidden className="h-3 w-3 fill-star text-star" />
                                {rating.toFixed(1)}
                            </span>
                        )}
                    </p>
                </div>
            )}
        </Wrapper>
    )

    if (!actions) return card

    const meta = { id: itemId, title, posterPath: posterImg || undefined, mediaType }
    return (
        <div className="relative">
            {/* Right-click on desktop; touch screens get the long-press sheet instead. */}
            <MediaContextMenu {...meta} disabled={coarse}>{card}</MediaContextMenu>
            {notify && itemId && (
                <FollowButton variant="card" mediaType={mediaType} id={itemId} title={title} className="absolute end-2 top-2 z-10" />
            )}
        </div>
    )
}

export function SkeletonLoader({ bare = false }: { bare?: boolean }) {
    return (
        <div>
            <Skeleton className="aspect-[2/3] w-full rounded-poster" />
            {!bare && (
                <div className="mt-2.5 space-y-1.5 px-0.5">
                    <Skeleton className="h-3.5 w-3/4 rounded-full" />
                    <Skeleton className="h-3 w-1/3 rounded-full" />
                </div>
            )}
        </div>
    )
}
