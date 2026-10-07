"use client"
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Clapperboard, Heart, Pause, Play, Plus, Share2, Star, Volume2, VolumeX } from 'lucide-react'
import { Button } from '@/src/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/src/components/ui/dialog'
import FollowButton from '@/src/components/FollowButton'
import ReleaseCountdown from '@/src/components/detail/ReleaseCountdown'
import TmdbImage from '@/src/components/TmdbImage'
import YouTubeBackdrop from '@/src/components/media/YouTubeBackdrop'
import { upcomingRelease } from '@/src/lib/calendar'
import { pickLogo, pickTrailer } from '@/src/lib/media-assets'
import { toast } from '@/src/hooks/use-toast'
import { useCanAutoplay } from '@/src/hooks/use-autoplay'
import { useLibraryToggle } from '@/src/hooks/use-library-toggle'
import { useInLibrary } from '@/src/store/library'
import { cn } from '@/src/lib/utils'
import { useI18n } from '@/src/components/I18nProvider'
import { isArabicScript } from '@/src/lib/i18n'

const BACKDROP_MS = 7000
const TRAILER_DELAY_MS = 3000

export type MediaHeroProps = {
    kind: 'movie' | 'tv'
    data: any
    /** "Play", "Play S1:E1", "Resume S2:E5"... */
    playLabel: string
    onPlay: () => void
}

/** A round action with its label under it on phones, and a tooltip-only icon on desktop. */
function HeroAction({ label, active, onClick, children }: { label: string, active?: boolean, onClick: () => void, children: React.ReactNode }) {
    return (
        <button type="button" onClick={onClick} aria-pressed={active} aria-label={label} title={label} className="pressable group flex flex-col items-center gap-1.5 outline-none">
            <span className={cn(
                'grid h-12 w-12 place-items-center rounded-full border transition-colors duration-150 group-focus-visible:ring-2 group-focus-visible:ring-red-500',
                active ? 'border-white bg-white text-black' : 'border-white/25 bg-white/[0.06] text-white backdrop-blur-md hover:border-white/60 hover:bg-white/[0.12]',
            )}>
                {children}
            </span>
            <span className="text-[11.5px] text-white/65 md:hidden">{label}</span>
        </button>
    )
}

/**
 * The cinematic top of a movie / show page. Backdrops cross-fade behind the title logo; after a
 * few seconds the trailer takes over, muted (it pauses as soon as the hero leaves the screen, so
 * it never competes with the player below). Phones get the picture as a band on top with the
 * text under it.
 */
export default function MediaHero({ kind, data, playLabel, onPlay }: MediaHeroProps) {
    const { t, locale } = useI18n()
    const autoplay = useCanAutoplay()
    const toggle = useLibraryToggle()
    const ref = useRef<HTMLElement>(null)
    const [inView, setInView] = useState(true)
    const [slide, setSlide] = useState(0)
    const [trailerOn, setTrailerOn] = useState(false)
    const [playing, setPlaying] = useState(false)
    const [muted, setMuted] = useState(true)
    const [paused, setPaused] = useState(false)
    const [trailerOpen, setTrailerOpen] = useState(false)

    const id = String(data.id)
    const title: string = data.title || data.name || ''
    const logo = useMemo(() => pickLogo(data.images?.logos), [data.images])
    const trailer = useMemo(() => pickTrailer(data.videos?.results), [data.videos])
    const backdrops = useMemo(() => {
        const paths: string[] = (data.images?.backdrops ?? []).slice(0, 6).map((item: any) => item.file_path)
        return paths.length > 0 ? paths : data.backdrop_path ? [data.backdrop_path] : []
    }, [data.images, data.backdrop_path])

    const media = { id, media_type: kind }
    const saved = useInLibrary('saved', media)
    const favorite = useInLibrary('favorites', media)
    const libraryItem = { id, title, poster_path: data.poster_path, media_type: kind }

    const startDate: string = (kind === 'tv' ? data.first_air_date : data.release_date) || ''
    const ended = data.status === 'Ended' || data.status === 'Canceled'
    const years = kind === 'tv' && startDate
        ? `${startDate.substring(0, 4)}–${ended ? (data.last_air_date ?? '').substring(0, 4) : t('hero.present')}`
        : startDate.substring(0, 4)
    const length = kind === 'movie'
        ? data.runtime ? t('pick.runtime', { hours: Math.floor(data.runtime / 60), minutes: data.runtime % 60 }) : ''
        : data.number_of_seasons > 1 ? t('pick.seasons', { count: data.number_of_seasons }) : data.number_of_seasons === 1 ? t('pick.oneSeason') : ''
    const genres = (data.genres ?? []).slice(0, 3).map((genre: any) => genre.name)
    // Alerts only make sense for a movie that isn't out yet, or a show that's still running.
    const followable = kind === 'tv' ? !ended : !data.release_date || data.release_date > new Date().toISOString().slice(0, 10)
    const release = useMemo(() => upcomingRelease(kind, data), [kind, data])

    useEffect(() => {
        const node = ref.current
        if (!node) return
        const observer = new IntersectionObserver(([entry]) => setInView(entry.intersectionRatio > 0.3), { threshold: [0, 0.3, 1] })
        observer.observe(node)
        return () => observer.disconnect()
    }, [])

    // Backdrops cycle while there's no trailer playing.
    useEffect(() => {
        if (backdrops.length < 2 || playing || !inView) return
        const timer = setTimeout(() => setSlide((value) => (value + 1) % backdrops.length), BACKDROP_MS)
        return () => clearTimeout(timer)
    }, [slide, backdrops.length, playing, inView])

    useEffect(() => {
        if (!autoplay || !trailer || !inView || trailerOn) return
        const timer = setTimeout(() => setTrailerOn(true), TRAILER_DELAY_MS)
        return () => clearTimeout(timer)
    }, [autoplay, trailer, inView, trailerOn])

    const share = async () => {
        const url = window.location.href.split('#')[0]
        try {
            if (navigator.share) await navigator.share({ title, url })
            else {
                await navigator.clipboard.writeText(url)
                toast({ title: t('common.linkCopied'), description: t('common.linkCopiedDesc', { title }) })
            }
        } catch (error: any) {
            if (error?.name !== 'AbortError') toast({ title: t('common.error'), description: t('hero.shareFailed'), variant: 'destructive' })
        }
    }

    return (
        <section ref={ref} aria-label={title} className="relative isolate w-full">
            {/* The picture: a band on phones, the whole stage on desktop. */}
            <div className="relative aspect-[5/4] w-full overflow-hidden sm:aspect-video md:absolute md:inset-0 md:aspect-auto">
                {backdrops.map((path, index) => (
                    <div key={path} aria-hidden={index !== slide} className={cn('absolute inset-0 transition-opacity duration-1000 ease-out', index === slide ? 'opacity-100' : 'opacity-0')}>
                        {(index === slide || index === (slide + 1) % backdrops.length) && (
                            <div key={index === slide ? `on-${slide}` : 'next'} className={cn('absolute inset-0', index === slide && !playing && 'animate-ken-burns')}>
                                <TmdbImage
                                    kind="backdrop"
                                    path={path}
                                    fill
                                    sizes="100vw"
                                    alt={index === 0 ? t('hero.backdropAlt', { title }) : ''}
                                    preview={index === 0 ? 'w300' : undefined}
                                    shimmer={false}
                                    priority={index === 0}
                                    className="object-cover object-top"
                                />
                            </div>
                        )}
                    </div>
                ))}
                {trailerOn && trailer && (
                    <YouTubeBackdrop
                        videoKey={trailer}
                        muted={muted}
                        play={inView && !trailerOpen && !paused}
                        zoom={1.3}
                        onState={(state) => {
                            if (state === 'playing') setPlaying(true)
                            if (state === 'ended') { setPlaying(false); setTrailerOn(false) }
                        }}
                    />
                )}
                {/* Ambient mode: a wash of the poster's colour rising from the bottom (desktop; on phones the
                    picture has to melt into plain black under it). */}
                <div aria-hidden className="tf-ambient-glow absolute inset-0 hidden md:block" style={{ background: 'radial-gradient(ellipse 80% 50% at 20% 100%, rgb(var(--tf-ambient) / 0.28), transparent 70%)' }} />
                <div aria-hidden className="absolute inset-x-0 bottom-0 h-[70%] bg-gradient-to-t from-black via-black/60 to-transparent md:h-[60%]" />
                <div aria-hidden className="absolute inset-y-0 start-0 hidden w-[72%] bg-gradient-to-r from-black/90 via-black/45 to-transparent md:block rtl:bg-gradient-to-l" />
                <div aria-hidden className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/60 to-transparent" />
            </div>

            <div className="page-x relative -mt-28 pb-4 sm:-mt-36 md:mt-0 md:flex md:min-h-[min(92svh,980px)] md:flex-col md:justify-end md:pb-[clamp(48px,8vh,100px)] md:pt-[calc(var(--topbar)+48px)]">
                <div className="md:max-w-[min(660px,54vw)]">
                    <h1 className="sr-only">{title}</h1>
                    {logo ? (
                        <div aria-hidden className="relative h-[clamp(72px,12vh,150px)] w-[min(82%,520px)] animate-focus-in md:w-[min(540px,44vw)]">
                            <TmdbImage kind="logo" path={logo.path} alt="" fill sizes="(min-width: 768px) 540px, 80vw" shimmer={false} priority className="object-contain object-left-bottom drop-shadow-[0_4px_30px_rgb(0_0_0/0.6)] rtl:object-right-bottom" />
                        </div>
                    ) : (
                        <p aria-hidden className="animate-focus-in text-balance font-display text-[clamp(40px,6vw,88px)] font-extrabold leading-[0.95]"><bdi>{title}</bdi></p>
                    )}

                    <p className="mt-5 flex animate-focus-in flex-wrap items-center gap-x-3 gap-y-1 text-[15px] text-white/80 [animation-delay:80ms]">
                        {data.vote_average > 0 && (
                            <span className="inline-flex items-center gap-1 font-semibold text-white" aria-label={t('detail.ratingOutOf', { rating: data.vote_average.toFixed(1) })}>
                                <Star aria-hidden className="h-4 w-4 fill-star text-star" />{data.vote_average.toFixed(1)}
                            </span>
                        )}
                        {years && <span>{years}</span>}
                        {length && <span>{length}</span>}
                        {data.adult && <span className="rounded-md bg-red-600 px-1.5 text-[12px] font-semibold text-white">18+</span>}
                        {genres.length > 0 && <span className="text-white/60">{genres.join(isArabicScript(locale) ? '، ' : ' / ')}</span>}
                    </p>

                    {data.tagline && <p dir="auto" className="mt-4 animate-focus-in text-pretty text-lg leading-snug text-white/90 [animation-delay:130ms]">“{data.tagline}”</p>}
                    {data.overview && (
                        <p className={cn('mt-3 line-clamp-4 max-w-[62ch] animate-focus-in text-[15px] leading-relaxed text-white/70 transition-opacity duration-700 [animation-delay:170ms] md:line-clamp-3', playing && 'md:opacity-0')}>
                            {data.overview}
                        </p>
                    )}

                    {release && <ReleaseCountdown event={release} />}

                    <div className="mt-6 flex animate-focus-in flex-col gap-3 [animation-delay:220ms] md:flex-row md:items-center">
                        <div className="flex gap-3">
                            <Button size="lg" onClick={onPlay} className="flex-1 px-8 md:flex-none">
                                <Play aria-hidden className="h-5 w-5 fill-current rtl:-scale-x-100" />{playLabel}
                            </Button>
                            {trailer && (
                                <Button size="lg" variant="secondary" onClick={() => setTrailerOpen(true)} className="flex-1 md:flex-none">
                                    <Clapperboard aria-hidden className="h-5 w-5" />{t('detail.trailer')}
                                </Button>
                            )}
                        </div>
                        <div className="mt-2 flex items-start justify-around gap-2 md:mt-0 md:justify-start md:gap-3 md:ps-1">
                            <HeroAction label={saved ? t('billboard.inMyList') : t('billboard.myList')} active={saved} onClick={() => toggle('saved', libraryItem)}>
                                {saved ? <Check aria-hidden className="h-5 w-5" /> : <Plus aria-hidden className="h-5 w-5" />}
                            </HeroAction>
                            <HeroAction label={favorite ? t('peek.unfavorite') : t('peek.favorite')} active={favorite} onClick={() => toggle('favorites', libraryItem)}>
                                <Heart aria-hidden className={cn('h-5 w-5', favorite && 'fill-current')} />
                            </HeroAction>
                            <HeroAction label={t('hero.share')} onClick={share}>
                                <Share2 aria-hidden className="h-5 w-5" />
                            </HeroAction>
                            {followable && <div className="self-center"><FollowButton mediaType={kind} id={id} title={title} /></div>}
                        </div>
                    </div>
                </div>

                {playing && (
                    <div className="absolute bottom-[clamp(48px,8vh,100px)] end-[var(--gutter)] hidden gap-2 animate-in fade-in duration-500 md:flex">
                        <button
                            type="button"
                            onClick={() => setPaused((value) => !value)}
                            aria-pressed={paused}
                            aria-label={paused ? t('clips.play') : t('clips.pause')}
                            className="pressable glass grid h-11 w-11 place-items-center rounded-full text-white"
                        >
                            {paused ? <Play aria-hidden className="ms-0.5 h-4 w-4 fill-current" /> : <Pause aria-hidden className="h-4 w-4 fill-current" />}
                        </button>
                        <button
                            type="button"
                            onClick={() => setMuted((value) => !value)}
                            aria-label={muted ? t('billboard.soundOn') : t('billboard.soundOff')}
                            className="pressable glass grid h-11 w-11 place-items-center rounded-full text-white"
                        >
                            {muted ? <VolumeX aria-hidden className="h-5 w-5" /> : <Volume2 aria-hidden className="h-5 w-5" />}
                        </button>
                    </div>
                )}
            </div>

            {trailer && (
                <Dialog open={trailerOpen} onOpenChange={setTrailerOpen}>
                    <DialogContent className="max-w-5xl overflow-hidden border-0 p-0">
                        <DialogTitle className="sr-only">{t('hero.trailerTitle', { title })}</DialogTitle>
                        <div className="aspect-video w-full bg-black">
                            {trailerOpen && (
                                <iframe
                                    src={`https://www.youtube-nocookie.com/embed/${trailer}?autoplay=1&rel=0&modestbranding=1`}
                                    title={t('hero.trailerTitle', { title })}
                                    className="h-full w-full"
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
