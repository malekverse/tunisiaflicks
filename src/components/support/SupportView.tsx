// The body of /support (src/app/support/page.tsx): why it's free, what it costs, the coffee, the
// code, the thank-you list. Server component; the code itself loads in the browser (SupportCode).
import Link from 'next/link'
import { Clock, Globe, Lock, Mail, Server } from 'lucide-react'
import { SiKofi } from 'react-icons/si'
import { withCallback } from '@/src/components/auth/links'
import PageHeader from '@/src/components/browse/PageHeader'
import BadgeArt from '@/src/components/badges/BadgeArt'
import { Button } from '@/src/components/ui/button'
import { getT } from '@/src/lib/i18n/server'
import SupportCode from './SupportCode'

export const SUPPORT_PANEL = 'rounded-[22px] bg-white/[0.04] p-5 ring-1 ring-white/[0.07] sm:p-7'
const PANEL = SUPPORT_PANEL

function PanelTitle({ children, id }: { children: React.ReactNode; id: string }) {
  return <h2 id={id} className="font-display text-[22px] font-bold leading-tight text-white sm:text-[26px]">{children}</h2>
}

export default function SupportView({ url, signedIn, credits }: {
  /** The Ko-fi page (https). */
  url: string
  signedIn: boolean
  /** Names of the supporters who asked to be thanked. */
  credits: string[]
}) {
  const t = getT()
  const costs = [
    { icon: Server, text: t('support.costs.hosting') },
    { icon: Mail, text: t('support.costs.mail') },
    { icon: Globe, text: t('support.costs.domain') },
    { icon: Clock, text: t('support.costs.time') },
  ]

  return (
    <div className="pb-10">
      <PageHeader title={t('support.title')} subtitle={t('support.subtitle')} />

      <div className="page-x grid gap-5 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start">
        <div className="space-y-5 sm:space-y-6">
          <section aria-labelledby="support-why" className={PANEL}>
            <PanelTitle id="support-why">{t('support.why.title')}</PanelTitle>
            <p className="mt-3 max-w-[60ch] text-[15px] leading-relaxed text-white/70">{t('support.why.text')}</p>
          </section>

          <section aria-labelledby="support-costs" className={PANEL}>
            <PanelTitle id="support-costs">{t('support.costs.title')}</PanelTitle>
            <p className="mt-3 max-w-[60ch] text-[15px] leading-relaxed text-white/70">{t('support.costs.text')}</p>
            <ul className="mt-5 space-y-3">
              {costs.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-3 text-[15px] text-white/80">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/[0.06] text-white/60">
                    <Icon aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.9} />
                  </span>
                  {text}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="space-y-5 sm:space-y-6">
          {/* The one bright thing on the page: the Supporter medallion, lit like a picture on screen. */}
          <section aria-labelledby="support-coffee" className="relative isolate overflow-hidden rounded-stage bg-white/[0.04] p-6 ring-1 ring-white/[0.08] sm:p-9">
            <div aria-hidden className="absolute -top-32 start-1/2 -z-10 h-80 w-[28rem] -translate-x-1/2 rounded-full bg-[rgb(214_178_96/0.16)] blur-3xl rtl:translate-x-1/2" />
            <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:gap-8">
              <span className="relative shrink-0">
                <span aria-hidden className="absolute inset-3 rounded-full shadow-[0_0_60px_12px_rgb(214_178_96/0.28)]" />
                <BadgeArt id="supporter" level={3} size={120} className="relative" />
              </span>
              <div className="min-w-0">
                <PanelTitle id="support-coffee">{t('support.coffee.title')}</PanelTitle>
                <p className="mt-3 max-w-[46ch] text-[15px] leading-relaxed text-white/70">{t('support.coffee.text')}</p>
                <Button asChild size="lg" className="mt-6">
                  <a href={url} target="_blank" rel="noopener noreferrer">
                    <SiKofi aria-hidden className="h-5 w-5" />
                    {t('support.coffee.button')}
                    <span className="sr-only"> {t('support.coffee.newTab')}</span>
                  </a>
                </Button>
              </div>
            </div>
            <p className="mt-7 flex items-start gap-2 border-t border-white/[0.07] pt-5 text-[13px] leading-relaxed text-white/55">
              <Lock aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} />
              {t('support.coffee.privacy')}
            </p>
          </section>

          <section aria-labelledby="support-already" className={PANEL}>
            <PanelTitle id="support-already">{t('support.already.title')}</PanelTitle>
            <p className="mt-3 max-w-[60ch] text-[15px] leading-relaxed text-white/70">{t('support.already.text')}</p>
            {signedIn ? (
              <SupportCode />
            ) : (
              <Button asChild variant="secondary" className="mt-5">
                <Link href={withCallback('/login', '/support')}>{t('support.already.signIn')}</Link>
              </Button>
            )}
          </section>
        </div>

        <section aria-labelledby="support-credits" className={`${PANEL} lg:col-span-2`}>
          <PanelTitle id="support-credits">{t('support.credits.title')}</PanelTitle>
          <p className="mt-2 text-[14px] text-white/60">{t('support.credits.text')}</p>
          {credits.length > 0 ? (
            <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2.5">
              {credits.map((name, index) => (
                <li key={`${index}:${name}`} className="text-[15px] font-medium text-white/85"><bdi>{name}</bdi></li>
              ))}
            </ul>
          ) : (
            <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-3">
              <p className="text-[15px] text-white/60">{t('support.credits.empty')}</p>
              {signedIn && (
                <Link href="/profile#supporter" className="rounded-md text-[14px] font-medium text-white/80 underline decoration-white/30 underline-offset-4 outline-none transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-red-500">
                  {t('support.credits.settings')}
                </Link>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
