"use client"
import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link';
import { IoMdStar } from "react-icons/io";
import { Skeleton } from './ui/skeleton';
import { MediaContextMenu, MediaOptionsMenu } from './MediaActions';
import { useHoverTrailer } from '@/src/hooks/use-hover-trailer';
import { useT } from './I18nProvider';

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
/**
 * Muted, looping trailer over a poster card. The 16:9 video is cropped to cover the 2:3 card
 * (2.667x the card width, centred). It is only revealed once YouTube reports it is actually
 * *playing* (iframe-API postMessage events), so YouTube's "before playback" UI (title bar, big
 * play button) never shows; if autoplay is blocked the card simply stays a poster. It never takes
 * clicks: the card link underneath stays clickable.
 */
const YOUTUBE_ORIGIN = 'https://www.youtube-nocookie.com'

function TrailerPreview({ youtubeKey }: { youtubeKey: string }) {
    const t = useT()
    const frame = useRef<HTMLIFrameElement>(null)
    const [playing, setPlaying] = useState(false)

    useEffect(() => {
        const onMessage = (event: MessageEvent) => {
            if (event.origin !== YOUTUBE_ORIGIN || event.source !== frame.current?.contentWindow) return
            let data: any
            try { data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data } catch { return }
            // 1 = playing (sent either as a state change or inside periodic info updates).
            if ((data?.event === 'onStateChange' && data.info === 1) || data?.info?.playerState === 1) setPlaying(true)
        }
        window.addEventListener('message', onMessage)
        return () => window.removeEventListener('message', onMessage)
    }, [])

    // Ask the player to start sending its events to this page.
    const subscribe = () => {
        frame.current?.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: youtubeKey }), YOUTUBE_ORIGIN)
    }

    const params = `autoplay=1&mute=1&controls=0&loop=1&playlist=${youtubeKey}&playsinline=1&modestbranding=1&rel=0&disablekb=1&iv_load_policy=3&enablejsapi=1`
    return (
        <iframe
            ref={frame}
            src={`${YOUTUBE_ORIGIN}/embed/${youtubeKey}?${params}`}
            title={t('card.trailerPreview')}
            allow="autoplay; encrypted-media"
            tabIndex={-1}
            aria-hidden="true"
            onLoad={subscribe}
            className={`absolute top-0 h-full max-w-none pointer-events-none z-[15] border-0 transition-opacity duration-500 ${playing ? 'opacity-100' : 'opacity-0'}`}
            style={{ width: '266.67%', left: '-83.33%' }}
        />
    )
}

export default function PosterCard({
    posterImg, title, voteAverage, releaseDate, link, externalImg, id,
    mediaType = 'movie', showTypeBadge = false, actions = true,
}: PosterCardProps) {
    const t = useT()
    const displayVoteAverage = voteAverage ? voteAverage.toString().substring(0, 3) : t('common.notAvailable')
    const itemId = id || (link ? link.split('/').pop() : '')
    const src = !posterImg ? FALLBACK_POSTER : externalImg ? posterImg : `https://image.tmdb.org/t/p/w342${posterImg}`
    const hasRating = voteAverage !== undefined && voteAverage !== null
    // Hover previews only for TMDB titles (not external items like the Tunisian catalogue).
    const { trailerKey, onMouseEnter, onMouseLeave } = useHoverTrailer(actions && !externalImg, mediaType, itemId)

    const isExternalLink = !!link && /^https?:\/\//.test(link)
    const linkProps = isExternalLink ? { target: '_blank', rel: 'noopener noreferrer' } : {}
    const Wrapper: any = !link ? 'div' : isExternalLink ? 'a' : Link
    const card = (
        <Wrapper {...(link ? { href: link } : {})} {...linkProps} title={title} className='block' onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
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
                {trailerKey && <TrailerPreview youtubeKey={trailerKey} />}
                <div className='absolute inset-0 z-10 bg-black opacity-10 transition-opacity ease-in-out duration-700 hover:opacity-0' />
                {hasRating &&
                    <label className='hidden sm:block absolute z-20 start-1 top-1 bg-gray-900 pb-1 px-2 rounded-xl'>
                        <IoMdStar className='inline-block me-1 text-yellow-400' />
                        <span className="inline-block bbc-text-shadow p-0 text-xs text-white">{displayVoteAverage}</span>
                    </label>
                }
                {showTypeBadge && mediaType &&
                    <div className='absolute z-20 end-1 top-1 bg-gray-900 pb-1 px-2 rounded-xl scale-75 sm:scale-100 opacity-75 text-white'>
                        <p>{t(mediaType === 'tv' ? 'card.badgeTv' : 'card.badgeMovie')}</p>
                    </div>
                }
                <div className='absolute z-20 bottom-5 start-3 end-2'>
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
            <div className='sm:hidden absolute z-30 start-0 top-0 scale-50 origin-top-left rtl:origin-top-right'>
                <MediaOptionsMenu {...meta} voteAverage={voteAverage} />
            </div>
        </div>
    )
}

export function SkeletonLoader() {
    return <Skeleton className='w-full aspect-[2/3] rounded-xl' />
}
