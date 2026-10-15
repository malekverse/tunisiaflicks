"use client"
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Play } from 'lucide-react'
import { m, useMotionValueEvent, useScroll, useTransform } from 'framer-motion'
import { useI18n } from '@/src/components/I18nProvider'
import { BrandMark } from '@/src/components/brand/BrandMark'
import { Button } from '@/src/components/ui/button'
import { isArabicScript } from '@/src/lib/i18n/locales'
import { picUrl, type Pic } from '@/src/lib/landing-model'
import { cn } from '@/src/lib/utils'
import { KineticText, Magnetic, PicImg, useFinePointer, useCalm } from './parts'
import { LOOKS, useStageLook } from './Stage'
import type { HeroQuality, HeroScene } from './hero-scene'
import styles from './landing.module.css'

/** The hero's posters, flat and in 3D: one size, so the 3D wall reuses what the flat one loaded. */
const WALL_WIDTH = 185

/** What this device can draw: the 3D scene (and how finely), or the flat picture. */
function sceneQuality(): HeroQuality | null {
  try {
    // Data saver: the poster wall stays flat (three.js alone is ~150 KB). Not the browser's
    // connection estimate (effectiveType): it swings from 4g to slow-2g on the same line, and the
    // flat wall is on screen meanwhile anyway, so a slow 3D only means a later fade.
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
    if (connection?.saveData) return null
    const probe = document.createElement('canvas')
    const gl = probe.getContext('webgl2')
    if (!gl) return null
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    const cores = navigator.hardwareConcurrency ?? 4
    const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4
    if (cores <= 2 || memory <= 2) return null
    const coarse = window.matchMedia('(pointer: coarse)').matches
    return coarse || window.innerWidth < 900 || cores <= 4 ? 'low' : 'high'
  } catch {
    return null
  }
}

/**
 * The opening shot: the glass A in front of a curved wall of today's posters (hero-scene.ts),
 * pinned while the camera pushes in; the headline arrives letter by letter and its letters widen
 * under the pointer. Devices that can't draw it get the same composition flat.
 */
export default function Hero({ wall }: { wall: Pic[] }) {
  const { t, locale, dir } = useI18n()
  const arabic = isArabicScript(locale)
  const reduced = useCalm()
  const fine = useFinePointer()
  const section = useRef<HTMLElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const scene = useRef<HeroScene | null>(null)
  const headline = useRef<HTMLHeadingElement>(null)
  const [mode, setMode] = useState<'pending' | '3d' | 'flat'>('pending')
  const [shown, setShown] = useState(false)
  const [settled, setSettled] = useState(false)
  const [flatGone, setFlatGone] = useState(false)

  useStageLook(section, LOOKS.dark)

  const { scrollYProgress } = useScroll({ target: section, offset: ['start start', 'end end'] })
  const copyOpacity = useTransform(scrollYProgress, [0.12, 0.55], [1, 0])
  const copyY = useTransform(scrollYProgress, [0, 0.6], [0, -90])
  const copyBlur = useTransform(scrollYProgress, [0.12, 0.55], ['blur(0px)', 'blur(10px)'])
  const veil = useTransform(scrollYProgress, [0.55, 1], [0, 1])

  // The scene: loaded only here, only on a capable device.
  useEffect(() => {
    const quality = sceneQuality()
    if (!quality || !canvas.current || wall.length < 8) {
      setMode('flat')
      return
    }
    let cancelled = false
    let created: HeroScene | null = null
    import('./hero-scene')
      .then(({ createHeroScene }) => {
        if (cancelled || !canvas.current) return
        created = createHeroScene(canvas.current, {
          // The flat wall's own pictures (same size, fetched with CORS): mostly from the cache.
          posters: wall.map((pic) => picUrl(pic, WALL_WIDTH)),
          quality,
          // Read here, not from the hook: this runs once, right at hydration.
          still: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
          rtl: dir === 'rtl',
        })
        scene.current = created
        created.setProgress(scrollYProgress.get())
        created.setActive(true)
        setMode('3d')
        created.ready.then(() => { if (!cancelled) setShown(true) })
      })
      .catch(() => { if (!cancelled) setMode('flat') })
    return () => {
      cancelled = true
      created?.dispose()
      scene.current = null
    }
    // The scene is built once per visit; motion preference and direction rarely change mid-visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (mode === 'flat') setShown(true)
    // Once the scene has faded in over it, the flat wall leaves the page (one layer less to paint).
    if (mode !== '3d' || !shown) return
    const timer = window.setTimeout(() => setFlatGone(true), 1800)
    return () => window.clearTimeout(timer)
  }, [mode, shown])

  useMotionValueEvent(scrollYProgress, 'change', (value) => scene.current?.setProgress(value))

  // Draw only while the hero is on screen and the tab is visible.
  useEffect(() => {
    if (mode !== '3d' || !section.current) return
    let visible = true
    let onScreen = true
    const update = () => scene.current?.setActive(visible && onScreen)
    const observer = new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; update() })
    observer.observe(section.current)
    const onVisibility = () => { visible = document.visibilityState === 'visible'; update() }
    document.addEventListener('visibilitychange', onVisibility)
    const onResize = () => scene.current?.resize()
    window.addEventListener('resize', onResize)
    return () => {
      observer.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('resize', onResize)
    }
  }, [mode])

  // The pointer is the projector's beam; over the headline it also widens the letters near it.
  useEffect(() => {
    const element = stage.current
    if (!element) return
    let frame = 0
    let lastEvent: PointerEvent | null = null
    const apply = () => {
      frame = 0
      const event = lastEvent
      if (!event) return
      const box = element.getBoundingClientRect()
      const x = ((event.clientX - box.left) / box.width) * 2 - 1
      const y = -(((event.clientY - box.top) / box.height) * 2 - 1)
      scene.current?.setPointer(x, y)
      if (!settled || reduced || !fine || !headline.current) return
      const glyphs = headline.current.querySelectorAll<HTMLElement>('[data-glyph]')
      const centres = Array.from(glyphs, (glyph) => {
        const rect = glyph.getBoundingClientRect()
        return Math.hypot(rect.left + rect.width / 2 - event.clientX, rect.top + rect.height / 2 - event.clientY)
      })
      glyphs.forEach((glyph, index) => {
        const near = Math.max(0, 1 - centres[index] / 170)
        const ease = near * near * (3 - 2 * near)
        if (arabic) glyph.style.setProperty('--w', String(Math.round(800 - ease * 450)))
        else {
          glyph.style.setProperty('--s', `${Math.round(80 + ease * 20)}%`)
          glyph.style.setProperty('--w', String(Math.round(800 - ease * 380)))
        }
      })
    }
    const onMove = (event: PointerEvent) => {
      lastEvent = event
      if (!frame) frame = requestAnimationFrame(apply)
    }
    const onLeave = () => {
      headline.current?.querySelectorAll<HTMLElement>('[data-glyph]').forEach((glyph) => {
        glyph.style.removeProperty('--s')
        glyph.style.removeProperty('--w')
      })
    }
    element.addEventListener('pointermove', onMove)
    element.addEventListener('pointerleave', onLeave)
    return () => {
      element.removeEventListener('pointermove', onMove)
      element.removeEventListener('pointerleave', onLeave)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [settled, reduced, fine, arabic])

  // The entrance ends; from then on the letters can react.
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(true), 2600)
    return () => window.clearTimeout(timer)
  }, [])

  const lines = [t('landing.hero.line1'), t('landing.hero.line2'), t('landing.hero.line3')]

  return (
    <section ref={section} aria-labelledby="landing-hero-title" className={cn('relative', reduced ? 'h-[100svh]' : 'h-[190svh]')}>
      <div ref={stage} className="sticky top-0 h-[100svh] overflow-hidden">
        {/* The flat wall is in the page's HTML, so the room has its posters at once; the 3D
            scene fades in over it when it's ready (or never, where it can't run). */}
        {!flatGone && (
          <div
            aria-hidden
            data-hero-picture=""
            className={cn('absolute inset-0 transition-opacity duration-[1400ms] ease-out', mode === '3d' && shown ? 'opacity-0' : 'opacity-100')}
          >
            <FlatWall wall={wall} />
          </div>
        )}

        <canvas
          ref={canvas}
          role="img"
          aria-label={t('landing.hero.scene')}
          className={cn('absolute inset-0 h-full w-full transition-opacity duration-[1400ms] ease-out', mode === '3d' && shown ? 'opacity-100' : 'opacity-0')}
        />

        {/* The room's shadows: the headline always reads, the bars stay legible. */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[62%] bg-gradient-to-t from-black via-black/70 to-transparent" />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/80 to-transparent" />
        <div aria-hidden className="pointer-events-none absolute inset-y-0 start-0 hidden w-[62%] bg-gradient-to-r from-black/85 via-black/45 to-transparent rtl:bg-gradient-to-l sm:block" />
        <m.div aria-hidden className="pointer-events-none absolute inset-0 bg-black" style={{ opacity: reduced ? 0 : veil }} />

        <m.div
          className="page-x absolute inset-x-0 bottom-0 pb-[max(56px,calc(env(safe-area-inset-bottom)+11svh))] lg:pb-[12svh]"
          style={reduced ? undefined : { opacity: copyOpacity, y: copyY, filter: copyBlur }}
        >
          <h1
                id="landing-hero-title"
                ref={headline}
                className={cn(
                  'max-w-[16ch] font-display font-extrabold text-white [text-shadow:0_2px_40px_rgb(0_0_0/0.6)]',
                  // Size before leading: tailwind-merge drops a leading set before a text size.
                  arabic ? 'text-[clamp(40px,min(7.4vw,11svh),104px)] leading-[1.12]' : 'text-[clamp(48px,min(8.6vw,12.5svh),140px)] leading-[0.86]',
                )}
              >
                {lines.map((line, index) => (
                  <KineticText key={index} text={line} arabic={arabic} delay={350 + index * 260} settled={settled} />
                ))}
              </h1>
              <p className={cn('mt-6 max-w-[56ch] text-pretty text-[15px] leading-relaxed text-white/75 sm:text-[17px]', styles['fade-up'])} style={{ '--d': '1300ms' } as React.CSSProperties}>
                {t('landing.hero.text')}
              </p>
              <div className={cn('mt-8 flex flex-wrap items-center gap-3', styles['fade-up'])} style={{ '--d': '1500ms' } as React.CSSProperties}>
                <Magnetic>
                  <Button asChild size="lg" className="h-[52px] px-8 text-[16px]">
                    <Link href="/"><Play aria-hidden className="h-[18px] w-[18px] fill-current" />{t('landing.hero.start')}</Link>
                  </Button>
                </Magnetic>
                <Button asChild size="lg" variant="secondary" className="h-[52px] px-7 text-[16px]">
                  <a href="#tour">{t('landing.hero.tour')}</a>
                </Button>
              </div>
        </m.div>

        {/* Scroll cue: a strip of film running down. */}
        {!reduced && (
          <m.div aria-hidden className="absolute bottom-6 end-[max(var(--gutter),16px)] hidden h-14 w-[3px] overflow-hidden rounded-full sm:block" style={{ opacity: copyOpacity }}>
            <div className={cn('h-full w-full', styles.film)} />
          </m.div>
        )}
      </div>
    </section>
  )
}

/** The hero without WebGL: a tilted wall of posters in the dark, the mark glowing in front. */
function FlatWall({ wall }: { wall: Pic[] }) {
  return (
    <div className="absolute inset-0 overflow-hidden [perspective:1200px]">
      <div className="absolute inset-[-20%] grid grid-cols-6 gap-3 opacity-45 [transform:rotateY(-18deg)_rotateX(8deg)_scale(1.05)] sm:grid-cols-8 lg:grid-cols-10">
        {wall.slice(0, 40).map((pic, index) => (
          // The first rows are what's on screen: asked for first.
          <PicImg key={index} pic={pic} width={WALL_WIDTH} eager priority={index < 20} className="aspect-[2/3] w-full rounded-poster" />
        ))}
      </div>
      <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_60%_40%,transparent,black_80%)]" />
      <div className="absolute inset-x-0 top-[18%] flex justify-center lg:justify-end lg:pe-[18%]">
        <BrandMark className={cn('h-[28vmin] w-auto', styles['exit-sign'])} />
      </div>
    </div>
  )
}
