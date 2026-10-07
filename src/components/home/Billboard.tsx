"use client"
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Check, Info, Play, Plus, Star, Volume2, VolumeX } from 'lucide-react'
import { cn } from '@/src/lib/utils'
import TmdbImage from '@/src/components/TmdbImage'
import YouTubeBackdrop from '@/src/components/media/YouTubeBackdrop'
import { Button } from '@/src/components/ui/button'
import { useI18n } from '@/src/components/I18nProvider'
import { useRoomLight } from '@/src/components/shell/RoomLight'
import { useCanAutoplay } from '@/src/hooks/use-autoplay'
import { useMediaQuery } from '@/src/hooks/use-media-query'
import { loadAmbientColor } from '@/src/hooks/use-ambient-color'
import { useLibraryToggle } from '@/src/hooks/use-library-toggle'
import { useInLibrary } from '@/src/store/library'
import type { BillboardItem } from '@/src/lib/billboard'
import type { Translate } from '@/src/lib/i18n'

const SLIDE_MS = 9000
const TRAILER_DELAY_MS = 2500
const TRAILER_MAX_MS = 50000

const detailHref = (item: BillboardItem) => `/${item.kind}/${item.id}`
// "Play" goes straight to the player: the first episode for a show.
const playHref = (item: BillboardItem) => item.kind === 'tv' ? `/tv/${item.id}?s=1&e=1` : `/movie/${item.id}#streamSection`

/** The poster colour of every slide, for the room light. */
function useSlideColors(items: BillboardItem[]) {
    const [colors, setColors] = useState<(string | null)[]>([])
    useEffect(() => {
        let cancelled = false
        Promise.all(items.map((item) => (item.poster ? loadAmbientColor(item.poster) : Promise.resolve(null))))
            .then((found) => { if (!cancelled) setColors(found) })
        return () => { cancelled = true }
    }, [items])
    return colors
}

function Facts({ item, t, className }: { item: BillboardItem, t: Translate, className?: string }) {
    const length = item.runtime
        ? t('pick.runtime', { hours: Math.floor(item.runtime / 60), minutes: item.runtime % 60 })
        : item.seasons ? (item.seasons > 1 ? t('pick.seasons', { count: item.seasons }) : t('pick.oneSeason')) : ''
    return (
        <p className={cn('flex flex-wrap items-center gap-x-3 gap-y-1', className)}>
            {item.rating > 0 && (
                <span className="inline-flex items-center gap-1 font-semibold text-white">
                    <Star aria-hidden className="h-3.5 w-3.5 fill-star text-star" />
                    {item.rating.toFixed(1)}
                </span>
            )}
            {item.year && <span>{item.year}</span>}
            {length && <span>{length}</span>}
            {item.genres.length > 0 && <span className="text-white/60">{item.genres.join(' / ')}</span>}
        </p>
    )
}

function Title({ item, className, sizes }: { item: BillboardItem, className?: string, sizes: string }) {
    if (!item.logo) {
        return <h2 className={cn('font-display text-balance font-extrabold leading-[0.95] text-white', className)}><bdi>{item.title}</bdi></h2>
    }
    return (
        <h2 className={cn('relative', className)}>
            <span className="sr-only">{item.title}</span>
            <TmdbImage
                kind="logo"
                path={item.logo.path}
                alt=""
                fill
                sizes={sizes}
                shimmer={false}
                className="object-contain object-left-bottom drop-shadow-[0_4px_30px_rgb(0_0_0/0.6)] rtl:object-right-bottom"
            />
        </h2>
    )
}

function ListButton({ item, compact = false }: { item: BillboardItem, compact?: boolean }) {
    const { t } = useI18n()
    const toggle = useLibraryToggle()
    const media = { id: String(item.id), media_type: item.kind }
    const saved = useInLibrary('saved', media)
    const label = saved ? t('billboard.inMyList') : t('billboard.myList')
    return (
        <Button
            variant="secondary"
            size={compact ? 'icon-lg' : 'lg'}
            aria-pressed={saved}
            aria-label={compact ? label : undefined}
            title={label}
            onClick={() => toggle('saved', { id: String(item.id), title: item.title, poster_path: item.poster, media_type: item.kind })}
        >
            <span className="relative grid h-5 w-5 place-items-center">
                <Plus aria-hidden className={cn('absolute h-5 w-5 transition-[opacity,transform] duration-200', saved ? 'rotate-90 scale-50 opacity-0' : 'opacity-100')} />
                <Check aria-hidden className={cn('absolute h-5 w-5 transition-[opacity,transform] duration-200', saved ? 'opacity-100' : '-rotate-45 scale-50 opacity-0')} />
            </span>
            {!compact && label}
        </Button>
    )
}

/**
 * Desktop: the full-bleed stage. Backdrops cross-fade with a slow push-in; after a moment the
 * slide's trailer starts muted behind the title (and the timer waits for it to finish, up to
 * TRAILER_MAX_MS). Story-style segments show the progress and jump between slides. Everything
 * pauses when the stage is off screen or the tab is hidden.
 */
function Stage({ items, colors, enabled }: { items: BillboardItem[], colors: (string | null)[], enabled: boolean }) {
    const { t } = useI18n()
    const [index, setIndex] = useState(0)
    const [trailerOn, setTrailerOn] = useState(false)
    const [playing, setPlaying] = useState(false)
    const [progress, setProgress] = useState(0)
    const [muted, setMuted] = useState(true)
    const [inView, setInView] = useState(true)
    const [tabVisible, setTabVisible] = useState(true)
    const autoplay = useCanAutoplay()
    const ref = useRef<HTMLDivElement>(null)
    const timing = useRef({ index: -1, remaining: SLIDE_MS })
    const active = items[index]
    const running = enabled && inView && tabVisible

    useRoomLight(colors[index], enabled)

    const go = useCallback((next: number) => {
        setIndex(((next % items.length) + items.length) % items.length)
        setTrailerOn(false)
        setPlaying(false)
        setProgress(0)
    }, [items.length])

    useEffect(() => {
        const node = ref.current
        if (!node) return
        const observer = new IntersectionObserver(([entry]) => setInView(entry.intersectionRatio > 0.35), { threshold: [0, 0.35, 1] })
        observer.observe(node)
        const onVisibility = () => setTabVisible(document.visibilityState === 'visible')
        document.addEventListener('visibilitychange', onVisibility)
        return () => {
            observer.disconnect()
            document.removeEventListener('visibilitychange', onVisibility)
        }
    }, [])

    // The slide timer: paused (keeping what's left) while off screen or while a trailer plays.
    useEffect(() => {
        if (timing.current.index !== index) timing.current = { index, remaining: SLIDE_MS }
        if (!running || playing || items.length < 2) return
        const started = performance.now()
        const timer = setTimeout(() => go(index + 1), timing.current.remaining)
        return () => {
            clearTimeout(timer)
            if (timing.current.index === index) timing.current.remaining = Math.max(400, timing.current.remaining - (performance.now() - started))
        }
    }, [index, running, playing, go, items.length])

    // A moment after the slide settles, its trailer starts underneath.
    useEffect(() => {
        if (!autoplay || !running || !active?.trailer || trailerOn) return
        const timer = setTimeout(() => setTrailerOn(true), TRAILER_DELAY_MS)
        return () => clearTimeout(timer)
    }, [autoplay, running, active, trailerOn])

    // Long trailers don't hold the stage forever.
    useEffect(() => {
        if (!playing || !running) return
        const timer = setTimeout(() => go(index + 1), TRAILER_MAX_MS)
        return () => clearTimeout(timer)
    }, [playing, running, index, go])

    const near = (i: number) => {
        const distance = Math.abs(i - index)
        return distance <= 1 || distance === items.length - 1
    }

    return (
        <div ref={ref} className="relative h-[min(88svh,980px)] min-h-[600px] w-full overflow-hidden bg-black">
            {/* Backdrops: only the current slide and its neighbours are loaded. */}
            {items.map((item, i) => near(i) && (
                <div
                    key={item.id}
                    aria-hidden={i !== index}
                    className={cn('absolute inset-0 transition-opacity duration-1000 ease-out', i === index ? 'opacity-100' : 'opacity-0')}
                >
                    <div key={i === index ? `active-${index}` : 'idle'} className={cn('absolute inset-0', i === index && !playing && 'animate-ken-burns')}>
                        <TmdbImage
                            kind="backdrop"
                            path={item.backdrop}
                            alt=""
                            fill
                            priority={i === 0}
                            // The phone layout shows posters instead: there this costs a thumbnail.
                            sizes="(min-width: 768px) 100vw, 1px"
                            shimmer={false}
                            className="object-cover object-top"
                        />
                    </div>
                </div>
            ))}

            {trailerOn && active.trailer && (
                <YouTubeBackdrop
                    key={active.trailer}
                    videoKey={active.trailer}
                    muted={muted}
                    play={running}
                    zoom={1.3}
                    onState={(state) => {
                        if (state === 'playing') setPlaying(true)
                        if (state === 'ended') go(index + 1)
                    }}
                    onProgress={setProgress}
                />
            )}

            {/* Scrims: from the bottom (into the page), from the start side (behind the text), and a
                little from the top (behind the top bar). */}
            <div aria-hidden className="absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-t from-black via-black/60 to-transparent" />
            <div aria-hidden className="absolute inset-y-0 start-0 w-[70%] bg-gradient-to-r from-black/85 via-black/40 to-transparent rtl:bg-gradient-to-l" />
            <div aria-hidden className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/60 to-transparent" />

            <div className="page-x absolute inset-x-0 bottom-[clamp(120px,17vh,190px)]">
                <div key={index} className="max-w-[min(620px,52vw)]">
                    <p className="mb-4 animate-focus-in text-[13px] font-medium text-white/70">
                        {t('billboard.rank', { rank: index + 1 })}
                    </p>
                    <Title
                        item={active}
                        sizes="(min-width: 1280px) 560px, 46vw"
                        className={cn('animate-focus-in', active.logo ? 'h-[clamp(84px,14vh,170px)] w-[min(560px,46vw)]' : 'text-[clamp(44px,5.6vw,92px)]')}
                    />
                    <Facts item={active} t={t} className="mt-5 animate-focus-in text-[15px] text-white/80 [animation-delay:90ms]" />
                    <p className={cn('mt-3 line-clamp-3 max-w-[54ch] animate-focus-in text-[15px] leading-relaxed text-white/75 transition-opacity duration-700 [animation-delay:150ms]', playing && 'opacity-0')}>
                        {active.overview}
                    </p>
                    <div className="mt-7 flex animate-focus-in flex-wrap items-center gap-3 [animation-delay:210ms]">
                        <Button asChild size="lg" className="px-8">
                            <Link href={playHref(active)}><Play aria-hidden className="h-5 w-5 fill-current" />{t('billboard.play')}</Link>
                        </Button>
                        <Button asChild size="lg" variant="secondary">
                            <Link href={detailHref(active)}><Info aria-hidden className="h-5 w-5" />{t('pick.moreInfo')}</Link>
                        </Button>
                        <ListButton item={active} compact />
                    </div>
                </div>
            </div>

            <div className="page-x absolute inset-x-0 bottom-[clamp(120px,17vh,190px)] flex justify-end">
                <div className="flex items-center gap-4">
                    {playing && (
                        <button
                            type="button"
                            onClick={() => setMuted((value) => !value)}
                            aria-label={muted ? t('billboard.soundOn') : t('billboard.soundOff')}
                            className="pressable glass grid h-11 w-11 place-items-center rounded-full text-white/90 animate-in fade-in duration-500 hover:text-white"
                        >
                            {muted ? <VolumeX aria-hidden className="h-5 w-5" /> : <Volume2 aria-hidden className="h-5 w-5" />}
                        </button>
                    )}
                </div>
            </div>

            {items.length > 1 && (
                <div className="page-x absolute inset-x-0 bottom-[clamp(84px,11vh,128px)] flex justify-end">
                    <div role="tablist" aria-label={t('billboard.aria')} className="flex items-center gap-1.5">
                        {items.map((item, i) => (
                            <button
                                key={item.id}
                                type="button"
                                role="tab"
                                aria-selected={i === index}
                                aria-label={t('billboard.show', { title: item.title })}
                                onClick={() => go(i)}
                                className="group py-3 outline-none"
                            >
                                <span className={cn('relative block h-[3px] overflow-hidden rounded-full bg-white/25 transition-[width,background-color] duration-300 ease-out group-hover:bg-white/45 group-focus-visible:ring-2 group-focus-visible:ring-red-500', i === index ? 'w-14' : 'w-6')}>
                                    {i === index && (playing
                                        ? <span className="absolute inset-0 origin-left bg-white transition-transform duration-500 ease-linear rtl:origin-right" style={{ transform: `scaleX(${progress})` }} />
                                        : <span
                                            key={index}
                                            className="absolute inset-0 origin-left bg-white rtl:origin-right"
                                            style={{
                                                animation: `segment-fill ${SLIDE_MS}ms linear forwards`,
                                                animationPlayState: running ? 'running' : 'paused',
                                            }}
                                        />)}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

/**
 * Phones: a deck of big poster cards you swipe through (native scroll-snap physics), each with
 * its title and actions. The room light follows the card in the middle. It turns by itself every
 * few seconds until the viewer touches it.
 */
function Deck({ items, colors, enabled }: { items: BillboardItem[], colors: (string | null)[], enabled: boolean }) {
    const { t, dir } = useI18n()
    const [index, setIndex] = useState(0)
    const [touched, setTouched] = useState(false)
    const scroller = useRef<HTMLDivElement>(null)

    useRoomLight(colors[index], enabled)

    const step = () => {
        const node = scroller.current
        const card = node?.firstElementChild as HTMLElement | null
        if (!node || !card) return 0
        return card.offsetWidth + parseFloat(getComputedStyle(node).columnGap || '0')
    }

    const onScroll = () => {
        const node = scroller.current
        const width = step()
        if (!node || !width) return
        setIndex(Math.max(0, Math.min(items.length - 1, Math.round(Math.abs(node.scrollLeft) / width))))
    }

    const scrollToCard = useCallback((i: number) => {
        const node = scroller.current
        if (!node) return
        const left = step() * i
        node.scrollTo({ left: dir === 'rtl' ? -left : left, behavior: 'smooth' })
    }, [dir])

    useEffect(() => {
        if (!enabled || touched || items.length < 2) return
        const timer = setTimeout(() => scrollToCard((index + 1) % items.length), 6500)
        return () => clearTimeout(timer)
    }, [enabled, touched, index, items.length, scrollToCard])

    return (
        <div className="pt-[calc(var(--topbar)+env(safe-area-inset-top,0px)+6px)]">
            <div
                ref={scroller}
                onScroll={onScroll}
                onPointerDown={() => setTouched(true)}
                className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-[calc((100vw-min(80vw,380px))/2)] pb-6 pt-2"
            >
                {items.map((item, i) => (
                    <article
                        key={item.id}
                        aria-roledescription="slide"
                        aria-label={t('billboard.slideOf', { current: i + 1, total: items.length })}
                        className={cn(
                            'relative aspect-[2/3] w-[min(80vw,380px)] shrink-0 snap-center snap-always overflow-hidden rounded-[26px] bg-white/5 ring-1 ring-white/10 transition-[transform,opacity] duration-500 ease-out',
                            i === index ? 'shadow-[0_30px_70px_-20px_rgb(0_0_0/0.95)]' : 'scale-[0.93] opacity-60',
                        )}
                    >
                        <TmdbImage
                            kind="poster"
                            path={item.poster}
                            alt=""
                            fill
                            priority={i === 0}
                            sizes="(min-width: 768px) 1px, 80vw"
                            className="object-cover"
                        />
                        <div aria-hidden className="absolute inset-x-0 bottom-0 h-[62%] bg-gradient-to-t from-black via-black/70 to-transparent" />
                        <Link href={detailHref(item)} aria-label={item.title} className="absolute inset-0" tabIndex={i === index ? 0 : -1} />
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 p-5 text-center">
                            <Title item={item} sizes="70vw" className={item.logo ? 'h-[72px] w-[78%] [&_img]:!object-bottom' : 'text-[34px]'} />
                            <Facts item={item} t={t} className="justify-center text-[13px] text-white/80" />
                            <div className="pointer-events-auto mt-1 flex w-full items-center gap-2.5">
                                <Button asChild size="lg" className="flex-1" tabIndex={i === index ? 0 : -1}>
                                    <Link href={playHref(item)}><Play aria-hidden className="h-5 w-5 fill-current" />{t('billboard.play')}</Link>
                                </Button>
                                <ListButton item={item} compact />
                            </div>
                        </div>
                    </article>
                ))}
            </div>
            {items.length > 1 && (
                <div aria-hidden className="flex justify-center gap-1.5">
                    {items.map((item, i) => (
                        <span key={item.id} className={cn('h-1.5 rounded-full transition-[width,background-color] duration-300 ease-out', i === index ? 'w-5 bg-white' : 'w-1.5 bg-white/30')} />
                    ))}
                </div>
            )}
        </div>
    )
}

/** The home page header: today's trending titles, cinematic on desktop, a poster deck on phones. */
export default function Billboard({ items }: { items: BillboardItem[] }) {
    const { t } = useI18n()
    const colors = useSlideColors(items)
    const desktop = useMediaQuery('(min-width: 768px)')
    if (items.length === 0) return null
    return (
        <section aria-roledescription="carousel" aria-label={t('billboard.aria')} className="relative">
            <div className="hidden md:block">
                <Stage items={items} colors={colors} enabled={desktop} />
            </div>
            <div className="md:hidden">
                <Deck items={items} colors={colors} enabled={!desktop} />
            </div>
        </section>
    )
}
