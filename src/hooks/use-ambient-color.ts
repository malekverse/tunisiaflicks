"use client"
import { useEffect, useState, type CSSProperties } from 'react'
import { TMDB_IMAGE_BASE } from '@/src/lib/tmdb-image'
import { dominantColor } from '@/src/lib/ambient'

export { dominantColor }

// Ambient mode: the dominant vivid colour of a poster, as an "r g b" triplet for CSS
// (`rgb(var(--tf-ambient) / 0.4)`). Sampled from the tiny w92 poster, which TMDB serves with CORS.

const cache = new Map<string, string | null>()

const pending = new Map<string, Promise<string | null>>()

/**
 * The poster's ambient colour (cached per poster for the page's lifetime). Resolves to null when
 * the poster has no colour worth glowing or can't be read.
 */
export function loadAmbientColor(posterPath: string): Promise<string | null> {
    if (cache.has(posterPath)) return Promise.resolve(cache.get(posterPath)!)
    let promise = pending.get(posterPath)
    if (!promise) {
        promise = new Promise<string | null>((resolve) => {
            const img = new window.Image()
            img.crossOrigin = 'anonymous'
            img.decoding = 'async'
            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas')
                    canvas.width = 32
                    canvas.height = 48
                    const context = canvas.getContext('2d', { willReadFrequently: true })
                    if (!context) return resolve(null)
                    context.drawImage(img, 0, 0, canvas.width, canvas.height)
                    const found = dominantColor(context.getImageData(0, 0, canvas.width, canvas.height).data)
                    cache.set(posterPath, found)
                    resolve(found)
                } catch {
                    cache.set(posterPath, null) // tainted canvas or similar: just no ambience
                    resolve(null)
                }
            }
            img.onerror = () => resolve(null)
            // Own URL: the page may already have this poster cached from a plain (non-CORS) <img>,
            // and reusing that cached copy would taint the canvas.
            img.src = `${TMDB_IMAGE_BASE}/w92${posterPath}?ambient`
        })
        pending.set(posterPath, promise)
    }
    return promise
}

export function useAmbientColor(posterPath?: string | null) {
    const [color, setColor] = useState<string | null>(() => (posterPath ? cache.get(posterPath) ?? null : null))

    useEffect(() => {
        if (!posterPath) return setColor(null)
        let cancelled = false
        loadAmbientColor(posterPath).then((found) => { if (!cancelled) setColor(found) })
        return () => { cancelled = true }
    }, [posterPath])

    return color
}

/** Props for the element that scopes the ambient colour (the detail page wrapper). */
export const ambientStyle = (color: string | null) =>
    color ? { 'data-ambient': '', style: { '--tf-ambient': color } as CSSProperties } : {}
