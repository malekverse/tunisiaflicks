// /desktop (public): TunisiaFlicks for Windows, the desktop app (desktop/ in this repo). The whole
// site in its own window, with its own ad-free player first in the source bar and every pop-up
// blocked. The installer comes from the newest desktop-v… GitHub release (src/lib/app-releases.ts).
import type { Metadata } from 'next'
import { AppWindow, Check, ChevronDown, Minus, Monitor, Play, ShieldBan, UsersRound } from 'lucide-react'
import TmdbImage from '@/src/components/TmdbImage'
import { BrandMark } from '@/src/components/brand/BrandMark'
import { FileDetails } from '@/src/components/apps/AppDevices'
import AppWindowMock from '@/src/components/desktop/AppWindowMock'
import DesktopDownload from '@/src/components/desktop/DesktopDownload'
import { getDesktopRelease } from '@/src/lib/app-releases'
import { showcaseFilm } from '@/src/lib/desktop-showcase'
import type { TKey } from '@/src/lib/i18n'
import { getT } from '@/src/lib/i18n/server'
import { pageMetadata } from '@/src/lib/seo'
import { cn } from '@/src/lib/utils'
import { withTimeout } from '@/src/lib/with-timeout'

export function generateMetadata(): Metadata {
  const t = getT()
  return pageMetadata({ title: t('desktop.meta.title'), description: t('desktop.meta.desc'), path: '/desktop' })
}

const FEATURES: { icon: typeof Play, title: TKey, text: TKey }[] = [
  { icon: Play, title: 'desktop.features.player.title', text: 'desktop.features.player.text' },
  { icon: ShieldBan, title: 'desktop.features.popups.title', text: 'desktop.features.popups.text' },
  { icon: UsersRound, title: 'desktop.features.same.title', text: 'desktop.features.same.text' },
  { icon: AppWindow, title: 'desktop.features.home.title', text: 'desktop.features.home.text' },
]

/** What the app has, and whether the site in a browser has it too. */
const COMPARE: [TKey, boolean][] = [
  ['desktop.compare.player', false],
  ['desktop.compare.popups', false],
  ['desktop.compare.account', true],
  ['desktop.compare.window', true],
]

const STEPS: [TKey, TKey][] = [
  ['desktop.steps.download.title', 'desktop.steps.download.text'],
  ['desktop.steps.install.title', 'desktop.steps.install.text'],
  ['desktop.steps.play.title', 'desktop.steps.play.text'],
]

const FAQ: [TKey, TKey][] = [
  ['desktop.faq.free.q', 'desktop.faq.free.a'],
  ['desktop.faq.how.q', 'desktop.faq.how.a'],
  ['desktop.faq.missing.q', 'desktop.faq.missing.a'],
  ['desktop.faq.warning.q', 'desktop.faq.warning.a'],
  ['desktop.faq.other.q', 'desktop.faq.other.a'],
]

const SECTION_TITLE = 'text-balance font-display text-[clamp(28px,3.6vw,46px)] font-extrabold leading-[0.98] text-white'

export default async function DesktopPage() {
  const t = getT()
  const [release, film] = await Promise.all([
    withTimeout(getDesktopRelease(), 4500, null),
    withTimeout(showcaseFilm(), 2500, null),
  ])

  const mark = (yes: boolean) => yes
    ? <><Check aria-hidden className="mx-auto h-5 w-5 text-emerald-400" strokeWidth={2.4} /><span className="sr-only">{t('desktop.compare.yes')}</span></>
    : <><Minus aria-hidden className="mx-auto h-5 w-5 text-white/30" /><span className="sr-only">{t('desktop.compare.no')}</span></>

  return (
    <div className="overflow-x-clip pb-14">
      {/* The promise, and the app doing it. */}
      <section className="page-x page-top relative isolate">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-32 -z-10 h-[760px] bg-[radial-gradient(55%_50%_at_72%_45%,rgb(255_36_20/0.16),transparent_72%)] rtl:bg-[radial-gradient(55%_50%_at_28%_45%,rgb(255_36_20/0.16),transparent_72%)]" />
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.15fr)] lg:gap-14 xl:gap-20">
          <div className="min-w-0 animate-focus-in">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-3.5 py-1.5 text-[13px] font-medium text-white/80 ring-1 ring-white/[0.08]">
              <Monitor aria-hidden className="h-4 w-4 text-red-500" />{t('desktop.hero.badge')}
            </p>
            <h1 className="mt-5 text-balance font-display text-[clamp(44px,6.4vw,92px)] font-extrabold leading-[0.9] text-white">{t('desktop.hero.title')}</h1>
            <p className="mt-6 max-w-[50ch] text-[16px] leading-relaxed text-white/70 sm:text-[17.5px]">{t('desktop.hero.text')}</p>
            <div className="mt-8"><DesktopDownload release={release} /></div>
            <a href="#inside" className="mt-8 inline-flex items-center gap-1.5 text-[14px] font-medium text-white/60 outline-none transition-colors hover:text-white focus-visible:text-white">
              {t('desktop.hero.more')}<ChevronDown aria-hidden className="h-4 w-4" />
            </a>
          </div>
          <AppWindowMock film={film} priority className="lg:-me-[min(4vw,48px)]" />
        </div>
      </section>

      {/* What's inside. */}
      <section id="inside" aria-labelledby="inside-title" className="page-x mt-24 scroll-mt-[calc(var(--topbar)+24px)] sm:mt-32">
        <h2 id="inside-title" className={SECTION_TITLE}>{t('desktop.features.title')}</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, text }, index) => (
            <div key={title} className="rounded-[22px] bg-white/[0.04] p-6 ring-1 ring-white/[0.07]">
              <span className={cn('grid h-12 w-12 place-items-center rounded-full', index === 0 ? 'bg-red-600 text-white shadow-[0_10px_30px_-10px_rgb(255_36_20/0.8)]' : 'bg-white/[0.07] text-white')}>
                <Icon aria-hidden className={cn('h-5 w-5', index === 0 && 'ms-0.5 fill-current rtl:-scale-x-100')} strokeWidth={1.9} />
              </span>
              <h3 className="mt-6 font-display text-[21px] font-bold leading-tight text-white">{t(title)}</h3>
              <p className="mt-2.5 text-[14.5px] leading-relaxed text-white/65">{t(text)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* The app or the browser, and how to get it. */}
      <section className="page-x mt-24 grid gap-14 sm:mt-32 lg:grid-cols-2 lg:gap-12">
        <div aria-labelledby="compare-title">
          <h2 id="compare-title" className={SECTION_TITLE}>{t('desktop.compare.title')}</h2>
          <div className="mt-8 overflow-hidden rounded-[22px] bg-white/[0.04] ring-1 ring-white/[0.07]">
            <table className="w-full text-[14.5px]">
              <thead>
                <tr className="text-[13px] text-white/55">
                  <th scope="col" className="px-5 py-4 text-start font-medium">{t('desktop.compare.feature')}</th>
                  <th scope="col" className="w-[24%] bg-white/[0.04] px-3 py-4 text-center font-semibold text-white">{t('desktop.compare.app')}</th>
                  <th scope="col" className="w-[22%] px-3 py-4 text-center font-medium">{t('desktop.compare.browser')}</th>
                </tr>
              </thead>
              <tbody>
                {COMPARE.map(([key, browser]) => (
                  <tr key={key} className="border-t border-white/[0.06]">
                    <th scope="row" className="px-5 py-4 text-start font-normal text-white/80">{t(key)}</th>
                    <td className="bg-white/[0.04] px-3 py-4">{mark(true)}</td>
                    <td className="px-3 py-4">{mark(browser)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div aria-labelledby="steps-title">
          <h2 id="steps-title" className={SECTION_TITLE}>{t('desktop.steps.title')}</h2>
          <ol className="mt-8 space-y-3">
            {STEPS.map(([title, text], index) => (
              <li key={title} className="flex gap-4 rounded-[22px] bg-white/[0.04] p-5 ring-1 ring-white/[0.07]">
                <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/[0.08] font-display text-[18px] font-bold text-white">{index + 1}</span>
                <div className="min-w-0 pt-1">
                  <h3 className="text-[16px] font-semibold text-white">{t(title)}</h3>
                  <p className="mt-1 text-[14.5px] leading-relaxed text-white/65">{t(text)}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Questions. */}
      <section aria-labelledby="faq-title" className="page-x mt-24 sm:mt-32">
        <h2 id="faq-title" className={SECTION_TITLE}>{t('desktop.faq.title')}</h2>
        <div className="mt-8 divide-y divide-white/[0.07] rounded-[22px] bg-white/[0.04] ring-1 ring-white/[0.07]">
          {FAQ.map(([question, answer]) => (
            <details key={question} className="group px-5 sm:px-6">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-[16px] font-semibold text-white outline-none focus-visible:text-red-400 [&::-webkit-details-marker]:hidden">
                {t(question)}
                <ChevronDown aria-hidden className="h-5 w-5 shrink-0 text-white/50 transition-transform duration-200 group-open:rotate-180" />
              </summary>
              <p className="max-w-[70ch] pb-5 text-[15px] leading-relaxed text-white/65">{t(answer)}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Once more, with the film behind it. */}
      <section aria-labelledby="cta-title" className="page-x mt-24 sm:mt-32">
        <div className="relative isolate overflow-hidden rounded-stage px-6 py-14 text-center ring-1 ring-white/[0.08] sm:px-10 sm:py-20">
          {film && <TmdbImage kind="backdrop" path={film.backdrop} alt="" fill sizes="(min-width: 1400px) 1400px, 100vw" className="-z-20 object-cover opacity-35" />}
          <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-black via-black/80 to-black/50" />
          <BrandMark className="mx-auto h-11 w-auto" />
          <h2 id="cta-title" className="mx-auto mt-6 max-w-[16ch] text-balance font-display text-[clamp(32px,4.6vw,60px)] font-extrabold leading-[0.95] text-white">{t('desktop.cta.title')}</h2>
          <div className="mt-8"><DesktopDownload release={release} centered /></div>
          {release && (
            <div className="mx-auto mt-6 max-w-xl text-start">
              <FileDetails file={release.file} releases={release} version={false} />
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
