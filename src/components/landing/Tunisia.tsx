"use client"
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import Link from 'next/link'
import NumberFlow from '@number-flow/react'
import { ChevronRight } from 'lucide-react'
import { m, useInView, useMotionValueEvent, useScroll, useTransform, type MotionValue } from 'framer-motion'
import { useI18n } from '@/src/components/I18nProvider'
import { isArabicScript } from '@/src/lib/i18n/locales'
import type { LandingData, Pic } from '@/src/lib/landing-model'
import type { TKey } from '@/src/lib/i18n'
import { cn } from '@/src/lib/utils'
import LiveDot from '@/src/components/ui/live-dot'
import { Art, PicImg, type ArtName, useCalm } from './parts'
import { LOOKS, useStageLook } from './Stage'

type Tunisia = LandingData['tunisia']
type PanelId = 'intro' | 'series' | 'tv' | 'cinema' | 'ramadan' | 'arab'

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

/**
 * Made in Tunisia: the page turns Sidi Bou Said blue and scrolls sideways through what only
 * TunisiaFlicks has (Tunisian series, TV and cinema, Ramadan, the Arab cinema map). Vertical
 * scrolling drives the track; inside each panel the pictures and the drawings move at their own
 * pace. Ramadan lights the room lantern gold.
 */
export default function TunisiaTrack({ data }: { data: Tunisia }) {
  const reduced = useCalm()
  const section = useRef<HTMLElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const [distance, setDistance] = useState(0)
  const [active, setActive] = useState<PanelId>('intro')

  const panels: PanelId[] = [
    'intro',
    ...(data.series.length >= 3 ? ['series' as const] : []),
    ...(data.tv.length >= 2 ? ['tv' as const] : []),
    ...(data.cinema.length >= 3 ? ['cinema' as const] : []),
    'ramadan',
    'arab',
  ]

  const { scrollYProgress } = useScroll({ target: section, offset: ['start start', 'end end'] })
  const x = useTransform(scrollYProgress, (value) => value * distance)

  useIsomorphicLayoutEffect(() => {
    const element = track.current
    if (!element || reduced) return
    const measure = () => {
      const rtl = getComputedStyle(element).direction === 'rtl'
      const span = Math.max(0, element.scrollWidth - element.clientWidth)
      setDistance(rtl ? span : -span)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [reduced, panels.length])

  useMotionValueEvent(scrollYProgress, 'change', (value) => {
    const index = Math.round(value * (panels.length - 1))
    setActive(panels[Math.max(0, Math.min(panels.length - 1, index))])
  })
  useStageLook(section, active === 'ramadan' ? LOOKS.ramadan : LOOKS.tunisia)

  const content = panels.map((id, index) => (
    <Panel key={id} id={id} data={data} index={index} count={panels.length} progress={scrollYProgress} still={reduced} />
  ))

  if (reduced) {
    return (
      <section ref={section} aria-labelledby="landing-tn-title" className="page-x space-y-6 py-24">
        {content}
      </section>
    )
  }

  return (
    <section ref={section} aria-labelledby="landing-tn-title" className="relative" style={{ height: `${(panels.length - 1) * 70 + 100}svh` }}>
      <div className="sticky top-0 flex h-[100svh] items-center overflow-hidden">
        <m.div
          ref={track}
          className="flex w-full items-stretch gap-[4vw] ps-[calc(var(--rail)+var(--gutter))] pe-[var(--gutter)]"
          style={{ x }}
        >
          {content}
          <div aria-hidden className="w-[2vw] shrink-0" />
        </m.div>
        {/* Progress along the track. */}
        <div aria-hidden className="absolute inset-x-0 bottom-[max(20px,5svh)] flex justify-center ps-[var(--rail)]">
          <div className="h-[3px] w-40 overflow-hidden rounded-full bg-white/15">
            <m.div className="h-full origin-left rounded-full bg-white/80 rtl:origin-right" style={{ scaleX: scrollYProgress }} />
          </div>
        </div>
      </div>
    </section>
  )
}

/** A panel's own time: 0 when the track brings it to the start, ±1 a panel away. */
function usePanelProgress(progress: MotionValue<number>, index: number, count: number) {
  return useTransform(progress, (value) => value * (count - 1) - index)
}

const PANEL = 'relative flex min-h-[74svh] w-[86vw] shrink-0 flex-col justify-end overflow-hidden rounded-stage p-6 sm:w-[78vw] sm:p-10 lg:w-[min(64vw,1080px)] lg:flex-row lg:items-end lg:justify-between lg:gap-10 lg:p-14'

function Panel({ id, data, index, count, progress, still }: { id: PanelId, data: Tunisia, index: number, count: number, progress: MotionValue<number>, still: boolean }) {
  const local = usePanelProgress(progress, index, count)
  // Drawings drift slower than the track, pictures a little faster: depth without a 3D engine.
  const artX = useTransform(local, [-1, 1], still ? ['0%', '0%'] : ['18%', '-18%'])
  const picX = useTransform(local, [-1, 1], still ? ['0%', '0%'] : ['-6%', '6%'])
  const spread = useTransform(local, [-1, 0, 1], still ? [1, 1, 1] : [0, 1, 0.6])

  switch (id) {
    case 'intro':
      return <IntroPanel artX={artX} />
    case 'series':
      return (
        <PanelFrame title="landing.tn.series.title" text="landing.tn.series.text" cta="landing.tn.series.cta" href="/tunisian" art="jasmine" artX={artX} tint="from-[#0b2a6b]/80">
          <Fan pics={data.series} spread={spread} x={picX} />
        </PanelFrame>
      )
    case 'tv':
      return (
        <PanelFrame title="landing.tn.tv.title" text="landing.tn.tv.text" cta="landing.tn.tv.cta" href="/tunisian/tv" art="projector" artX={artX} tint="from-[#0a2259]/80">
          <TvWall pics={data.tv} live={data.live} x={picX} />
        </PanelFrame>
      )
    case 'cinema':
      return (
        <PanelFrame title="landing.tn.cinema.title" text="landing.tn.cinema.text" cta="landing.tn.cinema.cta" href="/tunisian/cinema" art="door" artX={artX} tint="from-[#071c4d]/80">
          <FilmStrip pics={data.cinema} x={picX} />
        </PanelFrame>
      )
    case 'ramadan':
      return <RamadanPanel data={data} artX={artX} picX={picX} />
    case 'arab':
      return (
        <PanelFrame title="landing.tn.arab.title" text="landing.tn.arab.text" cta="landing.tn.arab.cta" href="/arab-cinema" art="crescent" artX={artX} tint="from-[#2a1d10]/80">
          <TileMap countries={data.countries} />
        </PanelFrame>
      )
  }
}

function IntroPanel({ artX }: { artX: MotionValue<string> }) {
  const { t, locale } = useI18n()
  const arabic = isArabicScript(locale)
  return (
    <div className={cn(PANEL, 'bg-transparent p-0 sm:p-0 lg:w-[min(84vw,1320px)] lg:items-center lg:p-0')}>
      <div className="relative z-10 lg:max-w-[52%]">
        <h2 id="landing-tn-title" className={cn('max-w-[12ch] font-display font-extrabold text-white', arabic ? 'text-[clamp(52px,7vw,120px)] leading-[1.1]' : 'text-[clamp(60px,8.4vw,150px)] leading-[0.86]')}>
          {t('landing.tn.heading')}
        </h2>
        <p className="mt-6 max-w-[42ch] text-pretty text-[16px] leading-relaxed text-white/75 sm:text-[19px]">{t('landing.tn.text')}</p>
      </div>
      <m.div aria-hidden className="pointer-events-none absolute -end-[4%] top-[6%] flex items-end gap-[3vw] text-white/85 lg:static lg:me-[1vw] lg:shrink-0" style={{ x: artX }}>
        <Art name="door" className="h-[34svh] lg:h-[52svh]" />
        <Art name="jasmine" className="hidden h-[26svh] text-white/60 sm:block lg:h-[36svh]" />
      </m.div>
    </div>
  )
}

function PanelFrame({ title, text, cta, href, art, artX, tint, children }: {
  title: TKey
  text: TKey
  cta: TKey
  href: string
  art: ArtName
  artX: MotionValue<string>
  tint: string
  children: React.ReactNode
}) {
  const { t } = useI18n()
  return (
    <article className={cn(PANEL, 'bg-gradient-to-b to-white/[0.02] ring-1 ring-inset ring-white/[0.08]', tint)}>
      <m.div aria-hidden className="pointer-events-none absolute end-[4%] top-[5%] text-white/[0.13]" style={{ x: artX }}>
        <Art name={art} className="h-[30svh] lg:h-[44svh]" />
      </m.div>
      <div className="relative z-10 order-2 mt-8 max-w-[38ch] lg:order-1 lg:mt-0">
        <h3 className="font-display text-[clamp(34px,4.4vw,64px)] font-extrabold leading-[0.95] text-white">{t(title)}</h3>
        <p className="mt-4 text-pretty text-[15px] leading-relaxed text-white/75 sm:text-[17px]">{t(text)}</p>
        <Link href={href} className="mt-6 inline-flex h-11 items-center gap-1.5 rounded-full bg-white pe-4 ps-5 text-[14px] font-semibold text-black transition-[transform,background-color] hover:bg-white/85 active:scale-[0.97]">
          {t(cta)}
          <ChevronRight aria-hidden className="h-4 w-4 rtl:rotate-180" />
        </Link>
      </div>
      <div className="relative z-10 order-1 flex flex-1 items-center justify-center lg:order-2 lg:self-center">{children}</div>
    </article>
  )
}

/** Posters fanned like a hand of cards; they open as the panel arrives. */
function Fan({ pics, spread, x }: { pics: Pic[], spread: MotionValue<number>, x: MotionValue<string> }) {
  const shown = pics.slice(0, 5)
  return (
    <m.div className="relative h-[34svh] w-full max-w-[560px] lg:h-[50svh]" style={{ x }}>
      {shown.map((pic, index) => (
        <FanCard key={index} pic={pic} index={index} count={shown.length} spread={spread} />
      ))}
    </m.div>
  )
}

function FanCard({ pic, index, count, spread }: { pic: Pic, index: number, count: number, spread: MotionValue<number> }) {
  const offset = index - (count - 1) / 2
  const rotate = useTransform(spread, (value) => offset * 9 * value)
  const x = useTransform(spread, (value) => `${offset * 36 * value}%`)
  const y = useTransform(spread, (value) => `${Math.abs(offset) * 7 * value}%`)
  return (
    <m.div
      className="absolute bottom-0 left-[30%] w-[40%] origin-bottom overflow-hidden rounded-poster shadow-[0_30px_60px_-20px_rgb(0_0_0/0.8)] ring-1 ring-white/10"
      style={{ rotate, x, y, zIndex: 10 - Math.abs(Math.round(offset)) }}
    >
      <PicImg pic={pic} width={342} eager className="aspect-[2/3] w-full" alt="" />
    </m.div>
  )
}

function TvWall({ pics, live, x }: { pics: Pic[], live: boolean, x: MotionValue<string> }) {
  const { t } = useI18n()
  return (
    <m.div className="grid w-full max-w-[520px] grid-cols-2 gap-2.5" style={{ x }}>
      {pics.slice(0, 4).map((pic, index) => (
        <div key={index} className="relative overflow-hidden rounded-tile ring-1 ring-white/10">
          <PicImg pic={pic} width={320} eager className="aspect-video w-full" />
          {index === 0 && live && (
            <span aria-hidden className="absolute start-2.5 top-2.5 inline-flex items-center gap-1.5 rounded-full bg-black/70 px-2.5 py-1 text-[12px] font-semibold text-white backdrop-blur">
              <LiveDot label="" />
              {t('landing.tn.tv.live')}
            </span>
          )}
        </div>
      ))}
    </m.div>
  )
}

/** A strip of 35mm film, sprocket holes and all, with the posters as frames. */
function FilmStrip({ pics, x }: { pics: Pic[], x: MotionValue<string> }) {
  const holes = 'repeating-linear-gradient(90deg, transparent 0 10px, rgb(255 255 255 / 0.8) 10px 22px, transparent 22px 32px)'
  return (
    <m.div className="w-full max-w-[560px] -rotate-3 rounded-[6px] bg-[#0b0b0b] py-3 shadow-[0_40px_80px_-30px_rgb(0_0_0/0.9)] ring-1 ring-white/10 rtl:rotate-3" style={{ x }}>
      <div aria-hidden className="mx-2 h-2.5 rounded-[2px] opacity-70" style={{ backgroundImage: holes, maskImage: 'linear-gradient(#000,#000)' }} />
      <div className="my-2.5 flex gap-2 overflow-hidden px-2">
        {pics.slice(0, 4).map((pic, index) => (
          <PicImg key={index} pic={pic} width={185} eager className="aspect-[2/3] w-1/4 shrink-0 rounded-[3px] sepia-[0.25]" />
        ))}
      </div>
      <div aria-hidden className="mx-2 h-2.5 rounded-[2px] opacity-70" style={{ backgroundImage: holes }} />
    </m.div>
  )
}

function RamadanPanel({ data, artX, picX }: { data: Tunisia, artX: MotionValue<string>, picX: MotionValue<string> }) {
  const { t, locale } = useI18n()
  const ref = useRef<HTMLDivElement>(null)
  const seen = useInView(ref, { once: true, amount: 0.5 })
  const countdown = data.countdown
  return (
    <article className={cn(PANEL, 'bg-gradient-to-b from-[#3a2606]/70 to-white/[0.02] ring-1 ring-inset ring-[#f5be50]/20')}>
      <m.div aria-hidden className="pointer-events-none absolute end-[6%] top-[4%] text-[#f5be50]/80 drop-shadow-[0_0_40px_rgb(245_190_80/0.45)]" style={{ x: artX }}>
        <Art name="lantern" className="h-[36svh] lg:h-[52svh]" />
      </m.div>
      <div className="relative z-10 order-2 mt-6 max-w-[40ch] lg:order-1 lg:mt-0">
        <div ref={ref} className="flex flex-col">
          {countdown.phase === 'before' ? (
            <>
              <NumberFlow
                // Counts down into place as the panel arrives.
                value={seen ? countdown.days : countdown.days + 60}
                locales={locale === 'en' ? 'en-GB' : locale === 'fr' ? 'fr-FR' : 'ar-TN-u-nu-latn'}
                className="font-display text-[clamp(72px,10vw,160px)] font-extrabold leading-[0.85] text-[#f5be50] tabular-nums"
              />
              <span className="mt-2 text-[15px] text-white/75">{t('landing.tn.ramadan.until', { year: countdown.year })}</span>
            </>
          ) : (
            <span className="font-display text-[clamp(40px,5vw,72px)] font-extrabold leading-[0.95] text-[#f5be50]">
              {t('landing.tn.ramadan.day', { day: countdown.day, year: countdown.year })}
            </span>
          )}
        </div>
        <h3 className="mt-8 font-display text-[clamp(30px,3.6vw,52px)] font-extrabold leading-[0.95] text-white">{t('landing.tn.ramadan.title')}</h3>
        <p className="mt-3 text-pretty text-[15px] leading-relaxed text-white/75 sm:text-[17px]">{t('landing.tn.ramadan.text')}</p>
        <Link href="/ramadan" className="mt-6 inline-flex h-11 items-center gap-1.5 rounded-full bg-[#f5be50] pe-4 ps-5 text-[14px] font-semibold text-black transition-[transform,background-color] hover:bg-[#f8cd72] active:scale-[0.97]">
          {t('landing.tn.ramadan.cta')}
          <ChevronRight aria-hidden className="h-4 w-4 rtl:rotate-180" />
        </Link>
      </div>
      {data.ramadan.length >= 3 && (
        <m.div className="relative z-10 order-1 flex flex-1 items-end justify-center gap-2.5 lg:order-2 lg:self-end" style={{ x: picX }}>
          {data.ramadan.slice(0, 3).map((pic, index) => (
            <div key={index} className={cn('w-[30%] max-w-[150px] overflow-hidden rounded-poster ring-1 ring-[#f5be50]/25', index === 1 && '-translate-y-6')}>
              <PicImg pic={pic} width={185} eager className="aspect-[2/3] w-full" />
            </div>
          ))}
        </m.div>
      )}
    </article>
  )
}

/** The Arab cinema map's tile grid in miniature, lit like the real one; Tunisia first. */
function TileMap({ countries }: { countries: Tunisia['countries'] }) {
  const ref = useRef<HTMLDivElement>(null)
  const seen = useInView(ref, { once: true, amount: 0.4 })
  const columns = Math.max(...countries.map((country) => country.x)) + 1
  const rows = Math.max(...countries.map((country) => country.y)) + 1
  const tunisia = countries.find((country) => country.code === 'tn')
  return (
    <div ref={ref} className="grid w-full max-w-[640px] gap-1.5 sm:gap-2" dir="ltr" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${rows}, auto)` }}>
      {countries.map((country) => {
        const distance = tunisia ? Math.hypot(country.x - tunisia.x, country.y - tunisia.y) : 0
        const glow = 0.12 + country.glow * 0.7
        return (
          <span
            key={country.code}
            title={country.name}
            className="flex aspect-square items-center justify-center rounded-[8px] text-[10px] font-semibold text-black/70 transition-[opacity,transform] duration-500 ease-out sm:text-[11px]"
            style={{
              gridColumnStart: country.x + 1,
              gridRowStart: country.y + 1,
              backgroundColor: country.code === 'tn' ? 'rgb(255 36 20)' : `rgb(200 162 122 / ${glow})`,
              color: country.code === 'tn' ? '#fff' : undefined,
              opacity: seen ? 1 : 0,
              transform: seen ? 'none' : 'scale(0.6)',
              transitionDelay: `${Math.round(distance * 70)}ms`,
            }}
          >
            {country.code.toUpperCase()}
          </span>
        )
      })}
    </div>
  )
}
