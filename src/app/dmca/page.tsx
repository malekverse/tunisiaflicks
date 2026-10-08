import type { Metadata } from 'next'
import ContactForm from '@/src/components/ContactForm'
import LegalPage from '@/src/components/LegalPage'
import { getLegalDoc } from '@/src/lib/legal'
import { getLocale, getT } from '@/src/lib/i18n/server'
import { pageMetadata } from '@/src/lib/seo'

export function generateMetadata(): Metadata {
  const doc = getLegalDoc('dmca', getLocale())
  return pageMetadata({ title: doc.title, description: doc.description, path: '/dmca' })
}

export default function DmcaPage() {
  const t = getT()
  return (
    <LegalPage page="dmca" extra={{ id: 'notice', label: t('dmca.formTitle') }}>
      <section
        id="notice"
        aria-labelledby="notice-title"
        className="mt-14 scroll-mt-[calc(var(--topbar)+32px)] rounded-[22px] bg-white/[0.04] p-5 ring-1 ring-inset ring-white/[0.07] sm:p-8"
      >
        <h2 id="notice-title" className="mb-6 font-display text-[24px] font-bold leading-tight text-white sm:text-[28px]">{t('dmca.formTitle')}</h2>
        <ContactForm kind="dmca" />
      </section>
    </LegalPage>
  )
}
