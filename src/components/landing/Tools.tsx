"use client"
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import NumberFlow from '@number-flow/react'
import { Bell, ChevronRight, Heart, Play, Sparkles, X } from 'lucide-react'
import {
  AnimatePresence, animate, m, useInView, useMotionValue, useSpring, useTransform,
} from 'framer-motion'
import { useI18n } from '@/src/components/I18nProvider'
import { Switch } from '@/src/components/ui/switch'
import TmdbImage from '@/src/components/TmdbImage'
import { haptic, spring } from '@/src/lib/motion'
import type { LandingData, Pic } from '@/src/lib/landing-model'
import type { TKey } from '@/src/lib/i18n'
import { cn } from '@/src/lib/utils'
import { PicImg, useFinePointer, useSpotlight, useCalm } from './parts'
import { LOOKS, useStageLook } from './Stage'
import styles from './landing.module.css'

type Props = {
  data: Pick<LandingData, 'ask' | 'halal' | 'swipe' | 'night' | 'wrapped' | 'resume'>
  /** Ask (AI search) is offered to this viewer. */
  ask: boolean
  /** A Kids profile: no movie night (grown-up only), Halal mode can't be changed there. */
  kids: boolean
}

/**
 * The little things, as a bento of live demos: every tile does what it describes (drag the poster,
 * flip the switch, vote, tilt the card). The tiles open together, once, as the grid arrives.
 */
export default function Tools({ data, ask, kids }: Props) {
  const { t } = useI18n()
  const section = useRef<HTMLElement>(null)
  const grid = useRef<HTMLUListElement>(null)
  const seen = useInView(grid, { once: true, amount: 0.15 })
  const reduced = useCalm()
  useStageLook(section, LOOKS.dark)

  const tiles: { key: string, className: string, node: React.ReactNode }[] = [
    ...(data.ask.length ? [{ key: 'ask', className: 'md:col-span-2 lg:col-span-4 lg:row-span-2', node: <AskTile items={data.ask} enabled={ask} /> }] : []),
    ...(data.swipe.length >= 3 ? [{ key: 'swipe', className: 'lg:col-span-2 lg:row-span-2', node: <SwipeTile pics={data.swipe} /> }] : []),
    ...(data.halal.row.length >= 4 ? [{ key: 'halal', className: 'lg:col-span-3', node: <HalalTile row={data.halal.row} viewerOn={data.halal.viewerOn} kids={kids} /> }] : []),
    { key: 'lang', className: 'lg:col-span-3', node: <LanguageTile /> },
    ...(!kids && data.night.length === 3 ? [{ key: 'night', className: 'lg:col-span-2', node: <NightTile pics={data.night} /> }] : []),
    ...(data.wrapped.length >= 3 ? [{ key: 'wrapped', className: 'lg:col-span-2 lg:row-span-2', node: <WrappedTile pics={data.wrapped} /> }] : []),
    { key: 'alerts', className: 'lg:col-span-2', node: <AlertsTile pic={data.swipe[0] ?? null} /> },
    { key: 'profiles', className: 'lg:col-span-2', node: <ProfilesTile /> },
    ...(data.resume ? [{ key: 'resume', className: 'lg:col-span-2', node: <ResumeTile resume={data.resume} /> }] : []),
  ]

  return (
    <section ref={section} aria-labelledby="landing-tools-title" className="page-x relative py-[clamp(96px,16svh,180px)]">
      <div className="max-w-[60ch]">
        <h2 id="landing-tools-title" className="text-balance font-display text-[clamp(40px,6vw,96px)] font-extrabold leading-[0.9] text-white">
          {t('landing.tools.heading')}
        </h2>
        <p className="mt-5 max-w-[48ch] text-pretty text-[16px] leading-relaxed text-white/70 sm:text-[18px]">{t('landing.tools.text')}</p>
      </div>
      <ul ref={grid} className="mt-12 grid grid-flow-dense auto-rows-[minmax(250px,auto)] gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-6">
        {tiles.map((tile, index) => (
          <m.li
            key={tile.key}
            className={cn('min-w-0', tile.className)}
            initial={false}
            animate={seen || reduced ? { opacity: 1, y: 0, clipPath: 'inset(0% 0% 0% 0% round 22px)' } : { opacity: 0, y: 40, clipPath: 'inset(12% 6% 12% 6% round 22px)' }}
            transition={{ duration: 0.9, ease: [0.23, 1, 0.32, 1], delay: reduced ? 0 : index * 0.07 }}
          >
            {tile.node}
          </m.li>
        ))}
      </ul>
    </section>
  )
}

/** The glass tile every demo sits in: a specular edge follows the pointer. */
function Tile({ title, text, children, className, footer, art }: {
  title: TKey
  text: TKey
  children?: React.ReactNode
  className?: string
  footer?: React.ReactNode
  art?: React.ReactNode
}) {
  const { t } = useI18n()
  const ref = useSpotlight<HTMLDivElement>()
  return (
    <div ref={ref} className={cn(styles['glass-tile'], 'flex h-full flex-col overflow-hidden rounded-[22px] p-5 sm:p-6', className)}>
      {art}
      <div className="relative z-[1] flex-1">{children}</div>
      <div className="relative z-[1] mt-5">
        <h3 className="font-display text-[22px] font-bold leading-tight text-white sm:text-[26px]">{t(title)}</h3>
        <p className="mt-1.5 max-w-[46ch] text-pretty text-[14px] leading-relaxed text-white/65 sm:text-[15px]">{t(text)}</p>
        {footer && <div className="mt-4">{footer}</div>}
      </div>
    </div>
  )
}

function TileLink({ href, children }: { href: string, children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex h-10 items-center gap-1 rounded-full bg-white/[0.1] pe-3.5 ps-4 text-[13px] font-medium text-white transition-colors hover:bg-white/[0.18] active:scale-[0.97]">
      {children}
      <ChevronRight aria-hidden className="h-4 w-4 rtl:rotate-180" />
    </Link>
  )
}

// ---- Ask -----------------------------------------------------------------------------------------

/** A search field that types a request by itself, then shows real titles that fit it. */
function AskTile({ items, enabled }: { items: LandingData['ask'], enabled: boolean }) {
  const { t } = useI18n()
  const reduced = useCalm()
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { amount: 0.4 })
  const [which, setWhich] = useState(0)
  const [typed, setTyped] = useState(reduced ? Infinity : 0)
  const query = t(items[which].query)
  const done = typed >= query.length

  // Type the request, show the answer, move on to the next one.
  useEffect(() => {
    if (reduced || !inView) return
    if (!done) {
      const timer = window.setTimeout(() => setTyped((count) => count + 1), 38 + Math.random() * 40)
      return () => window.clearTimeout(timer)
    }
    const timer = window.setTimeout(() => {
      setWhich((index) => (index + 1) % items.length)
      setTyped(0)
    }, 4200)
    return () => window.clearTimeout(timer)
  }, [typed, done, inView, reduced, items.length])

  const href = enabled ? `/search?mode=ask&q=${encodeURIComponent(query)}` : `/search?q=${encodeURIComponent(query)}`

  return (
    <Tile
      title="landing.ask.title"
      text="landing.ask.text"
      footer={<TileLink href={href}>{enabled ? t('landing.ask.try') : t('landing.ask.search')}</TileLink>}
    >
      <div ref={ref} className="flex h-full flex-col">
        <div className="flex h-14 items-center gap-3 rounded-full bg-black/50 px-5 ring-1 ring-inset ring-white/12">
          <Sparkles aria-hidden className="h-5 w-5 shrink-0 text-red-400" />
          <span className="min-w-0 truncate text-[16px] text-white sm:text-[18px]" aria-live="polite">
            {query.slice(0, typed)}
            {!done && <span aria-hidden className="ms-0.5 inline-block h-[1.1em] w-[2px] translate-y-[3px] animate-pulse bg-white/80" />}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {items.map((item, index) => (
            <button
              key={item.query}
              type="button"
              onClick={() => { setWhich(index); setTyped(reduced ? Infinity : 0) }}
              aria-pressed={index === which}
              className={cn(
                'pressable h-9 rounded-full px-3.5 text-[13px] transition-colors',
                index === which ? 'bg-white text-black' : 'bg-white/[0.07] text-white/75 hover:bg-white/[0.12]',
              )}
            >
              {t(item.query)}
            </button>
          ))}
        </div>
        <div className="mt-5 grid flex-1 grid-cols-4 items-end gap-2.5 [perspective:600px] sm:gap-3">
          {items[which].pics.slice(0, 4).map((pic, index) => (
            <AnimatePresence key={`${which}-${index}`} mode="popLayout">
              {done && (
                <m.div
                  initial={{ opacity: 0, y: 24, rotateX: -35, filter: 'blur(8px)' }}
                  animate={{ opacity: 1, y: 0, rotateX: 0, filter: 'blur(0px)' }}
                  transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1], delay: reduced ? 0 : index * 0.08 }}
                  className="overflow-hidden rounded-poster ring-1 ring-white/10"
                >
                  <PicImg pic={pic} width={185} alt={pic.title} className="aspect-[2/3] w-full" />
                </m.div>
              )}
            </AnimatePresence>
          ))}
        </div>
      </div>
    </Tile>
  )
}

// ---- Swipe ---------------------------------------------------------------------------------------

/** A real stack of posters: drag the top one right to like, left to pass (or use the buttons). */
function SwipeTile({ pics }: { pics: Pic[] }) {
  const { t } = useI18n()
  const [top, setTop] = useState(0)
  // The top card's fling, so the buttons send it off the same way a drag does.
  const fling = useRef<((direction: 1 | -1) => void) | null>(null)
  const decided = () => {
    haptic(12)
    setTop((index) => index + 1)
  }
  const press = (direction: 1 | -1) => (fling.current ? fling.current(direction) : decided())
  const stack = [0, 1, 2].map((offset) => ({ pic: pics[(top + offset) % pics.length], key: top + offset, offset }))
  return (
    <Tile
      title="landing.swipe.title"
      text="landing.swipe.text"
      footer={<TileLink href="/swipe">{t('landing.swipe.start')}</TileLink>}
    >
      <div className="relative mx-auto mt-2 aspect-[2/3] w-[62%] max-w-[240px] lg:w-[72%]">
        {stack.slice().reverse().map(({ pic, key, offset }) => (
          <SwipeCard key={key} pic={pic} depth={offset} onDecided={decided} flingRef={offset === 0 ? fling : undefined} />
        ))}
      </div>
      <div className="mt-4 flex items-center justify-center gap-3">
        <button type="button" aria-label={t('landing.swipe.pass')} onClick={() => press(-1)} className="pressable grid h-11 w-11 place-items-center rounded-full bg-white/[0.08] text-white/80 transition-colors hover:bg-white/[0.14]">
          <X aria-hidden className="h-5 w-5" />
        </button>
        <span className="min-w-[8ch] text-center text-[12px] text-white/50">{t('landing.swipe.hint')}</span>
        <button type="button" aria-label={t('landing.swipe.like')} onClick={() => press(1)} className="pressable grid h-11 w-11 place-items-center rounded-full bg-red-600 text-white transition-colors hover:bg-red-500">
          <Heart aria-hidden className="h-5 w-5 fill-current" />
        </button>
      </div>
    </Tile>
  )
}

/** Past this many pixels, letting go decides; short of it, the card springs back. */
const SWIPE_DECIDES = 90

function SwipeCard({ pic, depth, onDecided, flingRef }: {
  pic: Pic
  depth: number
  onDecided: () => void
  flingRef?: React.MutableRefObject<((direction: 1 | -1) => void) | null>
}) {
  const { t } = useI18n()
  const x = useMotionValue(0)
  const rotate = useTransform(x, [-200, 200], [-16, 16])
  const like = useTransform(x, [20, 110], [0, 1])
  const pass = useTransform(x, [-110, -20], [1, 0])
  const grab = useRef<{ id: number, from: number } | null>(null)
  const leaving = useRef(false)
  const top = depth === 0

  const flyOut = (direction: 1 | -1) => {
    if (leaving.current) return
    leaving.current = true
    animate(x, direction * 460, { type: 'spring', bounce: 0, duration: 0.4, onComplete: onDecided })
  }
  useEffect(() => {
    if (!flingRef) return
    flingRef.current = flyOut
    return () => { flingRef.current = null }
  })

  // The card follows the finger (pointer capture keeps it even off the card); vertical moves
  // still scroll the page (touch-action: pan-y).
  const release = (event: React.PointerEvent) => {
    if (grab.current?.id !== event.pointerId) return
    grab.current = null
    const offset = x.get()
    if (Math.abs(offset) > SWIPE_DECIDES) flyOut(offset > 0 ? 1 : -1)
    else animate(x, 0, { type: 'spring', bounce: 0.2, duration: 0.45 })
  }

  return (
    <m.div
      className={cn('absolute inset-0 touch-pan-y overflow-hidden rounded-[16px] shadow-[0_30px_60px_-25px_rgb(0_0_0/0.9)] ring-1 ring-white/10', top ? 'cursor-grab active:cursor-grabbing' : 'pointer-events-none')}
      style={{ x, rotate, zIndex: 10 - depth }}
      initial={false}
      animate={{ scale: 1 - depth * 0.06, y: depth * 14, opacity: depth > 1 ? 0.6 : 1 }}
      transition={spring.ui}
      onPointerDown={top ? (event) => {
        if (leaving.current) return
        event.currentTarget.setPointerCapture(event.pointerId)
        grab.current = { id: event.pointerId, from: event.clientX - x.get() }
      } : undefined}
      onPointerMove={top ? (event) => {
        if (grab.current?.id === event.pointerId) x.set(event.clientX - grab.current.from)
      } : undefined}
      onPointerUp={top ? release : undefined}
      onPointerCancel={top ? release : undefined}
    >
      <PicImg pic={pic} width={342} alt={top ? pic.title : ''} className="pointer-events-none h-full w-full" />
      {top && (
        <>
          <m.span style={{ opacity: like }} className="absolute start-4 top-4 -rotate-12 rounded-[8px] border-2 border-red-500 px-2.5 py-1 text-[15px] font-bold text-red-400">{t('landing.swipe.like')}</m.span>
          <m.span style={{ opacity: pass }} className="absolute end-4 top-4 rotate-12 rounded-[8px] border-2 border-white/80 px-2.5 py-1 text-[15px] font-bold text-white">{t('landing.swipe.pass')}</m.span>
        </>
      )}
    </m.div>
  )
}

// ---- Halal mode ----------------------------------------------------------------------------------

/** A row of this week's titles and the real switch's verdicts: flip it and watch what it leaves out. */
function HalalTile({ row, viewerOn, kids }: { row: LandingData['halal']['row'], viewerOn: boolean, kids: boolean }) {
  const { t } = useI18n()
  const [on, setOn] = useState(viewerOn)
  const hidden = row.filter((item) => item.hidden).length
  const shown = on ? row.filter((item) => !item.hidden) : row
  return (
    <Tile
      title="landing.halal.title"
      text="landing.halal.text"
      footer={!viewerOn && !kids ? <TileLink href="/profile#halal">{t('landing.halal.settings')}</TileLink> : undefined}
    >
      <div className="flex items-center justify-between gap-4">
        <span className="text-[13px] text-white/60" aria-live="polite">
          {on ? (hidden ? t('landing.halal.hidden', { count: hidden }) : t('landing.halal.none')) : ' '}
        </span>
        <Switch checked={on} onCheckedChange={setOn} aria-label={t('landing.halal.switch')} />
      </div>
      <m.ul layout className="mt-4 flex flex-wrap gap-2">
        <AnimatePresence initial={false} mode="popLayout">
          {shown.map((item) => (
            <m.li
              key={item.tmdb ?? item.src}
              layout
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: 0.7, filter: 'blur(10px)' }}
              transition={spring.ui}
              className="w-[calc((100%-3*0.5rem)/4)] sm:w-[calc((100%-7*0.5rem)/8)] lg:w-[calc((100%-5*0.5rem)/6)] xl:w-[calc((100%-7*0.5rem)/8)]"
            >
              <PicImg pic={item} width={154} className="aspect-[2/3] w-full rounded-[8px]" />
            </m.li>
          ))}
        </AnimatePresence>
      </m.ul>
    </Tile>
  )
}

// ---- Languages -----------------------------------------------------------------------------------

const WORDS = [
  { word: 'Watch', name: 'English', lang: 'en', dir: 'ltr' },
  { word: 'Regarder', name: 'Français', lang: 'fr', dir: 'ltr' },
  { word: 'شاهِد', name: 'العربية', lang: 'ar', dir: 'rtl' },
  { word: 'تفرّج', name: 'تونسي', lang: 'ar-TN', dir: 'rtl' },
] as const

/** "Watch" in each of the site's languages, rolling like a slot machine; tap for the next. */
function LanguageTile() {
  const { t, locale } = useI18n()
  const reduced = useCalm()
  const ref = useRef<HTMLButtonElement>(null)
  const inView = useInView(ref, { amount: 0.5 })
  // Starts in the visitor's own language.
  const [index, setIndex] = useState(() => Math.max(0, WORDS.findIndex((item) => item.lang === ({ en: 'en', fr: 'fr', ar: 'ar', tn: 'ar-TN' } as Record<string, string>)[locale])))
  useEffect(() => {
    if (reduced || !inView) return
    const timer = window.setInterval(() => setIndex((value) => (value + 1) % WORDS.length), 2200)
    return () => window.clearInterval(timer)
  }, [reduced, inView, index])
  const current = WORDS[index]
  return (
    <Tile title="landing.lang.title" text="landing.lang.text">
      <button
        ref={ref}
        type="button"
        aria-label={t('landing.lang.next')}
        onClick={() => { haptic(6); setIndex((value) => (value + 1) % WORDS.length) }}
        className="relative flex h-[120px] w-full items-center justify-center overflow-hidden rounded-[16px] bg-black/40 ring-1 ring-inset ring-white/10"
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <m.span
            key={current.lang}
            lang={current.lang}
            dir={current.dir}
            initial={reduced ? { opacity: 0 } : { y: '110%', opacity: 0, filter: 'blur(6px)' }}
            animate={{ y: '0%', opacity: 1, filter: 'blur(0px)' }}
            exit={reduced ? { opacity: 0 } : { y: '-110%', opacity: 0, filter: 'blur(6px)' }}
            transition={{ type: 'spring', bounce: 0.25, duration: 0.6 }}
            className="font-display text-[clamp(48px,6vw,76px)] font-extrabold leading-none text-white"
          >
            {current.word}
          </m.span>
        </AnimatePresence>
      </button>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {WORDS.map((item, position) => (
          <span key={item.lang} lang={item.lang} className={cn('rounded-full px-3 py-1 text-[12px] transition-colors duration-300', position === index ? 'bg-white text-black' : 'bg-white/[0.06] text-white/60')}>
            {item.name}
          </span>
        ))}
      </div>
    </Tile>
  )
}

// ---- Movie night ---------------------------------------------------------------------------------

/** A shortlist of three: tap one to vote, the bars and counts move. */
function NightTile({ pics }: { pics: Pic[] }) {
  const { t } = useI18n()
  const [votes, setVotes] = useState([3, 5, 2])
  const [mine, setMine] = useState<number | null>(null)
  const total = votes.reduce((sum, value) => sum + value, 0)
  const leader = votes.indexOf(Math.max(...votes))
  const vote = (index: number) => {
    haptic(10)
    // A tap votes; tapping your own pick again takes the vote back; another pick moves it.
    setVotes((current) => current.map((value, position) => value + (position === index && mine !== index ? 1 : 0) - (position === mine ? 1 : 0)))
    setMine((current) => (current === index ? null : index))
  }
  return (
    <Tile title="landing.night.title" text="landing.night.text" footer={<TileLink href="/movie-night">{t('landing.night.plan')}</TileLink>}>
      <div className="grid grid-cols-3 gap-2.5">
        {pics.map((pic, index) => (
          <button
            key={index}
            type="button"
            onClick={() => vote(index)}
            aria-pressed={mine === index}
            aria-label={t('landing.night.vote', { title: pic.title })}
            className="pressable group text-start"
          >
            <span className={cn('block overflow-hidden rounded-[10px] ring-2 transition-[box-shadow,--tw-ring-color] duration-300', mine === index ? 'ring-red-500' : index === leader ? 'ring-white/40' : 'ring-transparent')}>
              <PicImg pic={pic} width={154} className="aspect-[2/3] w-full transition-transform duration-500 ease-out group-hover:scale-[1.04]" />
            </span>
            <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-white/10">
              <m.span className="block h-full origin-left rounded-full bg-white rtl:origin-right" animate={{ scaleX: votes[index] / total }} transition={spring.ui} />
            </span>
            <span className="mt-1 block text-[13px] tabular-nums text-white/70"><NumberFlow value={votes[index]} /></span>
          </button>
        ))}
      </div>
    </Tile>
  )
}

// ---- Wrapped -------------------------------------------------------------------------------------

/** A year-in-film story card that tilts towards the pointer, with a glare across its glass. */
function WrappedTile({ pics }: { pics: Pic[] }) {
  const { t } = useI18n()
  const fine = useFinePointer()
  const reduced = useCalm()
  const card = useRef<HTMLDivElement>(null)
  const seen = useInView(card, { once: true, amount: 0.5 })
  const rx = useMotionValue(0)
  const ry = useMotionValue(0)
  const gx = useMotionValue(50)
  const gy = useMotionValue(30)
  const sx = useSpring(rx, { stiffness: 180, damping: 18 })
  const sy = useSpring(ry, { stiffness: 180, damping: 18 })
  const glare = useTransform([gx, gy], ([x, y]) => `radial-gradient(circle at ${x}% ${y}%, rgb(255 255 255 / 0.28), transparent 55%)`)
  const tilt = fine && !reduced
  return (
    <Tile title="landing.wrapped.title" text="landing.wrapped.text">
      <div className="flex h-full items-center justify-center [perspective:900px]">
        <m.div
          ref={card}
          className="relative aspect-[9/14] w-[68%] max-w-[230px] overflow-hidden rounded-[20px] bg-gradient-to-b from-[#3b1d0a] via-[#1d0f06] to-black shadow-[0_40px_80px_-30px_rgb(245_190_80/0.4)] ring-1 ring-[#f5be50]/25"
          style={tilt ? { rotateX: sx, rotateY: sy } : undefined}
          onPointerMove={tilt ? (event) => {
            const box = card.current!.getBoundingClientRect()
            const px = (event.clientX - box.left) / box.width
            const py = (event.clientY - box.top) / box.height
            ry.set((px - 0.5) * 22)
            rx.set(-(py - 0.5) * 22)
            gx.set(px * 100)
            gy.set(py * 100)
          } : undefined}
          onPointerLeave={tilt ? () => { rx.set(0); ry.set(0) } : undefined}
        >
          <div className="absolute inset-x-0 top-0 grid grid-cols-5 gap-1 p-2 opacity-70">
            {pics.slice(0, 5).map((pic, index) => <PicImg key={index} pic={pic} width={92} className="aspect-[2/3] w-full rounded-[4px]" />)}
          </div>
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/80 to-transparent p-4 pt-16">
            <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] text-white/80">{t('landing.wrapped.example')}</span>
            <p className="mt-2 font-display text-[40px] font-extrabold leading-none text-[#f5be50] tabular-nums"><NumberFlow value={seen ? 214 : 0} /></p>
            <p className="text-[12px] text-white/70">{t('landing.wrapped.hours')}</p>
            <p className="mt-2 text-[12px] text-white/55">{t('landing.wrapped.genreLabel')}</p>
            <p className="font-display text-[20px] font-bold leading-tight text-white">{t('landing.wrapped.genre')}</p>
          </div>
          {tilt && <m.div aria-hidden className="pointer-events-none absolute inset-0 mix-blend-overlay" style={{ backgroundImage: glare }} />}
        </m.div>
      </div>
    </Tile>
  )
}

// ---- Alerts, profiles, Continue Watching ---------------------------------------------------------

/** The bell rings when the tile arrives (and on hover); a notification slides in under it. */
function AlertsTile({ pic }: { pic: Pic | null }) {
  const ref = useRef<HTMLDivElement>(null)
  const seen = useInView(ref, { once: true, amount: 0.6 })
  const [ringing, setRinging] = useState(false)
  useEffect(() => {
    if (!seen) return
    setRinging(true)
    const timer = window.setTimeout(() => setRinging(false), 950)
    return () => window.clearTimeout(timer)
  }, [seen])
  return (
    <Tile title="landing.alerts.title" text="landing.alerts.text">
      <div
        ref={ref}
        className="flex items-center gap-4"
        onPointerEnter={() => { setRinging(false); requestAnimationFrame(() => setRinging(true)) }}
        onAnimationEnd={() => setRinging(false)}
      >
        <span className="relative grid h-14 w-14 shrink-0 place-items-center rounded-full bg-white/[0.08]">
          <Bell aria-hidden className={cn('h-6 w-6 text-white', styles.ring, ringing && styles['ring-now'])} />
          <span className="absolute end-3 top-3 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-black" />
        </span>
        {pic && (
          <m.div
            initial={false}
            animate={seen ? { opacity: 1, x: 0 } : { opacity: 0, x: 24 }}
            transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1], delay: 0.35 }}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-[14px] bg-black/40 p-2.5 ring-1 ring-inset ring-white/10"
          >
            <PicImg pic={pic} width={92} className="aspect-[2/3] w-9 shrink-0 rounded-[5px]" />
            <span className="min-w-0 truncate text-[14px] font-medium text-white" dir="auto">{pic.title}</span>
          </m.div>
        )}
      </div>
    </Tile>
  )
}

const FACES = ['#FF2414', '#3B82F6', '#F5BE50', '#22C55E', '#A855F7']

/** Five profiles in a row; the last one is the Kids profile. They hop in turn on hover. */
function ProfilesTile() {
  const { t } = useI18n()
  const [hop, setHop] = useState(0)
  return (
    <Tile title="landing.profiles.title" text="landing.profiles.text">
      <div className="flex h-full items-center justify-center gap-3" onPointerEnter={() => setHop((value) => value + 1)}>
        {FACES.map((color, index) => (
          <m.span
            key={`${hop}-${index}`}
            initial={hop ? { y: 0 } : false}
            animate={hop ? { y: [0, -10, 0] } : undefined}
            transition={{ duration: 0.45, delay: index * 0.06, ease: [0.23, 1, 0.32, 1] }}
            className="relative grid aspect-square w-[17%] max-w-[72px] place-items-center rounded-[18px]"
            style={{ backgroundColor: color }}
          >
            <span aria-hidden className="flex gap-[18%] pt-[10%]">
              <span className="h-1.5 w-1.5 rounded-full bg-black/70" />
              <span className="h-1.5 w-1.5 rounded-full bg-black/70" />
            </span>
            {index === FACES.length - 1 && (
              <span className="absolute -bottom-2 rounded-full bg-white px-1.5 text-[10px] font-semibold text-black">{t('profiles.kidsBadge')}</span>
            )}
          </m.span>
        ))}
      </div>
    </Tile>
  )
}

/** A series you're in the middle of: the progress bar fills to where you stopped. */
function ResumeTile({ resume }: { resume: NonNullable<LandingData['resume']> }) {
  const ref = useRef<HTMLDivElement>(null)
  const seen = useInView(ref, { once: true, amount: 0.6 })
  return (
    <Tile title="landing.continue.title" text="landing.continue.text">
      <div ref={ref} className="relative aspect-video overflow-hidden rounded-tile ring-1 ring-white/10">
        <TmdbImage path={resume.backdrop} kind="backdrop" alt="" fill sizes="(min-width: 1024px) 30vw, 90vw" className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
        <span className="absolute start-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-white/90 text-black">
          <Play aria-hidden className="h-4 w-4 translate-x-[1px] fill-current rtl:-scale-x-100" />
        </span>
        <span className="absolute bottom-3 start-3 end-3 truncate text-[14px] font-semibold text-white" dir="auto">{resume.title}</span>
        <span className="absolute inset-x-0 bottom-0 h-1 bg-white/20">
          <m.span className="block h-full origin-left bg-red-500 rtl:origin-right" initial={false} animate={{ scaleX: seen ? 0.62 : 0 }} transition={{ duration: 1.4, ease: [0.23, 1, 0.32, 1], delay: 0.2 }} />
        </span>
      </div>
    </Tile>
  )
}
