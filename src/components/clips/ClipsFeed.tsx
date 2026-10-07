"use client"
import React, { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, m } from 'framer-motion'
import { Check, ChevronUp, Compass, Heart, Info, Pause, Play, Plus, Share2, Star, Volume2, VolumeX } from 'lucide-react'
import TmdbImage from '@/src/components/TmdbImage'
import YouTubeBackdrop from '@/src/components/media/YouTubeBackdrop'
import { Button } from '@/src/components/ui/button'
import { useI18n } from '@/src/components/I18nProvider'
import { useRoomLight } from '@/src/components/shell/RoomLight'
import { useCanAutoplay } from '@/src/hooks/use-autoplay'
import { loadAmbientColor } from '@/src/hooks/use-ambient-color'
import { useLibraryToggle } from '@/src/hooks/use-library-toggle'
import { toast } from '@/src/hooks/use-toast'
import { useInLibrary } from '@/src/store/library'
import { haptic, spring } from '@/src/lib/motion'
import { cn } from '@/src/lib/utils'
import type { Clip } from '@/src/lib/clips'

// Mount the trailer only once the swipe has settled on a clip.
const SETTLE_MS = 260

const playHref = (clip: Clip) => clip.kind === 'tv' ? `/tv/${clip.id}?s=1&e=1` : `/movie/${clip.id}#streamSection`
const detailHref = (clip: Clip) => `/${clip.kind}/${clip.id}`

function Action({ label, active, onClick, href, children }: { label: string, active?: boolean, onClick?: () => void, href?: string, children: React.ReactNode }) {
    const body = (
        <>
            <span className={cn(
                'grid h-12 w-12 place-items-center rounded-full backdrop-blur-md transition-colors duration-150 group-focus-visible:ring-2 group-focus-visible:ring-red-500',
                active ? 'bg-white text-black' : 'bg-black/35 text-white ring-1 ring-white/20 hover:bg-black/55',
            )}>
                {children}
            </span>
            <span className="max-w-[72px] truncate text-[11.5px] font-medium text-white/85 drop-shadow-[0_1px_4px_rgb(0_0_0/0.8)]">{label}</span>
        </>
    )
    const className = 'group pressable flex flex-col items-center gap-1.5 outline-none'
    return href
        ? <Link href={href} className={className} aria-label={label}>{body}</Link>
        : <button type="button" onClick={onClick} aria-pressed={active} aria-label={label} className={className}>{body}</button>
}

function ClipSlide({ clip, index, total, isActive, mounted, muted, paused, onTogglePause, onProgress, progress, autoplay, onStart }: {
    clip: Clip
    index: number
    total: number
    isActive: boolean
    mounted: boolean
    muted: boolean
    paused: boolean
    onTogglePause: () => void
    onProgress: (value: number) => void
    progress: number
    autoplay: boolean
    onStart: () => void
}) {
    const { t } = useI18n()
    const toggle = useLibraryToggle()
    const [playing, setPlaying] = useState(false)
    const media = { id: String(clip.id), media_type: clip.kind }
    const saved = useInLibrary('saved', media)
    const favorite = useInLibrary('favorites', media)
    const item = { id: String(clip.id), title: clip.title, poster_path: clip.poster, media_type: clip.kind }

    useEffect(() => { if (!mounted) setPlaying(false) }, [mounted])

    const share = async () => {
        const url = `${window.location.origin}${detailHref(clip)}`
        try {
            if (navigator.share) await navigator.share({ title: clip.title, url })
            else {
                await navigator.clipboard.writeText(url)
                toast({ title: t('common.linkCopied'), description: t('common.linkCopiedDesc', { title: clip.title }) })
            }
        } catch { /* cancelled */ }
    }

    return (
        <section
            data-clip={index}
            aria-label={t('clips.position', { current: index + 1, total })}
            className="relative h-[100dvh] w-full snap-start snap-always overflow-hidden"
        >
            {/* The ambience: the same picture, blurred and enlarged, fills the screen around the trailer. */}
            <div aria-hidden className="absolute inset-0">
                <TmdbImage kind="backdrop" path={clip.backdrop} alt="" fill sizes="40vw" shimmer={false} priority={index === 0} className="scale-125 object-cover opacity-45 blur-2xl" />
                <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/20 to-black/85" />
            </div>

            {/* The screen, centred between the top bar and the text. */}
            <div className="absolute inset-x-0 bottom-[calc(var(--tabbar-space)+236px)] top-[var(--topbar)] flex items-center justify-center lg:bottom-[290px] lg:px-[calc(var(--rail)+var(--gutter))]">
                <div className="relative aspect-video w-full overflow-hidden bg-black shadow-[0_40px_120px_-30px_rgb(0_0_0/0.95)] ring-white/10 lg:max-w-[min(1100px,calc((100dvh-var(--topbar)-310px)*16/9))] lg:rounded-[22px] lg:ring-1">
                    <TmdbImage kind="backdrop" path={clip.backdrop} alt="" fill sizes="(min-width: 1024px) 1100px, 100vw" priority={index === 0} className="object-cover" />
                    {mounted && (
                        <YouTubeBackdrop
                            videoKey={clip.trailer}
                            loop
                            muted={muted}
                            play={isActive && !paused}
                            zoom={1.28}
                            onState={(state) => setPlaying(state === 'playing')}
                            onProgress={onProgress}
                        />
                    )}
                    <button
                        type="button"
                        onClick={autoplay || mounted ? onTogglePause : onStart}
                        aria-label={!mounted ? t('clips.tapToPlay') : paused ? t('clips.play') : t('clips.pause')}
                        className="absolute inset-0 outline-none"
                    >
                        <AnimatePresence>
                            {(paused || (!autoplay && !mounted)) && (
                                <m.span
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 1.2 }}
                                    transition={spring.snappy}
                                    className="absolute left-1/2 top-1/2 -ms-8 -mt-8 grid h-16 w-16 place-items-center rounded-full bg-black/50 text-white ring-1 ring-white/30 backdrop-blur-md"
                                >
                                    <Play aria-hidden className="ms-1 h-7 w-7 fill-current" />
                                </m.span>
                            )}
                        </AnimatePresence>
                    </button>
                    {/* Progress: a thin red line along the bottom of the screen. */}
                    {isActive && playing && (
                        <div aria-hidden className="absolute inset-x-0 bottom-0 h-[3px] bg-white/15">
                            <div className="h-full origin-left bg-red-500 transition-transform duration-500 ease-linear rtl:origin-right" style={{ transform: `scaleX(${progress})` }} />
                        </div>
                    )}
                </div>
            </div>

            {/* What it is, and the way in. */}
            <div className="page-x absolute inset-x-0 bottom-[calc(var(--tabbar-space)+16px)] pe-[88px] lg:bottom-10 lg:pe-[calc(var(--gutter)+96px)]">
                <div className="max-w-[560px]">
                    {clip.logo ? (
                        <h2 className="relative h-14 w-[min(70%,300px)] lg:h-20 lg:w-[360px]">
                            <span className="sr-only">{clip.title}</span>
                            <TmdbImage kind="logo" path={clip.logo.path} alt="" fill sizes="360px" shimmer={false} className="object-contain object-left-bottom drop-shadow-[0_4px_20px_rgb(0_0_0/0.7)] rtl:object-right-bottom" />
                        </h2>
                    ) : (
                        <h2 className="font-display text-[30px] font-extrabold leading-none lg:text-[40px]"><bdi>{clip.title}</bdi></h2>
                    )}
                    <p className="mt-3 flex flex-wrap items-center gap-x-3 text-[13px] text-white/75">
                        {clip.rating > 0 && <span className="inline-flex items-center gap-1 font-semibold text-white"><Star aria-hidden className="h-3.5 w-3.5 fill-star text-star" />{clip.rating.toFixed(1)}</span>}
                        {clip.year && <span>{clip.year}</span>}
                        <span>{clip.kind === 'tv' ? t('common.tvShow') : t('common.movie')}</span>
                        {clip.genres.length > 0 && <span className="text-white/55">{clip.genres.join(' / ')}</span>}
                    </p>
                    {clip.overview && <p className="mt-2 line-clamp-2 text-[13.5px] leading-relaxed text-white/70">{clip.overview}</p>}
                    <Button asChild className="mt-4" size="default">
                        <Link href={playHref(clip)}><Play aria-hidden className="h-4 w-4 fill-current rtl:-scale-x-100" />{t('clips.watch')}</Link>
                    </Button>
                </div>
            </div>

            {/* Thumb-zone actions on the end side. */}
            <div className="absolute bottom-[calc(var(--tabbar-space)+20px)] end-3 flex flex-col items-center gap-3 lg:bottom-10 lg:end-[var(--gutter)] lg:gap-4">
                <Action label={saved ? t('billboard.inMyList') : t('billboard.myList')} active={saved} onClick={() => toggle('saved', item)}>
                    {saved ? <Check aria-hidden className="h-5 w-5" /> : <Plus aria-hidden className="h-5 w-5" />}
                </Action>
                <Action label={t('peek.favorite')} active={favorite} onClick={() => toggle('favorites', item)}>
                    <Heart aria-hidden className={cn('h-5 w-5', favorite && 'fill-current')} />
                </Action>
                <Action label={t('peek.share')} onClick={share}>
                    <Share2 aria-hidden className="h-5 w-5" />
                </Action>
                <Action label={t('peek.details')} href={detailHref(clip)}>
                    <Info aria-hidden className="h-5 w-5" />
                </Action>
            </div>
        </section>
    )
}

/**
 * Clips: full-screen trailers you swipe through (native scroll-snap), TikTok-style. Only the clip
 * on screen plays; it starts muted (browsers require it) and one tap on "Tap for sound" turns sound
 * on for the rest of the feed. Tapping the picture pauses. ↑ ↓ / J K move, M mutes, Space pauses.
 */
export default function ClipsFeed({ clips }: { clips: Clip[] }) {
    const { t } = useI18n()
    const scroller = useRef<HTMLDivElement>(null)
    const [active, setActive] = useState(0)
    const [settled, setSettled] = useState(-1)
    const [muted, setMuted] = useState(true)
    const [paused, setPaused] = useState(false)
    const [progress, setProgress] = useState(0)
    const [started, setStarted] = useState(false)
    const [moved, setMoved] = useState(false)
    const [colors, setColors] = useState<(string | null)[]>([])
    const autoplay = useCanAutoplay(false)
    const canPlay = autoplay || started

    useRoomLight(colors[active])

    useEffect(() => {
        let cancelled = false
        Promise.all(clips.map((clip) => (clip.poster ? loadAmbientColor(clip.poster) : Promise.resolve(null))))
            .then((found) => { if (!cancelled) setColors(found) })
        return () => { cancelled = true }
    }, [clips])

    // The feed is the page: the window itself doesn't scroll here.
    useEffect(() => {
        const root = document.documentElement
        const previous = root.style.overflow
        root.style.overflow = 'hidden'
        return () => { root.style.overflow = previous }
    }, [])

    // Which clip is on screen.
    useEffect(() => {
        const root = scroller.current
        if (!root) return
        const observer = new IntersectionObserver((entries) => {
            for (const entry of entries) {
                const data = (entry.target as HTMLElement).dataset
                if (entry.isIntersecting) setActive(Number(data.clip ?? data.end))
            }
        }, { root, threshold: 0.6 })
        root.querySelectorAll('[data-clip], [data-end]').forEach((node) => observer.observe(node))
        return () => observer.disconnect()
    }, [clips.length])

    useEffect(() => {
        setProgress(0)
        setPaused(false)
        if (active > 0) setMoved(true)
        const timer = setTimeout(() => setSettled(active), SETTLE_MS)
        return () => clearTimeout(timer)
    }, [active])

    const go = useCallback((index: number) => {
        const node = scroller.current?.querySelector(`[data-clip="${index}"], [data-end="${index}"]`)
        node?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, [])

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)) return
            if (event.key === 'ArrowDown' || event.key === 'j') { event.preventDefault(); go(Math.min(active + 1, clips.length)) }
            else if (event.key === 'ArrowUp' || event.key === 'k') { event.preventDefault(); go(Math.max(active - 1, 0)) }
            else if (event.key === 'm') setMuted((value) => !value)
            else if (event.key === ' ') { event.preventDefault(); setPaused((value) => !value) }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [active, clips.length, go])

    const toggleSound = () => {
        haptic(8)
        setMuted((value) => !value)
    }

    return (
        <div ref={scroller} className="no-scrollbar fixed inset-0 z-[5] snap-y snap-mandatory overflow-y-auto overscroll-contain bg-black">
            {clips.map((clip, index) => (
                <ClipSlide
                    key={`${clip.kind}-${clip.id}`}
                    clip={clip}
                    index={index}
                    total={clips.length}
                    isActive={index === active}
                    mounted={canPlay && index === settled}
                    muted={muted}
                    paused={paused}
                    onTogglePause={() => setPaused((value) => !value)}
                    onProgress={setProgress}
                    progress={progress}
                    autoplay={autoplay}
                    onStart={() => { setStarted(true); setSettled(index) }}
                />
            ))}

            {/* The end: a finite feed, on purpose. */}
            <section data-end={clips.length} className="relative grid h-[100dvh] snap-start place-items-center px-6 text-center">
                <div className="flex max-w-sm flex-col items-center">
                    <span className="grid h-16 w-16 place-items-center rounded-full bg-white/[0.08] text-white ring-1 ring-white/15">
                        <Check aria-hidden className="h-7 w-7" />
                    </span>
                    <h2 className="mt-5 font-display text-[32px] font-extrabold leading-tight">{t('clips.caughtUp')}</h2>
                    <p className="mt-2 text-[15px] text-white/60">{t('clips.caughtUpText')}</p>
                    <div className="mt-7 flex flex-wrap justify-center gap-3">
                        <Button asChild><Link href="/discover"><Compass aria-hidden className="h-4 w-4" />{t('clips.browse')}</Link></Button>
                        <Button variant="secondary" onClick={() => go(0)}><ChevronUp aria-hidden className="h-4 w-4" />{t('clips.backToTop')}</Button>
                    </div>
                </div>
            </section>

            {/* Sound, pinned under the top bar. Muted until the viewer asks (browsers insist). */}
            {active < clips.length && (
                <button
                    type="button"
                    onClick={toggleSound}
                    aria-label={muted ? t('clips.unmute') : t('clips.mute')}
                    className="pressable glass fixed end-[var(--gutter)] top-[calc(var(--topbar)+env(safe-area-inset-top,0px)+12px)] z-[6] flex h-10 items-center gap-2 rounded-full px-3.5 text-[13px] font-medium text-white"
                >
                    {muted ? <VolumeX aria-hidden className="h-4 w-4" /> : <Volume2 aria-hidden className="h-4 w-4" />}
                    {muted && <span>{t('clips.soundOn')}</span>}
                </button>
            )}

            {/* First visit: a nudge to swipe, gone after the first move. */}
            <AnimatePresence>
                {!moved && clips.length > 1 && (
                    <m.p
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ delay: 1.2, duration: 0.4 }}
                        className="pointer-events-none fixed inset-x-0 top-[calc(var(--topbar)+env(safe-area-inset-top,0px)+64px)] z-[6] flex justify-center lg:top-auto lg:bottom-4"
                    >
                        <span className="glass inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12.5px] text-white/85">
                            <ChevronUp aria-hidden className="h-4 w-4 animate-bounce" />{t('clips.hint')}
                        </span>
                    </m.p>
                )}
            </AnimatePresence>
            {paused && <span className="sr-only" aria-live="polite"><Pause aria-hidden />{t('clips.pause')}</span>}
        </div>
    )
}
