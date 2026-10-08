"use client"
import React, { useEffect, useId, useRef, useState } from 'react'
import { m } from 'framer-motion'
import { Check, Lightbulb, LightbulbOff, Play, SkipForward, TriangleAlert } from 'lucide-react'
import { toast } from '@/src/hooks/use-toast'
import type { StreamProvider } from '@/src/lib/stream-providers'
import { cn } from '@/src/lib/utils'
import { spring } from '@/src/lib/motion'
import { useT } from '@/src/components/I18nProvider'
import { useStreamSource } from '@/src/hooks/use-stream-source'
import TmdbImage from '@/src/components/TmdbImage'
import { Button } from '@/src/components/ui/button'

/**
 * The player: a framed 16:9 screen with an ambient glow in the poster's colour, the source
 * switcher under it, theater mode (everything else fades to black; Esc or a click outside brings
 * the lights back) and the download control. `enabled=false` shows the placeholder instead of the
 * iframe (a show before an episode is picked).
 *
 * Streams come from several third-party providers (lib/stream-providers.ts) so the viewer can switch
 * when one is down. The source that last played for this viewer is reopened, and sources other
 * viewers report as broken move to the end (crowd-sourced, see use-stream-source / lib/stream-health).
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
    const pillId = useId()
    const [isLoading, setIsLoading] = useState(true)
    const [lightsOff, setLightsOff] = useState(false)
    const sectionRef = useRef<HTMLElement>(null)
    const source = useStreamSource(services, { playing: enabled && !isLoading })
    const url = source.ready ? source.current?.url : undefined

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

                <div className="relative mx-auto aspect-video max-h-[80vh] w-full overflow-hidden rounded-[14px] bg-black shadow-[0_40px_100px_-30px_rgb(0_0_0/0.9)] ring-1 ring-white/10 md:rounded-[22px]">
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
                    ) : (
                        <>
                            {isLoading && (
                                <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center bg-black">
                                    <span className="h-11 w-11 animate-spin rounded-full border-2 border-white/15 border-t-red-500" />
                                </div>
                            )}
                            {url && (
                                <iframe
                                    key={url}
                                    src={url}
                                    title={t('stream.player')}
                                    className="absolute inset-0 h-full w-full"
                                    referrerPolicy="origin"
                                    allowFullScreen
                                    onLoad={() => setIsLoading(false)}
                                />
                            )}
                        </>
                    )}
                </div>

                {/* Controls: sources on the start side, the rest at the end. */}
                <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center">
                    <div role="tablist" aria-label={t('stream.sourceAria')} className="no-scrollbar -mx-[var(--gutter)] flex min-w-0 flex-1 gap-1 overflow-x-auto overflow-y-hidden px-[var(--gutter)] md:mx-0 md:px-0">
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
