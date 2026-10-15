"use client"
import { useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { AnimatePresence, m, useMotionValueEvent, useScroll, useTransform, type MotionValue } from 'framer-motion'
import { useI18n } from '@/src/components/I18nProvider'
import { isArabicScript } from '@/src/lib/i18n/locales'
import { REELS, type Pic, type ReelId } from '@/src/lib/landing-model'
import type { TKey } from '@/src/lib/i18n'
import { cn } from '@/src/lib/utils'
import { PicImg, useCalm, PicturesWhenNear } from './parts'
import { useStageLook } from './Stage'

type Reel = { id: ReelId, pics: Pic[] }

/** Scroll height given to each word (in svh), on top of one screen for the pinned stage. */
const PER_WORD = 46
/** The poster columns behind a word drift at their own speeds (px over the word's time on screen). */
const COLUMN_DRIFT = [-180, 90, -260, 130, -210, 70]

const wordKey = (id: ReelId) => `landing.reel.${id}` as TKey
const textKey = (id: ReelId) => `landing.reel.${id}.text` as TKey

/**
 * Everything the site has, one huge word at a time: the stage is pinned and each word grows wider
 * while it's on screen (the display face's width axis; weight in Arabic), over a tilted wall of that
 * section's posters whose columns drift at different speeds. The room takes each section's colour.
 */
export default function Catalogue({ reels }: { reels: Reel[] }) {
  const { t, locale } = useI18n()
  const reduced = useCalm()
  const section = useRef<HTMLElement>(null)
  const [active, setActive] = useState(0)
  const count = reels.length
  const { scrollYProgress } = useScroll({ target: section, offset: ['start start', 'end end'] })
  useMotionValueEvent(scrollYProgress, 'change', (value) => {
    setActive(Math.max(0, Math.min(count - 1, Math.floor(value * count))))
  })
  const current = reels[Math.min(active, count - 1)]
  useStageLook(section, { base: '#000000', light: current ? REELS[current.id].light : null })

  if (!count) return null

  if (reduced) return <StillCatalogue reels={reels} />

  return (
    <section
      id="tour"
      ref={section}
      aria-labelledby="landing-reel-title"
      className="relative scroll-mt-0"
      style={{ height: `${count * PER_WORD + 100}svh` }}
    >
      <h2 id="landing-reel-title" className="sr-only">{t('landing.reel.heading')}</h2>
      {/* Keyboard and screen readers get the words as a plain list of links. */}
      <ul className="sr-only">
        {reels.map((reel) => (
          <li key={reel.id}>
            <Link href={REELS[reel.id].href} className="focus:not-sr-only focus:fixed focus:start-4 focus:top-20 focus:z-50 focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:text-black">
              {t(wordKey(reel.id))}: {t(textKey(reel.id))}
            </Link>
          </li>
        ))}
      </ul>

      <div aria-hidden className="sticky top-0 h-[100svh] overflow-hidden">
        <PicturesWhenNear section={section}>
          {reels.map((reel, index) => Math.abs(index - active) <= 1 && (
            <PosterField key={reel.id} reel={reel} index={index} count={count} progress={scrollYProgress} visible={index === active} />
          ))}
        </PicturesWhenNear>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_60%_at_50%_50%,rgb(0_0_0/0.15),rgb(0_0_0/0.85)_75%)]" />

        <div className="absolute inset-x-0 bottom-[22svh] top-0 flex items-center justify-center px-[var(--gutter)] lg:ps-[calc(var(--rail)+var(--gutter))]">
          {reels.map((reel, index) => (
            <Word key={reel.id} text={t(wordKey(reel.id))} arabic={isArabicScript(locale)} index={index} count={count} progress={scrollYProgress} />
          ))}
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-[max(32px,9svh)] flex flex-col items-center gap-5 px-[var(--gutter)] text-center lg:ps-[calc(var(--rail)+var(--gutter))]">
          <AnimatePresence mode="wait" initial={false}>
            <m.div
              key={current.id}
              initial={{ opacity: 0, y: 10, filter: 'blur(6px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -8, filter: 'blur(6px)' }}
              transition={{ duration: 0.32, ease: [0.23, 1, 0.32, 1] }}
              className="flex flex-col items-center gap-4"
            >
              <p className="max-w-[40ch] text-pretty text-[15px] text-white/80 sm:text-[18px]">{t(textKey(current.id))}</p>
              <Link
                href={REELS[current.id].href}
                tabIndex={-1}
                className="pointer-events-auto inline-flex h-11 items-center gap-1.5 rounded-full bg-white/[0.1] pe-4 ps-5 text-[14px] font-medium text-white backdrop-blur-md transition-colors hover:bg-white/[0.18] active:scale-[0.97]"
              >
                {t('landing.reel.open', { name: t(wordKey(current.id)) })}
                <ChevronRight aria-hidden className="h-4 w-4 rtl:rotate-180" />
              </Link>
            </m.div>
          </AnimatePresence>
          {/* Where you are in the reel: one tick per word, the current one filling as you scroll. */}
          <div className="flex gap-1.5">
            {reels.map((reel, index) => (
              <Tick key={reel.id} index={index} count={count} progress={scrollYProgress} light={REELS[reel.id].light} />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

/** One word's time on screen: 0 → 1 while it's the current one (it may run past either end). */
function useLocal(progress: MotionValue<number>, index: number, count: number) {
  return useTransform(progress, (value) => value * count - index)
}

function Word({ text, arabic, index, count, progress }: { text: string, arabic: boolean, index: number, count: number, progress: MotionValue<number> }) {
  const local = useLocal(progress, index, count)
  const first = index === 0
  const last = index === count - 1
  const opacity = useTransform(local, [first ? -1 : -0.18, first ? -0.5 : 0.04, last ? 2 : 0.86, last ? 3 : 1.02], [0, 1, 1, 0])
  const y = useTransform(local, [-0.2, 0.08, 0.86, 1.04], ['22%', '0%', '0%', '-18%'])
  const scale = useTransform(local, [-0.2, 0.1, 1.04], [0.88, 1, 1.06])
  const blur = useTransform(local, [-0.2, 0.06, 0.88, 1.04], ['blur(14px)', 'blur(0px)', 'blur(0px)', 'blur(16px)'])
  // The word widens (or, in Arabic, thickens) for as long as it's on screen.
  const stretch = useTransform(local, [0, 1], ['75%', '100%'])
  const weight = useTransform(local, [0, 1], arabic ? [500, 900] : [800, 800])
  const tracking = useTransform(local, [0, 1], arabic ? ['0em', '0em'] : ['-0.045em', '0.01em'])
  return (
    <m.p
      className={cn(
        'absolute max-w-[92vw] text-balance text-center font-display text-white [text-shadow:0_8px_60px_rgb(0_0_0/0.5)]',
        // Two-word sections ("Turkish dramas") wrap on two lines: a size that leaves room below.
        arabic
          ? 'text-[clamp(60px,min(12vw,24svh),200px)] leading-[1.15]'
          : text.includes(' ')
          ? 'text-[clamp(60px,min(11.5vw,21svh),210px)] leading-[0.86]'
          : 'text-[clamp(70px,min(15.5vw,30svh),270px)] leading-[0.86]',
      )}
      style={{ opacity, y, scale, filter: blur, fontStretch: arabic ? undefined : stretch, fontWeight: weight, letterSpacing: tracking }}
    >
      {text}
    </m.p>
  )
}

function PosterField({ reel, index, count, progress, visible }: { reel: Reel, index: number, count: number, progress: MotionValue<number>, visible: boolean }) {
  const local = useLocal(progress, index, count)
  // Six columns; each repeats the section's posters with an offset so neighbours differ.
  const columns = COLUMN_DRIFT.map((_, column) => Array.from({ length: 6 }, (_, row) => reel.pics[(column * 5 + row * 2) % reel.pics.length]))
  return (
    <div
      className={cn('absolute inset-0 transition-opacity duration-700 ease-out [perspective:1300px]', visible ? 'opacity-100' : 'opacity-0')}
    >
      <div className="absolute left-1/2 top-1/2 flex w-[150vmax] justify-center gap-[1.6vmax] [transform-style:preserve-3d] [transform:translate(-50%,-50%)_rotateX(52deg)_rotateZ(-16deg)] rtl:[transform:translate(-50%,-50%)_rotateX(52deg)_rotateZ(16deg)]">
        {columns.map((pics, column) => (
          <Column key={column} pics={pics} drift={COLUMN_DRIFT[column]} local={local} />
        ))}
      </div>
    </div>
  )
}

function Column({ pics, drift, local }: { pics: Pic[], drift: number, local: MotionValue<number> }) {
  const y = useTransform(local, [-1, 2], [-drift, drift * 2])
  return (
    <m.div className="flex w-[11vmax] shrink-0 flex-col gap-[1.6vmax]" style={{ y }}>
      {pics.map((pic, row) => (
        <PicImg key={row} pic={pic} width={185} eager className="aspect-[2/3] w-full rounded-poster opacity-60 brightness-[0.7]" />
      ))}
    </m.div>
  )
}

function Tick({ index, count, progress, light }: { index: number, count: number, progress: MotionValue<number>, light: string }) {
  const local = useLocal(progress, index, count)
  const fill = useTransform(local, [0, 1], [0, 1], { clamp: true })
  return (
    <span className="relative h-1 w-6 overflow-hidden rounded-full bg-white/15">
      <m.span className="absolute inset-0 origin-left rounded-full rtl:origin-right" style={{ scaleX: fill, backgroundColor: `rgb(${light})` }} />
    </span>
  )
}

/** Less motion: the same sections as a plain list, each with a strip of its posters. */
function StillCatalogue({ reels }: { reels: Reel[] }) {
  const { t } = useI18n()
  return (
    <section id="tour" aria-labelledby="landing-reel-title" className="page-x py-24">
      <h2 id="landing-reel-title" className="font-display text-[clamp(34px,5vw,64px)] font-extrabold leading-[0.95]">{t('landing.reel.heading')}</h2>
      <ul className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {reels.map((reel) => (
          <li key={reel.id}>
            <Link href={REELS[reel.id].href} className="block rounded-[22px] bg-white/[0.04] p-5 ring-1 ring-inset ring-white/[0.07] transition-colors hover:bg-white/[0.07]">
              <div className="flex gap-1.5">
                {reel.pics.slice(0, 4).map((pic, index) => <PicImg key={index} pic={pic} width={92} className="aspect-[2/3] w-1/4 rounded-[6px]" />)}
              </div>
              <p className="mt-4 font-display text-[28px] font-extrabold leading-none">{t(wordKey(reel.id))}</p>
              <p className="mt-2 text-[14px] text-white/65">{t(textKey(reel.id))}</p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
