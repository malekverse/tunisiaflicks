"use client"
import React, { useCallback, useEffect, useId, useRef, useState } from 'react'
import { m } from 'framer-motion'
import { Check, Layers, Lightbulb, LightbulbOff, LogOut, Play, SkipForward, TriangleAlert } from 'lucide-react'
import { toast } from '@/src/hooks/use-toast'
import type { StreamProvider } from '@/src/lib/stream-providers'
import { cn } from '@/src/lib/utils'
import { spring } from '@/src/lib/motion'
import { useT } from '@/src/components/I18nProvider'
import { useStreamSource } from '@/src/hooks/use-stream-source'
import { useTvMode } from '@/src/hooks/use-tv-mode'
import { pushTvBackHandler } from '@/src/components/tv/use-focus-engine'
import KeyGlyph from '@/src/components/tv/KeyGlyph'
import TmdbImage from '@/src/components/TmdbImage'
import { Button } from '@/src/components/ui/button'

/** TV mode: after this many briefings on a device, the briefing shrinks to a short hint. */
const FULL_BRIEFINGS = 3
const VISITS_KEY = 'tf-tv-player-visits'
/** TV mode: a source that hasn't loaded after this long is called slow. */
const SLOW_MS = 12_000

/**
 * The player: a framed 16:9 screen with an ambient glow in the poster's colour, the source
 * switcher under it, theater mode (everything else fades to black; Esc or a click outside brings
 * the lights back) and the download control. `enabled=false` shows the placeholder instead of the
 * iframe (a show before an episode is picked).
 *
 * Streams come from several third-party providers (lib/stream-providers.ts) so the viewer can switch
 * when one is down. The source that last played for this viewer is reopened, and sources other
 * viewers report as broken move to the end (crowd-sourced, see use-stream-source / lib/stream-health).
 *
 * In TV mode the player waits for the remote: a briefing ("Ready on {source}", the keys, [Start
 * watching]) comes first, then Start goes full screen, keeps the screen awake and hands the remote
 * to the player. Back while playing opens the player menu (back to the video, next episode,
 * sources, the next source, leave); a second Back leaves the player.
 */
export default function StreamSection({ services, downloadSlot, enabled = true, placeholder, backdrop, onNext, nextLabel, className }: {
    services: StreamProvider[]
    /** Rendered at the end of the controls (the Download control). */
    downloadSlot?: React.ReactNode
    enabled?: boolean
    placeholder?: { title: string, description: string, action?: { label: string, onClick: () => void } }
    /** Shown dimmed behind the placeholder. */
    backdrop?: string | null
    /** TV: jump to the next episode. */
    onNext?: () => void
    nextLabel?: string
    className?: string
}) {
    const t = useT()
    const tv = useTvMode()
    const pillId = useId()
    const [isLoading, setIsLoading] = useState(true)
    const [lightsOff, setLightsOff] = useState(false)
    const sectionRef = useRef<HTMLElement>(null)
    const source = useStreamSource(services, { playing: enabled && !isLoading })
    const url = source.ready ? source.current?.url : undefined

    // --- TV mode: the briefing, the start, the Back menu ---
    const [started, setStarted] = useState(false)
    const [menu, setMenu] = useState<null | 'main' | 'sources'>(null)
    const [slow, setSlow] = useState(false)
    const [hint, setHint] = useState(false)
    const [compact, setCompact] = useState(false)
    const frameRef = useRef<HTMLDivElement>(null)
    const iframeRef = useRef<HTMLIFrameElement>(null)
    const startRef = useRef<HTMLButtonElement>(null)
    const tabsRef = useRef<HTMLDivElement>(null)
    const menuRef = useRef<HTMLDivElement>(null)
    const wakeLock = useRef<{ release: () => Promise<void> } | null>(null)
    const guarded = useRef(false)
    const playerOn = tv && enabled && started
    // Came here to watch (a Play link: #streamSection, or an episode in the address)?
    const [arrived, setArrived] = useState(false)

    // A new source or episode means a new iframe load.
    useEffect(() => {
        setIsLoading(true)
    }, [url])

    useEffect(() => {
        if (!lightsOff) return
        sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setLightsOff(false) }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [lightsOff])

    useEffect(() => {
        if (!tv) return
        setArrived(window.location.hash === '#streamSection' || new URLSearchParams(window.location.search).has('e'))
    }, [tv])

    // Each time the briefing shows counts; after a few, it's only a short hint.
    useEffect(() => {
        if (!tv || !enabled) return
        try {
            const visits = Number(localStorage.getItem(VISITS_KEY)) || 0
            setCompact(visits >= FULL_BRIEFINGS)
            localStorage.setItem(VISITS_KEY, String(visits + 1))
        } catch { /* private mode: always the full briefing */ }
    }, [tv, enabled])

    const focusPlayer = useCallback(() => {
        window.setTimeout(() => iframeRef.current?.focus(), 50)
    }, [])

    const releaseScreen = () => {
        wakeLock.current?.release().catch(() => {})
        wakeLock.current = null
    }

    const start = async () => {
        setStarted(true)
        setMenu(null)
        if (compact) setHint(true)
        try {
            if (!document.fullscreenElement) await frameRef.current?.requestFullscreen?.({ navigationUI: 'hide' })
        } catch { /* not allowed here: the player still plays in the page */ }
        try {
            const lock = (navigator as { wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock
            if (lock && !wakeLock.current) wakeLock.current = await lock.request('screen')
        } catch { /* no wake lock: the TV's own sleep timer applies */ }
        // The browser's Back (and the Android app's) lands here first, while the video plays.
        if (!guarded.current) {
            window.history.pushState({ ...(window.history.state ?? {}), tfPlayer: true }, '')
            guarded.current = true
        }
        focusPlayer()
    }

    const leave = useCallback(() => {
        setMenu(null)
        setStarted(false)
        setSlow(false)
        setHint(false)
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
        releaseScreen()
        if (guarded.current) {
            guarded.current = false
            window.history.back()
        }
        window.setTimeout(() => startRef.current?.focus({ preventScroll: true }), 80)
    }, [])

    const resume = () => {
        setMenu(null)
        if (!document.fullscreenElement) frameRef.current?.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => {})
        focusPlayer()
    }

    // Back while playing: the menu first, then out.
    useEffect(() => {
        if (!playerOn) return
        return pushTvBackHandler(() => {
            if (menu) leave()
            else setMenu('main')
            return true
        })
    }, [playerOn, menu, leave])

    // The browser's own Back (a TV browser's key, or a key the player let through): same thing.
    useEffect(() => {
        if (!playerOn) return
        const onPop = () => {
            guarded.current = false
            if (menu) return leave()
            setMenu('main')
            window.history.pushState({ ...(window.history.state ?? {}), tfPlayer: true }, '')
            guarded.current = true
        }
        window.addEventListener('popstate', onPop)
        return () => window.removeEventListener('popstate', onPop)
    }, [playerOn, menu, leave])

    // Leaving full screen (Esc on a keyboard) is a Back too.
    useEffect(() => {
        if (!playerOn) return
        const onChange = () => { if (!document.fullscreenElement) setMenu((current) => current ?? 'main') }
        document.addEventListener('fullscreenchange', onChange)
        return () => document.removeEventListener('fullscreenchange', onChange)
    }, [playerOn])

    // Arriving to watch: Start takes the focus once the page has scrolled here.
    useEffect(() => {
        if (!tv || !enabled || started || !arrived || !url) return
        const timer = window.setTimeout(() => startRef.current?.focus({ preventScroll: true }), 450)
        return () => window.clearTimeout(timer)
    }, [tv, enabled, started, arrived, url])

    // The menu takes the focus while it's open.
    useEffect(() => {
        if (menu) window.setTimeout(() => menuRef.current?.querySelector<HTMLElement>('button')?.focus({ preventScroll: true }), 0)
    }, [menu])

    // The short hint (after a few briefings).
    useEffect(() => {
        if (!hint) return
        const timer = window.setTimeout(() => setHint(false), 2500)
        return () => window.clearTimeout(timer)
    }, [hint])

    // A source that doesn't answer.
    useEffect(() => {
        setSlow(false)
        if (!playerOn || !isLoading) return
        const timer = window.setTimeout(() => setSlow(true), SLOW_MS)
        return () => window.clearTimeout(timer)
    }, [playerOn, isLoading, url])

    // Leaving the page while playing: let the screen sleep again.
    useEffect(() => () => releaseScreen(), [])

    const select = (name: string) => {
        if (!enabled) {
            toast({ title: placeholder?.title ?? t('common.notReady'), description: placeholder?.description ?? '', variant: 'destructive', duration: 3000 })
            return
        }
        if (name === source.current?.name) return
        source.select(name)
        toast({ title: t('stream.changed'), description: t('stream.nowUsing', { name }), duration: 2500 })
    }

    const notWorking = () => {
        const next = source.reportBroken()
        if (next) toast({ title: t('stream.reported'), description: t('stream.nowUsing', { name: next }), duration: 4000 })
    }

    const healthLabel = (name: string) => {
        const status = source.health[name]?.status
        if (name === source.remembered) return t('stream.lastWorked')
        return status === 'good' ? t('stream.healthGood') : status === 'down' ? t('stream.healthDown') : undefined
    }

    const sourceName = source.current?.name ?? ''
    const briefing = tv && enabled && !started

    return (
        <section
            id="streamSection"
            ref={sectionRef}
            aria-label={t('detail.watch')}
            // Above the bars (z-40/50) while the lights are off.
            className={cn('page-x scroll-mt-[calc(var(--topbar)+72px)]', lightsOff && 'relative z-[61]', className)}
        >
            {lightsOff && (
                <div aria-hidden onClick={() => setLightsOff(false)} className="fixed inset-0 z-[60] bg-black/95 animate-in fade-in duration-700" />
            )}

            <div className={cn('relative isolate mx-auto max-w-[1400px]', lightsOff && 'z-[61]')}>
                {/* Ambient glow behind the screen, tinted with the poster's colour. */}
                <div
                    aria-hidden
                    className="tf-ambient-glow pointer-events-none absolute -inset-x-4 -inset-y-6 -z-10 rounded-[3rem] blur-3xl transition-[background] duration-700 md:-inset-x-10 md:-inset-y-10"
                    style={{ background: `rgb(var(--tf-ambient) / ${lightsOff ? 0.5 : 0.24})` }}
                />

                <div ref={frameRef} className="relative mx-auto aspect-video max-h-[80vh] w-full overflow-hidden rounded-[14px] bg-black shadow-[0_40px_100px_-30px_rgb(0_0_0/0.9)] ring-1 ring-white/10 md:rounded-[22px]">
                    {!enabled ? (
                        <div className="absolute inset-0">
                            {backdrop && <TmdbImage kind="backdrop" path={backdrop} alt="" fill sizes="(min-width: 1400px) 1400px, 100vw" className="object-cover opacity-30 blur-[2px]" />}
                            <div className="absolute inset-0 grid place-items-center bg-gradient-to-t from-black/80 to-black/30 px-6 text-center">
                                <div className="flex max-w-md flex-col items-center">
                                    <span className="grid h-16 w-16 place-items-center rounded-full bg-white/10 ring-1 ring-white/25 backdrop-blur-md">
                                        <Play aria-hidden className="ms-1 h-7 w-7 fill-current rtl:-scale-x-100" />
                                    </span>
                                    <h3 className="mt-4 font-display text-2xl font-bold text-white">{placeholder?.title}</h3>
                                    <p className="mt-1 text-sm text-white/65">{placeholder?.description}</p>
                                    {placeholder?.action && (
                                        <Button className="mt-5" onClick={placeholder.action.onClick}>
                                            <Play aria-hidden className="h-4 w-4 fill-current rtl:-scale-x-100" />{placeholder.action.label}
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : briefing ? (
                        // TV mode, before the player starts: what the remote does, and Start.
                        <div className="absolute inset-0">
                            {backdrop && <TmdbImage kind="backdrop" path={backdrop} alt="" fill sizes="(min-width: 1400px) 1400px, 100vw" className="object-cover opacity-25" />}
                            <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black via-black/75 to-black/20 p-[4%] rtl:bg-gradient-to-t">
                                <h3 className="font-display text-[clamp(26px,3.4vw,52px)] font-extrabold leading-[1] text-white">
                                    {source.ready && sourceName ? t('tvMode.player.ready', { source: sourceName }) : t('common.loading')}
                                </h3>
                                {!compact && (
                                    <ul className="mt-[3%] grid gap-2.5 text-[16px] text-white/75">
                                        <li className="flex items-center gap-3"><KeyGlyph k="ok" />{t('tvMode.player.tipOk')}</li>
                                        <li className="flex items-center gap-3"><KeyGlyph k="back" />{t('tvMode.player.tipBack')}</li>
                                        <li className="flex items-center gap-3"><KeyGlyph k="arrows" />{t('tvMode.player.tipArrows')}</li>
                                    </ul>
                                )}
                                <div className="mt-[3.5%] flex flex-wrap gap-3">
                                    <button
                                        ref={startRef}
                                        type="button"
                                        data-tv-autofocus={arrived ? '' : undefined}
                                        disabled={!url}
                                        onClick={start}
                                        className="inline-flex h-[3.2em] items-center gap-3 rounded-full bg-red-600 px-[1.6em] text-[17px] font-semibold text-white outline-none disabled:opacity-60"
                                    >
                                        <Play aria-hidden className="h-[1.1em] w-[1.1em] fill-current rtl:-scale-x-100" />
                                        {t('tvMode.player.start')}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => tabsRef.current?.querySelector<HTMLElement>('[aria-selected="true"], [role="tab"]')?.focus()}
                                        className="inline-flex h-[3.2em] items-center gap-3 rounded-full bg-white/[0.12] px-[1.4em] text-[17px] font-semibold text-white outline-none ring-1 ring-inset ring-white/15"
                                    >
                                        <Layers aria-hidden className="h-[1.1em] w-[1.1em]" />
                                        {t('tvMode.player.otherSources')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <>
                            {isLoading && (
                                <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center bg-black">
                                    <span className="h-11 w-11 animate-spin rounded-full border-2 border-white/15 border-t-red-500" />
                                </div>
                            )}
                            {url && (
                                <iframe
                                    ref={iframeRef}
                                    key={url}
                                    src={url}
                                    title={t('stream.player')}
                                    className="absolute inset-0 h-full w-full"
                                    referrerPolicy="origin"
                                    allowFullScreen
                                    allow={tv ? 'autoplay; fullscreen; encrypted-media; picture-in-picture' : undefined}
                                    onLoad={() => setIsLoading(false)}
                                />
                            )}
                            {playerOn && slow && isLoading && !menu && (
                                <div role="status" className="glass-strong absolute inset-x-[4%] top-[5%] z-20 mx-auto flex max-w-[40rem] flex-wrap items-center gap-x-5 gap-y-3 rounded-[20px] p-[1.1em]">
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[17px] font-semibold text-white">{t('tvMode.player.slow', { source: sourceName })}</p>
                                        <p className="mt-0.5 text-[14px] text-white/65">{t('tvMode.player.slowText')}</p>
                                    </div>
                                    <button type="button" onClick={notWorking} className="inline-flex h-[2.8em] items-center gap-2 rounded-full bg-white px-[1.2em] text-[15px] font-semibold text-black outline-none">
                                        <TriangleAlert aria-hidden className="h-4 w-4" />{t('stream.notWorking')}
                                    </button>
                                </div>
                            )}
                            {playerOn && hint && !menu && (
                                <p aria-live="polite" className="glass-strong pointer-events-none absolute bottom-[6%] start-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-full px-[1.2em] py-[0.6em] text-[16px] text-white rtl:translate-x-1/2">
                                    <KeyGlyph k="back" />{t('tvMode.player.hint')}
                                </p>
                            )}
                            {playerOn && menu && (
                                <div
                                    ref={menuRef}
                                    role="dialog"
                                    aria-modal="true"
                                    aria-label={t('tvMode.player.menu')}
                                    className="absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black via-black/85 to-transparent px-[4%] pb-[4%] pt-[10%]"
                                >
                                    <p className="mb-3 text-[14px] text-white/60">{t('tvMode.player.backAgain')}</p>
                                    {menu === 'sources' ? (
                                        <div className="flex flex-wrap gap-2.5">
                                            {source.ordered.map((item) => {
                                                const active = item.name === sourceName
                                                return (
                                                    <button
                                                        key={item.name}
                                                        type="button"
                                                        aria-pressed={active}
                                                        onClick={() => { select(item.name); setMenu(null); focusPlayer() }}
                                                        className={cn('inline-flex h-[2.9em] items-center gap-2 rounded-full px-[1.2em] text-[16px] font-semibold outline-none', active ? 'bg-white text-black' : 'bg-white/[0.12] text-white')}
                                                    >
                                                        {active && <Check aria-hidden className="h-4 w-4" />}
                                                        {item.name}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    ) : (
                                        <div className="flex flex-wrap gap-2.5">
                                            <button type="button" onClick={resume} className="inline-flex h-[2.9em] items-center gap-2 rounded-full bg-white px-[1.3em] text-[16px] font-semibold text-black outline-none">
                                                <Play aria-hidden className="h-4 w-4 fill-current rtl:-scale-x-100" />{t('tvMode.player.resume')}
                                            </button>
                                            {onNext && (
                                                <button type="button" onClick={() => { onNext(); setMenu(null); focusPlayer() }} className="inline-flex h-[2.9em] items-center gap-2 rounded-full bg-white/[0.12] px-[1.2em] text-[16px] font-semibold text-white outline-none">
                                                    <SkipForward aria-hidden className="h-4 w-4 rtl:-scale-x-100" />{nextLabel ?? t('detail.nextEpisode')}
                                                </button>
                                            )}
                                            <button type="button" onClick={() => setMenu('sources')} className="inline-flex h-[2.9em] items-center gap-2 rounded-full bg-white/[0.12] px-[1.2em] text-[16px] font-semibold text-white outline-none">
                                                <Layers aria-hidden className="h-4 w-4" />{t('tvMode.player.sources')}
                                            </button>
                                            <button type="button" onClick={() => { notWorking(); setMenu(null); focusPlayer() }} className="inline-flex h-[2.9em] items-center gap-2 rounded-full bg-white/[0.12] px-[1.2em] text-[16px] font-semibold text-white outline-none">
                                                <TriangleAlert aria-hidden className="h-4 w-4" />{t('stream.notWorking')}
                                            </button>
                                            <button type="button" onClick={leave} className="inline-flex h-[2.9em] items-center gap-2 rounded-full bg-white/[0.12] px-[1.2em] text-[16px] font-semibold text-white outline-none">
                                                <LogOut aria-hidden className="h-4 w-4 rtl:rotate-180" />{t('tvMode.player.leave')}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Controls: sources on the start side, the rest at the end. */}
                <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center">
                    <div ref={tabsRef} role="tablist" aria-label={t('stream.sourceAria')} className="no-scrollbar -mx-[var(--gutter)] flex min-w-0 flex-1 gap-1 overflow-x-auto overflow-y-hidden px-[var(--gutter)] md:mx-0 md:px-0">
                        <div className="flex shrink-0 gap-1 rounded-full bg-white/[0.06] p-1">
                            {source.ordered.map((item) => {
                                const active = source.ready && source.current?.name === item.name
                                const status = source.health[item.name]?.status
                                const remembered = item.name === source.remembered
                                return (
                                    <button
                                        key={item.name}
                                        type="button"
                                        role="tab"
                                        aria-selected={active}
                                        title={healthLabel(item.name)}
                                        onClick={() => select(item.name)}
                                        className={cn(
                                            'relative inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-red-500',
                                            active ? 'text-black' : 'text-white/70 hover:text-white',
                                            status === 'down' && !active && 'opacity-55',
                                        )}
                                    >
                                        {active && <m.span layoutId={`source-pill-${pillId}`} transition={spring.snappy} aria-hidden className="absolute inset-0 rounded-full bg-white" />}
                                        <span className="relative inline-flex items-center gap-1.5">
                                            {remembered
                                                ? <Check aria-hidden className={cn('h-3.5 w-3.5', active ? 'text-emerald-600' : 'text-emerald-400')} />
                                                : (status === 'good' || status === 'down') && <span aria-hidden className={cn('h-1.5 w-1.5 rounded-full', status === 'down' ? 'bg-amber-400' : 'bg-emerald-400')} />}
                                            {item.name}
                                        </span>
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {onNext && (
                            <Button variant="secondary" size="sm" onClick={onNext} className="h-9">
                                <SkipForward aria-hidden className="h-4 w-4 rtl:-scale-x-100" />{nextLabel ?? t('detail.nextEpisode')}
                            </Button>
                        )}
                        {/* Theater mode is for a room with other lights; a TV is already the screen. */}
                        {!tv && (
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setLightsOff((value) => !value)}
                                aria-pressed={lightsOff}
                                className="h-9"
                            >
                                {lightsOff ? <Lightbulb aria-hidden className="h-4 w-4" /> : <LightbulbOff aria-hidden className="h-4 w-4" />}
                                {lightsOff ? t('detail.exitTheater') : t('detail.theater')}
                            </Button>
                        )}
                        {downloadSlot}
                    </div>
                </div>

                <div className={cn('mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:items-start sm:justify-between', lightsOff && 'relative z-[61]')}>
                    <p className="max-w-[70ch] text-xs leading-relaxed text-white/40">{t('stream.note')}</p>
                    {enabled && source.ready && (
                        <button
                            type="button"
                            onClick={notWorking}
                            className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-full px-3 py-1.5 text-xs font-medium text-white/55 transition-colors hover:bg-white/[0.06] hover:text-white"
                        >
                            <TriangleAlert aria-hidden className="h-3.5 w-3.5" /> {t('stream.notWorking')}
                        </button>
                    )}
                </div>
            </div>
        </section>
    )
}
