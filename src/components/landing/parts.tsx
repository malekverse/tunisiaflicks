"use client"
// Small pieces the landing page's sections share: kinetic type, the hand-drawn art, pictures,
// the magnetic pull on the main buttons.
import { createContext, forwardRef, useContext, useEffect, useRef, useState, type RefObject } from 'react'
import { m, useInView, useMotionValue, useReducedMotion, useSpring } from 'framer-motion'
import { cn } from '@/src/lib/utils'
import { picUrl, type Pic } from '@/src/lib/landing-model'
import styles from './landing.module.css'

/**
 * A line of display type that arrives letter by letter (word by word in Arabic, whose letters
 * join). `delay` in ms; `settled` drops the entrance animation so the letters can react to the
 * pointer (see Hero). The text is read whole by screen readers.
 */
export const KineticText = forwardRef<HTMLSpanElement, {
  text: string
  arabic: boolean
  delay?: number
  settled?: boolean
  className?: string
}>(function KineticText({ text, arabic, delay = 0, settled = false, className }, ref) {
  const words = text.split(' ')
  let index = 0
  return (
    <span ref={ref} className={cn('block text-balance', className)}>
      <span className="sr-only">{text}</span>
      {words.map((word, w) => (
        <span key={w} aria-hidden className="inline-block whitespace-nowrap">
          {arabic ? (
            <span
              className={settled ? styles.settled : styles['word-ar']}
              data-glyph=""
              style={{ '--i': w, '--d': `${delay}ms` } as React.CSSProperties}
            >
              {word}
            </span>
          ) : (
            Array.from(word).map((char) => {
              const i = index++
              return (
                <span
                  key={i}
                  data-glyph=""
                  className={settled ? styles.settled : styles.glyph}
                  style={{ '--i': i, '--d': `${delay}ms` } as React.CSSProperties}
                >
                  {char}
                </span>
              )
            })
          )}
          {w < words.length - 1 && <span className="inline-block w-[0.22em]" />}
        </span>
      ))}
    </span>
  )
})

export type ArtName =
  | 'door' | 'jasmine' | 'lantern' | 'projector' | 'crescent'
  | 'circle' | 'squiggle' | 'arrow' | 'burst' | 'heart' | 'check' | 'star'

const ART_RATIO: Record<ArtName, number> = {
  door: 266 / 404, jasmine: 255 / 382, lantern: 165 / 409, projector: 1, crescent: 202 / 219,
  circle: 167 / 172, squiggle: 204 / 91, arrow: 166 / 186, burst: 184 / 185, heart: 157 / 168, check: 146 / 172, star: 167 / 173,
}

/**
 * One of the hand-drawn pieces (public/landing/art), as a mask: it takes the text colour, so the
 * same drawing can be white chalk, lantern gold or marker red. Decorative. Size it by height.
 */
export function Art({ name, className, style, draw = false, delay = 0 }: {
  name: ArtName
  className?: string
  style?: React.CSSProperties
  /** Drawn on, like a marker stroke. */
  draw?: boolean
  delay?: number
}) {
  const url = `url(/landing/art/${name}.webp)`
  return (
    <span
      aria-hidden
      className={cn('inline-block bg-current', draw && styles.draw, className)}
      style={{
        aspectRatio: String(ART_RATIO[name]),
        maskImage: url,
        WebkitMaskImage: url,
        maskSize: 'contain',
        WebkitMaskSize: 'contain',
        maskRepeat: 'no-repeat',
        WebkitMaskRepeat: 'no-repeat',
        maskPosition: 'center',
        WebkitMaskPosition: 'center',
        ...(draw ? { '--d': `${delay}ms` } : {}),
        ...style,
      } as React.CSSProperties}
    />
  )
}

/**
 * Pictures under it wait (an empty frame, no request) while this is true. The pinned sections
 * further down the page hold theirs until the visitor nears them, so they don't compete with the
 * first screen; their pictures are eager once released (they sit in clipped, transformed tracks
 * where the browser's own lazy loading would never start them).
 */
const HoldPictures = createContext(false)

/** Holds the pictures inside until `section` is within half a screen of the viewport. */
export function PicturesWhenNear({ section, children }: { section: RefObject<Element>, children: React.ReactNode }) {
  const near = useInView(section, { once: true, margin: '50% 0px 50% 0px' })
  return <HoldPictures.Provider value={!near}>{children}</HoldPictures.Provider>
}

/**
 * A poster (or cover, or thumbnail) as a plain image: decorative unless given `alt`. TMDB pictures
 * are always fetched with CORS: the hero's 3D wall draws the same files into a canvas, and a copy
 * cached without CORS would taint it (TMDB's CDN doesn't vary on Origin).
 */
export function PicImg({ pic, width, className, alt = '', eager = false, priority = false }: {
  pic: Pic
  width: number
  className?: string
  alt?: string
  eager?: boolean
  /** Fetched before the page's other pictures (the first screen). */
  priority?: boolean
}) {
  const [failed, setFailed] = useState(false)
  const hold = useContext(HoldPictures)
  if (failed || hold) return <span aria-hidden className={cn('block bg-white/[0.04]', className)} />
  return (
    // eslint-disable-next-line @next/next/no-img-element -- TMDB's CDN sizes these itself (see lib/tmdb-image)
    <img
      src={picUrl(pic, width)}
      alt={alt}
      crossOrigin={pic.tmdb ? 'anonymous' : undefined}
      loading={eager || priority ? 'eager' : 'lazy'}
      // Lowercase: React 18 passes it to the DOM as is.
      {...(priority ? { fetchpriority: 'high' } : {})}
      decoding="async"
      draggable={false}
      onError={() => setFailed(true)}
      className={cn('block bg-white/[0.04] object-cover', className)}
    />
  )
}

/**
 * The visitor asked for less motion. False until hydrated: the server can't know, and the first
 * render in the browser has to match its HTML (the calm layouts swap in right after).
 */
export function useCalm() {
  const reduced = useReducedMotion()
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])
  return hydrated && reduced === true
}

/** True on touch-first devices (no hover): reactions that need a pointer stay off there. */
export function useFinePointer() {
  const [fine, setFine] = useState(false)
  useEffect(() => {
    const query = window.matchMedia('(hover: hover) and (pointer: fine)')
    const update = () => setFine(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return fine
}

/** Leans towards the pointer when it comes near (a few pixels, on a spring). Mouse only. */
export function Magnetic({ children, strength = 0.22, className }: { children: React.ReactNode, strength?: number, className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const fine = useFinePointer()
  const reduced = useCalm()
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const sx = useSpring(x, { stiffness: 260, damping: 18, mass: 0.6 })
  const sy = useSpring(y, { stiffness: 260, damping: 18, mass: 0.6 })
  const on = fine && !reduced
  return (
    <m.div
      ref={ref}
      className={cn('inline-flex', className)}
      style={on ? { x: sx, y: sy } : undefined}
      onPointerMove={on ? (event) => {
        const box = ref.current!.getBoundingClientRect()
        x.set((event.clientX - (box.left + box.width / 2)) * strength)
        y.set((event.clientY - (box.top + box.height / 2)) * strength)
      } : undefined}
      onPointerLeave={on ? () => { x.set(0); y.set(0) } : undefined}
    >
      {children}
    </m.div>
  )
}

/** Tracks the pointer over an element as --x / --y (for the glass tiles' moving highlight). */
export function useSpotlight<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  useEffect(() => {
    const element = ref.current
    if (!element) return
    let frame = 0
    const onMove = (event: PointerEvent) => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        const box = element.getBoundingClientRect()
        element.style.setProperty('--x', `${event.clientX - box.left}px`)
        element.style.setProperty('--y', `${event.clientY - box.top}px`)
      })
    }
    element.addEventListener('pointermove', onMove)
    return () => {
      element.removeEventListener('pointermove', onMove)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])
  return ref
}
