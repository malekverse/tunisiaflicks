"use client"
import { useEffect, useState, type CSSProperties } from 'react'
import { TMDB_IMAGE_BASE } from '@/src/lib/tmdb-image'

// Ambient mode: the dominant vivid colour of a poster, as an "r g b" triplet for CSS
// (`rgb(var(--tf-ambient) / 0.4)`). Sampled from the tiny w92 poster, which TMDB serves with CORS.

const cache = new Map<string, string | null>()

function rgbToHsl(r: number, g: number, b: number) {
    r /= 255; g /= 255; b /= 255
    const max = Math.max(r, g, b), min = Math.min(r, g, b)
    const l = (max + min) / 2
    if (max === min) return [0, 0, l]
    const d = max - min
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
    return [h / 6, s, l]
}

function hslToRgb(h: number, s: number, l: number) {
    const hue = (p: number, q: number, t: number) => {
        if (t < 0) t += 1
        if (t > 1) t -= 1
        if (t < 1 / 6) return p + (q - p) * 6 * t
        if (t < 1 / 2) return q
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
        return p
    }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    return [hue(p, q, h + 1 / 3), hue(p, q, h), hue(p, q, h - 1 / 3)].map((value) => Math.round(value * 255))
}

/** Most "present" hue (frequency × saturation), ignoring near-black/white, lifted so it glows. */
export function dominantColor(pixels: Uint8ClampedArray): string | null {
    const buckets = Array.from({ length: 24 }, () => ({ weight: 0, r: 0, g: 0, b: 0, n: 0 }))
    for (let i = 0; i < pixels.length; i += 4) {
        const [r, g, b] = [pixels[i], pixels[i + 1], pixels[i + 2]]
        const [h, s, l] = rgbToHsl(r, g, b)
        if (l < 0.1 || l > 0.92 || s < 0.15) continue
        const bucket = buckets[Math.min(23, Math.floor(h * 24))]
        bucket.weight += s * (1 - Math.abs(l - 0.5))
        bucket.r += r; bucket.g += g; bucket.b += b; bucket.n++
    }
    const best = buckets.reduce((top, bucket) => (bucket.weight > top.weight ? bucket : top))
    // A mostly grey/black poster has no colour worth glowing.
    if (best.n < pixels.length / 4 / 40) return null
    const [h, s, l] = rgbToHsl(best.r / best.n, best.g / best.n, best.b / best.n)
    const [r, g, b] = hslToRgb(h, Math.max(s, 0.5), Math.min(0.58, Math.max(0.42, l)))
    return `${r} ${g} ${b}`
}

export function useAmbientColor(posterPath?: string | null) {
    const [color, setColor] = useState<string | null>(() => (posterPath ? cache.get(posterPath) ?? null : null))

    useEffect(() => {
        if (!posterPath) return setColor(null)
        if (cache.has(posterPath)) return setColor(cache.get(posterPath)!)
        let cancelled = false
        const img = new window.Image()
        img.crossOrigin = 'anonymous'
        img.decoding = 'async'
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas')
                canvas.width = 32
                canvas.height = 48
                const context = canvas.getContext('2d', { willReadFrequently: true })
                if (!context) return
                context.drawImage(img, 0, 0, canvas.width, canvas.height)
                const found = dominantColor(context.getImageData(0, 0, canvas.width, canvas.height).data)
                cache.set(posterPath, found)
                if (!cancelled) setColor(found)
            } catch {
                cache.set(posterPath, null) // tainted canvas or similar: just no ambience
            }
        }
        // Own URL: the page may already have this poster cached from a plain (non-CORS) <img>,
        // and reusing that cached copy would taint the canvas.
        img.src = `${TMDB_IMAGE_BASE}/w92${posterPath}?ambient`
        return () => { cancelled = true }
    }, [posterPath])

    return color
}

/** Props for the element that scopes the ambient colour (the detail page wrapper). */
export const ambientStyle = (color: string | null) =>
    color ? { 'data-ambient': '', style: { '--tf-ambient': color } as CSSProperties } : {}
