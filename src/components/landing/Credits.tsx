"use client"
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Play } from 'lucide-react'
import { m, useInView, useScroll, useTransform } from 'framer-motion'
import { useI18n } from '@/src/components/I18nProvider'
import { BrandMark } from '@/src/components/brand/BrandMark'
import { Button } from '@/src/components/ui/button'
import { isArabicScript } from '@/src/lib/i18n/locales'
import type { TKey } from '@/src/lib/i18n'
import { cn } from '@/src/lib/utils'
import { Art, KineticText, Magnetic, useCalm } from './parts'
import { LOOKS, useStageLook } from './Stage'
import styles from './landing.module.css'

type Credit = { role: TKey, name?: TKey, names?: { text: string, lang: string }[], href?: string, circled?: boolean }

const CREDITS: Credit[] = [
  { role: 'landing.credits.dataRole', name: 'landing.credits.dataName', href: 'https://www.themoviedb.org' },
  { role: 'landing.credits.videoRole', names: [{ text: 'YouTube', lang: 'en' }] },
  { role: 'landing.credits.musicRole', names: [{ text: 'Deezer', lang: 'en' }] },
  { role: 'landing.credits.animeRole', names: [{ text: 'AniList', lang: 'en' }] },
  { role: 'landing.credits.playersRole', name: 'landing.credits.playersName' },
  { role: 'landing.credits.filesRole', name: 'landing.credits.filesName' },
  { role: 'landing.credits.accountRole', name: 'landing.credits.accountName' },
  {
    role: 'landing.credits.languagesRole',
    names: [{ text: 'English', lang: 'en' }, { text: 'Français', lang: 'fr' }, { text: 'العربية', lang: 'ar' }, { text: 'تونسي', lang: 'ar-TN' }],
  },
  { role: 'landing.credits.madeRole', name: 'landing.credits.madeName', circled: true },
]

/**
 * The end credits, rolling up the screen as you scroll: who the site's information comes from, what
 * it does and doesn't store, where it's made. Then the exit sign lights up and the film can start.
 */
export default function Credits() {
  const { t, locale } = useI18n()
  const arabic = isArabicScript(locale)
  const reduced = useCalm()
  const section = useRef<HTMLElement>(null)
  const roll = useRef<HTMLDivElement>(null)
  const end = useRef<HTMLDivElement>(null)
  const ended = useInView(end, { once: true, amount: 0.5 })
  const [rollHeight, setRollHeight] = useState(800)
  useStageLook(section, LOOKS.quiet)

  useEffect(() => {
    const element = roll.current
    if (!element) return
    const measure = () => setRollHeight(element.scrollHeight)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const { scrollYProgress } = useScroll({ target: section, offset: ['start start', 'end end'] })
  // From just below the screen to fully past its top.
  const y = useTransform(scrollYProgress, [0, 1], ['100svh', `-${rollHeight}px`])

  const list = (
    <div ref={roll} className="mx-auto max-w-[920px] px-[var(--gutter)] py-10">
      <h2 id="landing-credits-title" className="text-center font-display text-[clamp(30px,4vw,52px)] font-extrabold text-white/90">{t('landing.credits.heading')}</h2>
      <dl className="mt-12 space-y-9 sm:mt-16 sm:space-y-11">
        {CREDITS.map((credit) => (
          <div key={credit.role} className="grid grid-cols-1 gap-1 text-center sm:grid-cols-2 sm:gap-8 sm:text-start">
            <dt className="text-[13px] text-white/50 sm:text-end sm:text-[15px] sm:leading-[2.1]">{t(credit.role)}</dt>
            <dd className="font-display text-[22px] font-bold leading-tight text-white sm:text-[28px]">
              {credit.name && (
                credit.href ? (
                  <a href={credit.href} target="_blank" rel="noopener noreferrer" className="underline decoration-white/25 underline-offset-[6px] transition-colors hover:decoration-white">{t(credit.name)}</a>
                ) : credit.circled ? (
                  <span className="relative inline-block px-4 py-1">
                    <Art name="circle" draw delay={200} className="pointer-events-none absolute -inset-x-5 -inset-y-4 text-red-500/90" style={{ aspectRatio: 'auto', maskSize: '100% 100%', WebkitMaskSize: '100% 100%' }} />
                    <span className="relative">{t(credit.name)}</span>
                  </span>
                ) : t(credit.name)
              )}
              {credit.names && (
                <span className="flex flex-wrap justify-center gap-x-4 gap-y-1 sm:justify-start">
                  {credit.names.map((name) => <span key={name.text} lang={name.lang}>{name.text}</span>)}
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mx-auto mt-14 max-w-[52ch] text-center text-[13px] leading-relaxed text-white/50">{t('landing.credits.tmdbNote')}</p>
    </div>
  )

  return (
    <>
      {reduced ? (
        <section ref={section} aria-labelledby="landing-credits-title" className="py-20">{list}</section>
      ) : (
        <section ref={section} aria-labelledby="landing-credits-title" className="relative" style={{ height: `calc(100svh + ${rollHeight}px)` }}>
          <div className="sticky top-0 h-[100svh] overflow-hidden [mask-image:linear-gradient(transparent,#000_18%,#000_82%,transparent)]">
            <m.div style={{ y }}>{list}</m.div>
          </div>
        </section>
      )}

      <div ref={end} className="page-x flex min-h-[90svh] flex-col items-center justify-center py-20 text-center">
        <BrandMark className={cn('h-16 w-auto sm:h-20', ended && styles['exit-sign'])} />
        <h2 className={cn('mt-10 max-w-[16ch] text-balance font-display font-extrabold text-white', arabic ? 'text-[clamp(40px,6vw,88px)] leading-[1.15]' : 'text-[clamp(44px,7vw,112px)] leading-[0.9]')}>
          {ended ? <KineticText text={t('landing.end.title')} arabic={arabic} /> : <span className="opacity-0">{t('landing.end.title')}</span>}
        </h2>
        <Magnetic className="mt-10">
          <Button asChild size="lg" className="h-[54px] px-9 text-[16px]">
            <Link href="/"><Play aria-hidden className="h-[18px] w-[18px] fill-current" />{t('landing.end.cta')}</Link>
          </Button>
        </Magnetic>
        <p className="mt-12 text-[14px] text-white/60">{t('landing.credits.contact')}</p>
        <nav aria-label={t('footer.site')} className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-2 text-[14px] text-white/70">
          <Link href="/contact" className="underline-offset-4 hover:text-white hover:underline">{t('footer.contact')}</Link>
          <Link href="/dmca" className="underline-offset-4 hover:text-white hover:underline">{t('footer.dmca')}</Link>
          <Link href="/privacy" className="underline-offset-4 hover:text-white hover:underline">{t('footer.privacy')}</Link>
          <Link href="/terms" className="underline-offset-4 hover:text-white hover:underline">{t('footer.terms')}</Link>
        </nav>
      </div>
    </>
  )
}
