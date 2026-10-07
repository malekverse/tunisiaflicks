"use client"
import React, { useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import useEmblaCarousel from 'embla-carousel-react'
import Autoplay from 'embla-carousel-autoplay'
import { FaHeart, FaPlay } from "react-icons/fa6"
import { FaBookmark, FaShareAlt } from "react-icons/fa"
import { HiOutlineArrowsExpand } from "react-icons/hi"
import { Button } from '@/src/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/src/components/ui/dialog'
import { toast } from '@/src/hooks/use-toast'
import { cn } from '@/src/lib/utils'
import { useI18n } from '@/src/components/I18nProvider'

const TMDB = 'https://image.tmdb.org/t/p'

function Backdrops({ backdrops, fallback, title }: { backdrops: { file_path: string }[], fallback?: string | null, title: string }) {
    const { t, dir } = useI18n()
    const slides = useMemo(() => {
        const paths = backdrops.slice(0, 8).map((item) => item.file_path)
        return paths.length > 0 ? paths : fallback ? [fallback] : []
    }, [backdrops, fallback])
    const plugins = useMemo(() => [Autoplay({ delay: 4000 })], [])
    const [emblaRef] = useEmblaCarousel({ loop: slides.length > 1, direction: dir }, plugins)

    return (
        <div className="overflow-hidden h-full" ref={emblaRef}>
            <div className="flex h-full touch-pan-y">
                {slides.map((path, index) => (
                    <div className="min-w-0 flex-[0_0_100%] h-full" key={path}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={`${TMDB}/w1280${path}`}
                            alt={index === 0 ? t('hero.backdropAlt', { title }) : ''}
                            loading={index === 0 ? 'eager' : 'lazy'}
                            className="w-full h-full object-cover object-top"
                        />
                    </div>
                ))}
            </div>
        </div>
    )
}

function RoundButton({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick: () => void }) {
    return (
        <Button
            variant="outline"
            aria-label={label}
            aria-pressed={active}
            title={label}
            onClick={onClick}
            className={cn(
                "w-10 h-10 p-0 rounded-full border-white transition-all duration-75 ease-in-out",
                active ? "bg-red-500 border-red-500 text-white hover:bg-red-500 hover:text-white" : "bg-transparent text-white hover:text-red-500 hover:border-red-500 hover:bg-transparent"
            )}
        >
            {icon}
        </Button>
    )
}

export type MediaHeroProps = {
    kind: 'movie' | 'tv'
    data: any
    isFavorite: boolean
    isSaved: boolean
    onToggleFavorite: () => void
    onToggleSaved: () => void
    onWatch: () => void
}

/**
 * Cinematic header of a movie / TV detail page. A normal-flow section: the backdrop sits behind
 * the content and the content decides the height, so it behaves on every screen size.
 */
export default function MediaHero({ kind, data, isFavorite, isSaved, onToggleFavorite, onToggleSaved, onWatch }: MediaHeroProps) {
    const { t, locale } = useI18n()
    const [trailerOpen, setTrailerOpen] = useState(false)

    const title: string = data.title || data.name || ''
    const logos: any[] = data.images?.logos ?? []
    const logo = logos.find((item) => item.iso_639_1 === 'en') ?? logos[0]
    const [showAllCast, setShowAllCast] = useState(false)
    const allCast: any[] = data.credits?.cast ?? []
    const cast = allCast.slice(0, showAllCast ? 24 : 7)
    const genres = (data.genres ?? []).map((item: any) => item.name).join(locale === 'ar' ? '، ' : ', ')
    const startDate: string = (kind === 'tv' ? data.first_air_date : data.release_date) || ''
    const endYear = kind === 'tv' && data.last_air_date ? data.last_air_date.substring(0, 4) : ''
    const years = kind === 'tv'
        ? `${startDate.substring(0, 4)} – ${data.status === 'Ended' || data.status === 'Canceled' ? endYear : t('hero.present')}`
        : startDate.substring(0, 4)

    const trailer = useMemo(() => {
        const videos: any[] = (data.videos?.results ?? []).filter((video: any) => video.site === 'YouTube')
        return videos.find((video) => video.type === 'Trailer' && video.official)
            ?? videos.find((video) => video.type === 'Trailer')
            ?? videos.find((video) => video.type === 'Teaser')
    }, [data.videos])

    const share = async () => {
        const url = window.location.href
        try {
            if (navigator.share) {
                await navigator.share({ title, url })
            } else {
                await navigator.clipboard.writeText(url)
                toast({ title: t('common.linkCopied'), description: t('common.linkCopiedDesc', { title }) })
            }
        } catch (error: any) {
            if (error?.name !== 'AbortError') {
                toast({ title: t('common.error'), description: t('hero.shareFailed'), variant: "destructive" })
            }
        }
    }

    return (
        // The hero is always dark (cinematic), whatever the site theme is.
        <section className="relative w-full overflow-hidden bg-[#0d0c0f] text-white">
            <div className="absolute inset-x-0 top-0 h-[60%] md:h-full">
                <Backdrops backdrops={data.images?.backdrops ?? []} fallback={data.backdrop_path} title={title} />
                <div className="absolute inset-x-0 bottom-0 h-1/2 md:h-2/6 bg-gradient-to-t from-[#0d0c0f] to-transparent" />
                <div className="hidden md:block absolute inset-y-0 start-0 w-1/2 bg-gradient-to-r rtl:bg-gradient-to-l from-[#0d0c0f] to-transparent" />
            </div>

            <div className="relative z-10 flex flex-col min-h-[560px] md:min-h-[640px] px-5 md:px-10 pt-8 pb-10">
                {logo && (
                    <Image
                        src={`${TMDB}/w500${logo.file_path}`}
                        className="w-32 md:w-48 h-auto max-h-24 object-contain object-left rtl:object-right"
                        width={500}
                        height={200}
                        alt={t('hero.logoAlt', { title })}
                        priority
                    />
                )}

                <div className="mt-auto pt-40 md:pt-64 flex flex-col md:flex-row items-center md:items-end gap-6">
                    {data.poster_path && (
                        <Image
                            src={`${TMDB}/w500${data.poster_path}`}
                            className="w-36 md:w-48 h-auto rounded-xl shadow-2xl shadow-black shrink-0"
                            width={500}
                            height={750}
                            alt={t('hero.posterAlt', { title })}
                        />
                    )}

                    <div className="flex flex-col items-center md:items-start min-w-0 max-w-3xl">
                        <h1 className="sr-only">{title}</h1>
                        <div className="flex flex-col md:flex-row items-center flex-wrap gap-x-3 gap-y-2">
                            {(data.origin_country ?? []).length > 0 && (
                                <div className="flex gap-1">
                                    {data.origin_country.map((country: string) => (
                                        <Image key={country} src={`https://flagsapi.com/${country}/flat/32.png`} width={32} height={32} alt={country} />
                                    ))}
                                </div>
                            )}
                            <div className="flex gap-1 items-center">
                                <FaHeart className="text-red-500" />
                                <span className="text-red-500 font-bold">{Math.round((data.vote_average || 0) * 10)}%</span> {t('hero.likes')}
                            </div>
                            {years && <><span className="hidden md:block">•</span><span>{years}</span></>}
                            {data.adult && <span className="bg-red-500 px-3 rounded-xl">+18</span>}
                            {genres && <><span className="hidden md:block">•</span><span>{genres}</span></>}
                        </div>

                        <p className="mt-3 text-gray-300 text-center md:text-start">{data.overview}</p>

                        {cast.length > 0 && (
                            <div className="mt-4 flex flex-col items-center md:items-start">
                                <p>{t('hero.cast')}</p>
                                <div className="flex justify-center md:justify-start gap-2 mt-2 select-none flex-wrap">
                                    {cast.map((person) => (
                                        <Link
                                            key={person.credit_id ?? person.id}
                                            href={`/person/${person.id}`}
                                            title={person.character ? t('hero.castAs', { name: person.name, character: person.character }) : person.name}
                                            className="rounded-full transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                                        >
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={person.profile_path ? `${TMDB}/w185${person.profile_path}` : '/actor.png'}
                                                alt={person.name}
                                                loading="lazy"
                                                className="w-12 h-12 md:w-14 md:h-14 object-cover rounded-full hover:ring-2 hover:ring-red-500"
                                                style={{ objectPosition: '0 30%' }}
                                            />
                                        </Link>
                                    ))}
                                    {allCast.length > 7 && (
                                        <button
                                            type="button"
                                            onClick={() => setShowAllCast((value) => !value)}
                                            aria-expanded={showAllCast}
                                            aria-label={showAllCast ? t('hero.showLessCast') : t('hero.showFullCast')}
                                            title={showAllCast ? t('hero.showLess') : t('hero.showFullCast')}
                                            className="w-12 h-12 md:w-14 md:h-14 bg-gray-500 bg-opacity-40 border-opacity-70 border-2 border-gray-200 rounded-full flex items-center justify-center hover:border-red-500 hover:text-red-500 transition-colors"
                                        >
                                            {showAllCast
                                                ? <span className="text-xs font-semibold">{t('hero.less')}</span>
                                                : <HiOutlineArrowsExpand className="w-6 h-6 md:w-8 md:h-8" />}
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="flex gap-4 mt-6 flex-wrap justify-center md:justify-start">
                            <div className="flex items-center gap-3">
                                <Button asChild onClick={onWatch} className="bg-red-500 text-white hover:bg-red-400">
                                    <a href="#streamSection"><FaPlay className="me-1" /> {t('hero.watchNow')}</a>
                                </Button>
                                <Button
                                    variant="outline"
                                    disabled={!trailer}
                                    title={trailer ? t('hero.watchTrailerTitle') : t('hero.noTrailer')}
                                    onClick={() => setTrailerOpen(true)}
                                    className="border-white bg-transparent text-white hover:bg-white/10 hover:text-white"
                                >
                                    {t('hero.watchTrailer')}
                                </Button>
                            </div>
                            <div className="flex items-center gap-3">
                                <RoundButton icon={<FaHeart className="w-5 h-5" />} label={isFavorite ? t('hero.removeFavorites') : t('hero.addFavorites')} active={isFavorite} onClick={onToggleFavorite} />
                                <RoundButton icon={<FaBookmark className="w-5 h-5" />} label={isSaved ? t('hero.removeSaved') : t('hero.saveForLater')} active={isSaved} onClick={onToggleSaved} />
                                <RoundButton icon={<FaShareAlt className="w-5 h-5" />} label={t('hero.share')} onClick={share} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {trailer && (
                <Dialog open={trailerOpen} onOpenChange={setTrailerOpen}>
                    <DialogContent className="max-w-4xl p-0 border-0 bg-black overflow-hidden">
                        <DialogTitle className="sr-only">{t('hero.trailerTitle', { title })}</DialogTitle>
                        <div className="aspect-video w-full">
                            {trailerOpen && (
                                <iframe
                                    src={`https://www.youtube-nocookie.com/embed/${trailer.key}?autoplay=1&rel=0`}
                                    title={t('hero.trailerTitle', { title })}
                                    className="w-full h-full"
                                    allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                                    allowFullScreen
                                />
                            )}
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </section>
    )
}
