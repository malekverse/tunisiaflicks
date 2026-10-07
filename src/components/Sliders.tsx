"use client"
import React from 'react'
import Link from 'next/link'
import { FaLongArrowAltRight } from "react-icons/fa"
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/src/components/ui/carousel"
import PosterCard, { SkeletonLoader as PosterSkeleton } from '@/src/components/PosterCard'
import MovieBackdropCard, { SkeletonLoader as BackdropSkeleton } from '@/src/components/MovieBackdropCard'
import routes from '@/src/routes/client/routes'
import { useT } from '@/src/components/I18nProvider'

type Kind = 'movie' | 'tv'

const heroItemClass = `transition-transform ease-in-out duration-300 select-none basis-[300px] sm:basis-[400px] lg:basis-[500px]
    my-4 ps-0 ms-4 hover:scale-105 hover:z-10 shadow-black shadow-2xl`
const posterItemClass = `transition-transform ease-in-out duration-300 select-none basis-[145px] md:basis-[167px]
    my-4 p-0 ms-4 hover:scale-105 hover:z-10`

const toRoute = (kind: Kind, id: number | string) => (kind === 'tv' ? routes.tvShow(String(id)) : routes.movie(String(id)))
const itemKind = (kind: Kind | 'mixed', item: any): Kind => (kind === 'mixed' ? (item.media_type === 'tv' ? 'tv' : 'movie') : kind)

function SectionHeader({ title, href }: { title: string, href?: string }) {
    const t = useT()
    return (
        <div className='flex justify-between items-end w-full'>
            <h2 className='text-2xl sm:text-3xl font-semibold mb-3'>{title}</h2>
            {href &&
                <Link href={href} className='text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-white mb-3'>
                    <span className='text-sm font-light me-2'>{t('common.seeMore')}</span>
                    <FaLongArrowAltRight className='inline-block rtl:-scale-x-100' />
                </Link>
            }
        </div>
    )
}

function Arrows() {
    return (
        <div className='hidden sm:block'>
            <CarouselPrevious />
            <CarouselNext />
        </div>
    )
}

/** Big backdrop slider (trending). Autoplays. */
export function HeroSlider({ title, href, items, kind = 'movie', loading }: { title: string, href?: string, items?: any[], kind?: Kind, loading?: boolean }) {
    const list = (items ?? []).filter((item) => item?.backdrop_path)
    if (!loading && list.length === 0) return null

    return (
        <section aria-label={title} className='w-full'>
            <SectionHeader title={title} href={href} />
            <Carousel autoplay={loading ? undefined : 5000} className='w-full'>
                <CarouselContent>
                    {loading
                        ? Array.from({ length: 6 }).map((_, index) => (
                            <CarouselItem key={index} className={heroItemClass}><BackdropSkeleton /></CarouselItem>
                        ))
                        : list.map((item) => (
                            <CarouselItem key={item.id} className={heroItemClass}>
                                <MovieBackdropCard
                                    backdropImg={item.backdrop_path}
                                    voteAverage={item.vote_average?.toFixed?.(1) ?? item.vote_average}
                                    title={item.title || item.name}
                                    releaseDate={item.release_date || item.first_air_date}
                                    adult={item.adult}
                                    mediaType={kind}
                                    link={toRoute(kind, item.id)}
                                />
                            </CarouselItem>
                        ))}
                </CarouselContent>
                {!loading && <Arrows />}
            </Carousel>
        </section>
    )
}

/** Row of poster cards. */
/** Row of poster cards. `kind="mixed"` routes each item by its own `media_type` (person credits, recommendations). */
export function PosterSlider({ title, href, items, kind = 'movie', loading }: { title: string, href?: string, items?: any[], kind?: Kind | 'mixed', loading?: boolean }) {
    const list = items ?? []
    if (!loading && list.length === 0) return null

    return (
        <section aria-label={title} className='w-full'>
            <SectionHeader title={title} href={href} />
            <Carousel className='w-full'>
                <CarouselContent>
                    {loading
                        ? Array.from({ length: 10 }).map((_, index) => (
                            <CarouselItem key={index} className={posterItemClass}><PosterSkeleton /></CarouselItem>
                        ))
                        : list.map((item) => (
                            <CarouselItem key={item.id} className={posterItemClass}>
                                <PosterCard
                                    posterImg={item.poster_path}
                                    voteAverage={item.vote_average}
                                    title={item.title || item.name}
                                    releaseDate={item.release_date || item.first_air_date}
                                    adult={item.adult}
                                    mediaType={itemKind(kind, item)}
                                    showTypeBadge={kind === 'mixed'}
                                    link={toRoute(itemKind(kind, item), item.id)}
                                />
                            </CarouselItem>
                        ))}
                </CarouselContent>
                {!loading && <Arrows />}
            </Carousel>
        </section>
    )
}
