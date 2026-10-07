"use client"
import React, { useEffect, useState } from 'react'
import { toast } from '@/src/hooks/use-toast'
import type { StreamProvider } from '@/src/lib/stream-providers'
import { useT } from '@/src/components/I18nProvider'

/**
 * Player with a source switcher and a download link. `enabled=false` shows `placeholder` instead
 * of the iframe (e.g. a TV show before an episode has been picked).
 *
 * Streams come from several third-party providers (see lib/stream-providers.ts) so the viewer can
 * switch when one is down. `downloadUrl` opens a direct-download page in a new tab.
 */
export default function StreamSection({ services, downloadSlot, enabled = true, placeholder }: {
    services: StreamProvider[]
    /** Rendered at the right of the source bar (the Download control). */
    downloadSlot?: React.ReactNode
    enabled?: boolean
    placeholder?: { title: string, description: string }
}) {
    const t = useT()
    const [current, setCurrent] = useState(0)
    const [isLoading, setIsLoading] = useState(true)
    // Re-selecting the first provider (index 0) whenever the list identity changes keeps the
    // player on a valid source if the services array shrinks.
    const url = services[current]?.url ?? services[0]?.url

    // A new source or episode means a new iframe load.
    useEffect(() => {
        setIsLoading(true)
    }, [url])

    const select = (index: number) => {
        if (!enabled) {
            toast({
                title: placeholder?.title ?? t('common.notReady'),
                description: placeholder?.description ?? '',
                variant: 'destructive',
                duration: 3000,
            })
            return
        }
        if (index === current) return
        setCurrent(index)
        toast({ title: t('stream.changed'), description: t('stream.nowUsing', { name: services[index].name }), duration: 3000 })
    }

    return (
        <section id="streamSection" className="w-full scroll-mt-20 px-0 md:px-10">
            <div className="flex items-center gap-2 py-1 px-2 bg-red-500 rounded-t-lg">
                <div className="flex gap-2 flex-wrap flex-1 min-w-0" role="tablist" aria-label={t('stream.sourceAria')}>
                    {services.map((item, index) => (
                        <button
                            key={item.name}
                            type="button"
                            role="tab"
                            aria-selected={current === index}
                            onClick={() => select(index)}
                            className={`px-2 py-1 rounded-md text-sm text-white transition-colors ${current === index ? 'bg-red-700' : 'bg-red-500 hover:bg-red-400'}`}
                        >
                            {item.name}
                        </button>
                    ))}
                </div>
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
                        <iframe
                            key={url}
                            src={url}
                            title={t('stream.player')}
                            className="absolute inset-0 w-full h-full"
                            referrerPolicy="origin"
                            allowFullScreen
                            onLoad={() => setIsLoading(false)}
                        />
                    </>
                )}
            </div>

            <p className="mt-2 px-2 md:px-0 text-xs text-gray-500">
                {t('stream.note')}
            </p>
        </section>
    )
}
