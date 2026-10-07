"use client"
import React from 'react'
import PosterCard, { SkeletonLoader as PosterSkeleton } from '@/src/components/PosterCard'
import MovieBackdropCard, { SkeletonLoader as BackdropSkeleton } from '@/src/components/MovieBackdropCard'
import { Row, ROW_WIDTH, SectionHeader } from '@/src/components/rows/Row'
import { cardProps, toRoute } from '@/src/lib/card-props'

type Kind = 'movie' | 'tv'

const itemKind = (kind: Kind | 'mixed', item: any): Kind => (kind === 'mixed' ? (item.media_type === 'tv' ? 'tv' : 'movie') : kind)

/** Row of backdrop tiles (16:9). */
export function HeroSlider({ title, href, items, kind = 'movie', loading }: { title: string, href?: string, items?: any[], kind?: Kind, loading?: boolean }) {
    const list = (items ?? []).filter((item) => item?.backdrop_path)
    if (!loading && list.length === 0) return null

    return (
        <section aria-label={title} className="w-full">
            <SectionHeader title={title} href={href} />
            <Row itemClassName={ROW_WIDTH.landscape}>
                {loading
                    ? Array.from({ length: 6 }).map((_, index) => <BackdropSkeleton key={index} />)
                    : list.map((item) => (
                        <MovieBackdropCard
                            key={item.id}
                            backdropImg={item.backdrop_path}
                            voteAverage={item.vote_average}
                            title={item.title || item.name}
                            releaseDate={item.release_date || item.first_air_date}
                            mediaType={kind}
                            link={toRoute(kind, item.id)}
                            posterImg={item.poster_path}
                            genreIds={item.genre_ids}
                            overview={item.overview}
                        />
                    ))}
            </Row>
        </section>
    )
}

/** Row of poster cards. `kind="mixed"` routes each item by its own `media_type` (person credits, recommendations). */
export function PosterSlider({ title, href, items, kind = 'movie', loading, subtitle }: { title: string, href?: string, items?: any[], kind?: Kind | 'mixed', loading?: boolean, subtitle?: React.ReactNode }) {
    const list = (items ?? []).filter(Boolean)
    if (!loading && list.length === 0) return null

    return (
        <section aria-label={title} className="w-full">
            <SectionHeader title={title} href={href} subtitle={subtitle} />
            <Row itemClassName={ROW_WIDTH.poster}>
                {loading
                    ? Array.from({ length: 10 }).map((_, index) => <PosterSkeleton key={index} />)
                    : list.map((item) => (
                        <PosterCard key={`${itemKind(kind, item)}-${item.id}`} {...cardProps(item, itemKind(kind, item))} showTypeBadge={kind === 'mixed'} />
                    ))}
            </Row>
        </section>
    )
}
