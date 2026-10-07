"use client"
import React, { useEffect, useRef, useState } from 'react'
import Image, { type ImageLoader, type ImageProps } from 'next/image'
import { cn } from '@/src/lib/utils'
import { TMDB_IMAGE_BASE, tmdbImageUrl, type TmdbImageKind } from '@/src/lib/tmdb-image'

// One stable loader per kind: next/image builds the srcset from it, picking a TMDB size per width.
const loaders = Object.fromEntries(
    (['poster', 'backdrop', 'profile', 'logo', 'still'] as TmdbImageKind[]).map((kind) => [
        kind,
        (({ src, width }) => tmdbImageUrl(src, kind, width)) as ImageLoader,
    ])
) as Record<TmdbImageKind, ImageLoader>

type TmdbImageProps = Omit<ImageProps, 'src' | 'loader' | 'placeholder'> & {
    /** TMDB file path, e.g. "/abc.jpg". Missing or broken images show `fallback`. */
    path?: string | null
    kind: TmdbImageKind
    fallback?: string
    /** `fill` only: a tiny TMDB size (e.g. "w92") shown blurred right away, under the real image. */
    preview?: string
    /** `fill` only: animated placeholder until the image has loaded (on by default). */
    shimmer?: boolean
    /**
     * Called once the picture is displayable, including when it had already loaded before React
     * hydrated (where `onLoad` never fires).
     */
    onReady?: () => void
}

/**
 * Every TMDB picture on the site goes through this. It asks TMDB's CDN for the right size for
 * the screen (srcset + `sizes`), shows a shimmer (and optionally a blurred preview) while it loads,
 * then fades the image in. `priority` makes it load first (above-the-fold / LCP images).
 *
 * The fade only applies to images still loading after hydration, so a slow script never hides
 * a picture the browser has already drawn.
 */
export default function TmdbImage({
    path, kind, alt, fallback = '/404.png', preview, shimmer = true, fill, className, onLoad, onError, onReady, ...rest
}: TmdbImageProps) {
    const ref = useRef<HTMLImageElement>(null)
    const [state, setState] = useState<'initial' | 'loading' | 'loaded' | 'error'>('initial')
    const onReadyRef = useRef(onReady)
    onReadyRef.current = onReady

    // Native load/error listeners rather than next/image's onLoad: that one waits for img.decode(),
    // which browsers may postpone (background tabs), leaving a downloaded picture invisible.
    useEffect(() => {
        const img = ref.current
        // No <img> yet (showing the fallback): try the new path from scratch.
        if (!img) return setState('initial')
        const ready = () => {
            setState('loaded')
            onReadyRef.current?.()
        }
        const failed = () => setState('error')
        if (img.complete && img.naturalWidth > 0) ready()
        else if (img.complete && img.currentSrc) failed()
        else setState('loading')
        img.addEventListener('load', ready)
        img.addEventListener('error', failed)
        return () => {
            img.removeEventListener('load', ready)
            img.removeEventListener('error', failed)
        }
    }, [path])

    if (!path || state === 'error') {
        return <Image src={fallback} alt={alt} unoptimized fill={fill} className={className} {...rest} />
    }

    const pending = state !== 'loaded'
    return (
        <>
            {fill && shimmer && pending && <span aria-hidden className="tf-shimmer absolute inset-0" />}
            {fill && preview && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    aria-hidden
                    alt=""
                    src={`${TMDB_IMAGE_BASE}/${preview}${path}`}
                    decoding="async"
                    className="absolute inset-0 w-full h-full object-cover blur-xl scale-110"
                />
            )}
            <Image
                ref={ref}
                loader={loaders[kind]}
                src={path}
                alt={alt}
                fill={fill}
                className={cn('transition-opacity duration-500', state === 'loading' && 'opacity-0', className)}
                onLoad={onLoad}
                onError={onError}
                {...rest}
            />
        </>
    )
}
