import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronRight, Copyright, Info, ShieldCheck, type LucideIcon } from 'lucide-react'
import ContactForm from '@/src/components/ContactForm'
import { getLocale, getT } from '@/src/lib/i18n/server'
import { getLegalDoc } from '@/src/lib/legal'
import type { TKey } from '@/src/lib/i18n'
import { pageMetadata } from '@/src/lib/seo'

export function generateMetadata(): Metadata {
  const t = getT()
  return pageMetadata({ title: t('contact.title'), description: t('contact.metaDesc'), path: '/contact' })
}

export default function ContactPage() {
  const t = getT()
  const locale = getLocale()
  // Other doors, for messages that belong somewhere else.
  const channels: { href: string, icon: LucideIcon, title: TKey, text: string }[] = [
    { href: '/dmca', icon: Copyright, title: 'footer.dmca', text: t('contact.dmcaHint') },
    { href: '/privacy', icon: ShieldCheck, title: 'footer.privacy', text: getLegalDoc('privacy', locale).description },
    { href: '/about', icon: Info, title: 'footer.about', text: getLegalDoc('about', locale).description },
  ]

  return (
    <div className="page-top pb-10">
      <div className="page-x">
        {/* Phones: intro, the form, then the other doors. Desktop: intro and doors on the start
            side, the form beside them. */}
        <div className="grid gap-10 pt-4 sm:pt-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,600px)] lg:grid-rows-[auto_1fr] lg:gap-x-16 lg:gap-y-12 xl:gap-x-28">
          <div className="max-w-[36rem]">
            <h1 className="text-balance font-display text-[clamp(34px,5vw,64px)] font-extrabold leading-[0.95] text-white">{t('contact.title')}</h1>
            <p className="mt-5 text-pretty text-[17px] leading-[1.7] text-white/75 sm:text-[19px]">{t('contact.intro')}</p>
          </div>

          <section aria-labelledby="contact-form-title" className="rounded-[22px] bg-white/[0.04] p-5 ring-1 ring-inset ring-white/[0.07] sm:rounded-stage sm:p-8 lg:col-start-2 lg:row-span-2 lg:row-start-1">
            <h2 id="contact-form-title" className="mb-6 font-display text-[24px] font-bold leading-tight text-white sm:text-[28px]">{t('contact.formTitle')}</h2>
            <ContactForm kind="contact" />
          </section>

          <nav aria-labelledby="contact-elsewhere" className="max-w-[36rem] lg:col-start-1 lg:row-start-2">
            <h2 id="contact-elsewhere" className="mb-3 text-[13px] font-medium text-white/50">{t('contact.elsewhere')}</h2>
            <ul className="overflow-hidden rounded-[22px] bg-white/[0.04] ring-1 ring-inset ring-white/[0.07]">
              {channels.map((channel, index) => {
                const Icon = channel.icon
                return (
                  <li key={channel.href} className={index > 0 ? 'border-t border-white/[0.06]' : undefined}>
                    <Link
                      href={channel.href}
                      className="group flex items-center gap-4 px-5 py-4 outline-none transition-colors duration-200 hover:bg-white/[0.04] focus-visible:bg-white/[0.06] active:bg-white/[0.06]"
                    >
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/[0.07]">
                        <Icon aria-hidden className="h-[18px] w-[18px] text-white/80" strokeWidth={1.8} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] font-medium text-white">{t(channel.title)}</span>
                        <span className="mt-0.5 block text-[13px] leading-snug text-white/55">{channel.text}</span>
                      </span>
                      <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-white/35 transition-transform duration-200 group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>
        </div>
      </div>
    </div>
  )
}
