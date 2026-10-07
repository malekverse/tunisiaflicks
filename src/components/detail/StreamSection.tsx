"use client"
import React, { useEffect, useRef, useState } from 'react'
import { FaLightbulb, FaRegLightbulb, FaTriangleExclamation } from 'react-icons/fa6'
import { toast } from '@/src/hooks/use-toast'
import type { StreamProvider } from '@/src/lib/stream-providers'
import { useT } from '@/src/components/I18nProvider'
import { useStreamSource } from '@/src/hooks/use-stream-source'

/**
 * Player with a source switcher and a download link. `enabled=false` shows `placeholder` instead
 * of the iframe (e.g. a TV show before an episode has been picked).
 *
 * Streams come from several third-party providers (see lib/stream-providers.ts) so the viewer can
 * switch when one is down. `downloadUrl` opens a direct-download page in a new tab. The source that
 * last played for this viewer is reopened, and sources other viewers report as broken move to the
 * end (crowd-sourced, see use-stream-source / lib/stream-health).
 *
 * Cinema touches: an ambient glow in the poster's colour (see use-ambient-color) and a
 * "lights off" mode that dims the rest of the page (Esc or a click outside turns them back on).
 */
export default function StreamSection({ services, downloadSlot, enabled = true, placeholder }: {
    services: StreamProvider[]
    /** Rendered at the right of the source bar (the Download control). */
    downloadSlot?: React.ReactNode
    enabled?: boolean
    placeholder?: { title: string, description: string }
}) {
    const t = useT()
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
            toast({
                title: placeholder?.title ?? t('common.notReady'),
                description: placeholder?.description ?? '',
                variant: 'destructive',
                duration: 3000,
            })
            return
        }
        if (name === source.current?.name) return
        source.select(name)
        toast({ title: t('stream.changed'), description: t('stream.nowUsing', { name }), duration: 3000 })
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
            // Above the navbar/sidebar (z-40/50) while the lights are off.
            className={`w-full scroll-mt-20 px-0 md:px-10 ${lightsOff ? 'relative z-[61]' : ''}`}
        >
            {lightsOff && (
                <div
                    aria-hidden
                    onClick={() => setLightsOff(false)}
                    className="fixed inset-0 z-[60] bg-black/95 animate-in fade-in duration-500"
                />
            )}
            <div className={`relative isolate ${lightsOff ? 'z-[61]' : ''}`}>
                {/* Ambient glow behind the player, tinted with the poster's colour. */}
                <div
                    aria-hidden
                    className="tf-ambient-glow pointer-events-none absolute inset-x-0 -inset-y-4 md:-inset-x-6 md:-inset-y-8 -z-10 rounded-[2rem] blur-3xl transition-[background] duration-700"
                    style={{ background: `rgb(var(--tf-ambient) / ${lightsOff ? 0.55 : 0.28})` }}
                />
                <div className="flex items-center gap-2 py-1 px-2 bg-red-500 rounded-t-lg">
                    <div className="flex gap-2 flex-wrap flex-1 min-w-0" role="tablist" aria-label={t('stream.sourceAria')}>
                        {source.ordered.map((item) => {
                            const active = source.ready && source.current?.name === item.name
                            const status = source.health[item.name]?.status
                            return (
                                <button
                                    key={item.name}
                                    type="button"
                                    role="tab"
                                    aria-selected={active}
                                    title={healthLabel(item.name)}
                                    onClick={() => select(item.name)}
                                    className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-sm text-white transition-colors ${active ? 'bg-red-700' : 'bg-red-500 hover:bg-red-400'} ${status === 'down' ? 'opacity-60' : ''}`}
                                >
                                    {(status === 'good' || status === 'down' || item.name === source.remembered) && (
                                        <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${status === 'down' ? 'bg-yellow-300' : 'bg-emerald-300'}`} />
                                    )}
                                    {item.name}
                                </button>
                            )
                        })}
                    </div>
                    <button
                        type="button"
                        onClick={() => setLightsOff((value) => !value)}
                        aria-pressed={lightsOff}
                        title={lightsOff ? t('stream.lightsOn') : t('stream.lightsOff')}
                        className="flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-sm text-white hover:bg-red-400"
                    >
                        {lightsOff ? <FaRegLightbulb /> : <FaLightbulb />}
                        <span className="hidden sm:inline">{lightsOff ? t('stream.lightsOn') : t('stream.lightsOff')}</span>
                    </button>
                    {downloadSlot}
                </div>

                <div className="relative w-full aspect-video max-h-[80vh] bg-gray-900">
                    {!enabled ? (
                        <div className="absolute inset-0 flex items-center justify-center text-center px-4">
                            <div>
                                <h3 className="text-xl font-semibold mb-2 text-white">{placeholder?.title}</h3>
                                <p className="text-gray-400">{placeholder?.description}</p>
                            </div>
                        </div>
                    ) : (
                        <>
                            {isLoading && (
                                <div className="absolute inset-0 flex items-center justify-center bg-gray-900/70 z-10 pointer-events-none">
                                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-500" />
                                </div>
                            )}
                            {url && <iframe
                                key={url}
                                src={url}
                                title={t('stream.player')}
                                className="absolute inset-0 w-full h-full"
                                referrerPolicy="origin"
                                allowFullScreen
                                onLoad={() => setIsLoading(false)}
                            />}
                        </>
                    )}
                </div>
            </div>

            <div className={`mt-2 px-2 md:px-0 flex flex-col-reverse gap-2 sm:flex-row sm:items-start sm:justify-between ${lightsOff ? 'relative z-[61]' : ''}`}>
                <p className="text-xs text-gray-500">{t('stream.note')}</p>
                {enabled && source.ready && (
                    <button
                        type="button"
                        onClick={notWorking}
                        className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-md px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 hover:text-red-500 dark:text-gray-400 dark:hover:bg-zinc-900"
                    >
                        <FaTriangleExclamation /> {t('stream.notWorking')}
                    </button>
                )}
            </div>
        </section>
    )
}
