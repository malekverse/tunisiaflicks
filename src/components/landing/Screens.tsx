"use client"
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronRight, Monitor, Smartphone, Tv } from 'lucide-react'
import { AnimatePresence, m, useMotionValueEvent, useScroll, useTransform } from 'framer-motion'
import { useI18n } from '@/src/components/I18nProvider'
import type { TKey } from '@/src/lib/i18n'
import { cn } from '@/src/lib/utils'
import { useCalm } from './parts'
import { LOOKS, useStageLook } from './Stage'

type StepId = 'phone' | 'computer' | 'tv'

const STEPS: { id: StepId, icon: typeof Smartphone, title: TKey, text: TKey, screen: string, ratio: number }[] = [
  { id: 'phone', icon: Smartphone, title: 'landing.screens.phone.title', text: 'landing.screens.phone.text', screen: '/landing/screens/phone.webp', ratio: 390 / 844 },
  { id: 'computer', icon: Monitor, title: 'landing.screens.computer.title', text: 'landing.screens.computer.text', screen: '/landing/screens/computer.webp', ratio: 16 / 10 },
  { id: 'tv', icon: Tv, title: 'landing.screens.tv.title', text: 'landing.screens.tv.text', screen: '/landing/screens/tv.webp', ratio: 16 / 9 },
]

/** The frame's size and corners for a device, fitted in the stage's box. */
function frameFor(step: StepId, box: { w: number, h: number }) {
  const ratio = STEPS.find((item) => item.id === step)!.ratio
  const h = step === 'tv' ? box.h * 0.84 : box.h
  let height = h
  let width = height * ratio
  if (width > box.w) {
    width = box.w
    height = width / ratio
  }
  const radius = step === 'phone' ? Math.min(width, height) * 0.13 : step === 'computer' ? 12 : 6
  const bezel = step === 'phone' ? Math.max(7, width * 0.032) : step === 'computer' ? 0 : Math.max(5, width * 0.008)
  return { width, height, radius, bezel }
}

/**
 * The lights come up: a silver screen opens from the centre like a projector's iris (the page's one
 * light section), and one device frame changes shape as you scroll (phone, computer, TV), showing
 * the site as it looks on each.
 */
export default function Screens() {
  const { t } = useI18n()
  const reduced = useCalm()
  const section = useRef<HTMLElement>(null)
  const stageBox = useRef<HTMLDivElement>(null)
  const [step, setStep] = useState<StepId>('phone')
  const [box, setBox] = useState({ w: 320, h: 520 })
  useStageLook(section, LOOKS.quiet)

  const { scrollYProgress } = useScroll({ target: section, offset: ['start start', 'end end'] })
  const iris = useTransform(scrollYProgress, [0, 0.16], ['circle(0% at 50% 55%)', 'circle(150% at 50% 55%)'])
  useMotionValueEvent(scrollYProgress, 'change', (value) => {
    const index = Math.min(STEPS.length - 1, Math.max(0, Math.floor(((value - 0.18) / 0.8) * STEPS.length)))
    setStep(STEPS[index].id)
  })

  useEffect(() => {
    const element = stageBox.current
    if (!element) return
    const measure = () => setBox({ w: element.clientWidth, h: element.clientHeight })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const frame = frameFor(step, box)
  const index = STEPS.findIndex((item) => item.id === step)

  const body = (
    <div className="page-x relative flex h-full flex-col gap-6 pb-[calc(var(--tabbar-space)+16px)] pt-[calc(var(--topbar)+env(safe-area-inset-top)+28px)] text-black lg:flex-row lg:items-center lg:gap-14 lg:py-0">
      <div className="lg:w-[40%] lg:max-w-[520px]">
        <h2 id="landing-screens-title" className="text-balance font-display text-[clamp(36px,5.4vw,84px)] font-extrabold leading-[0.9]">{t('landing.screens.heading')}</h2>
        <ol className="mt-6 hidden space-y-1 lg:block">
          {STEPS.map((item, position) => (
            <li key={item.id} className={cn('rounded-[18px] p-4 transition-[opacity,background-color] duration-500 ease-out', position === index ? 'bg-black/[0.05] opacity-100' : 'opacity-40')}>
              <p className="flex items-center gap-2.5 font-display text-[24px] font-bold leading-tight">
                <item.icon aria-hidden className="h-5 w-5" />
                {t(item.title)}
              </p>
              <p className="mt-1 max-w-[44ch] text-[15px] leading-relaxed text-black/70">{t(item.text)}</p>
            </li>
          ))}
        </ol>
        <div className="mt-4 min-h-[96px] lg:hidden">
          <AnimatePresence mode="wait" initial={false}>
            <m.div key={step} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }}>
              <p className="flex items-center gap-2 font-display text-[22px] font-bold">{(() => { const Icon = STEPS[index].icon; return <Icon aria-hidden className="h-5 w-5" /> })()}{t(STEPS[index].title)}</p>
              <p className="mt-1 text-[15px] leading-relaxed text-black/70">{t(STEPS[index].text)}</p>
            </m.div>
          </AnimatePresence>
        </div>
        <div className="mt-5 flex flex-wrap gap-2.5">
          <Link href="/app" className="inline-flex h-11 items-center gap-1.5 rounded-full bg-black pe-4 ps-5 text-[14px] font-semibold text-white transition-transform active:scale-[0.97]">
            {t('landing.screens.apps')}<ChevronRight aria-hidden className="h-4 w-4 rtl:rotate-180" />
          </Link>
          <Link href="/desktop" className="inline-flex h-11 items-center gap-1.5 rounded-full bg-black/[0.07] pe-4 ps-5 text-[14px] font-semibold text-black transition-colors hover:bg-black/[0.12] active:scale-[0.97]">
            {t('landing.screens.desktop')}<ChevronRight aria-hidden className="h-4 w-4 rtl:rotate-180" />
          </Link>
        </div>
      </div>

      <div ref={stageBox} className="relative flex min-h-0 flex-1 items-center justify-center lg:h-[72svh]">
        <div className="relative flex flex-col items-center">
          <m.div
            className="relative overflow-hidden bg-black shadow-[0_50px_100px_-40px_rgb(0_0_0/0.55),0_0_0_1px_rgb(0_0_0/0.12)]"
            initial={false}
            animate={{ width: frame.width, height: frame.height, borderRadius: frame.radius, padding: frame.bezel }}
            transition={reduced ? { duration: 0 } : { type: 'spring', bounce: 0.18, duration: 0.85 }}
          >
            {step === 'computer' && (
              <div aria-hidden className="absolute inset-x-0 top-0 z-10 flex h-6 items-center gap-1.5 bg-[#1a1a1c] px-3">
                <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
              </div>
            )}
            <div className="relative h-full w-full overflow-hidden" style={{ borderRadius: Math.max(0, frame.radius - frame.bezel) }}>
              {STEPS.map((item) => (
                // eslint-disable-next-line @next/next/no-img-element -- static screenshots, sized by the frame
                <img
                  key={item.id}
                  src={item.screen}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className={cn('absolute inset-0 h-full w-full object-cover object-top transition-opacity duration-500', item.id === step ? 'opacity-100' : 'opacity-0', item.id === 'computer' && 'pt-6')}
                />
              ))}
              {step === 'phone' && <span aria-hidden className="absolute left-1/2 top-[1.6%] z-10 h-[3.4%] w-[30%] -translate-x-1/2 rounded-full bg-black" />}
            </div>
          </m.div>
          {/* The TV's stand. */}
          <AnimatePresence>
            {step === 'tv' && (
              <m.div aria-hidden initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.4, delay: 0.3 }} className="flex w-[46%] justify-between">
                <span className="h-5 w-2 -skew-x-[20deg] rounded-b-[3px] bg-black/80" />
                <span className="h-5 w-2 skew-x-[20deg] rounded-b-[3px] bg-black/80" />
              </m.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )

  if (reduced) {
    return (
      <section ref={section} aria-labelledby="landing-screens-title" className="bg-[#E8EAEC] py-16 lg:h-[100svh] lg:py-0">
        {body}
      </section>
    )
  }

  return (
    <section ref={section} aria-labelledby="landing-screens-title" className="relative h-[340svh]">
      <m.div className="sticky top-0 h-[100svh] overflow-hidden bg-[#E8EAEC]" style={{ clipPath: iris }}>
        {body}
      </m.div>
    </section>
  )
}
