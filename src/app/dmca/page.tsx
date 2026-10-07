import type { Metadata } from 'next'
import ContactForm from '@/src/components/ContactForm'
import LegalPage from '@/src/components/LegalPage'
import { getLegalDoc } from '@/src/lib/legal'
import { getLocale, getT } from '@/src/lib/i18n/server'

export function generateMetadata(): Metadata {
  const doc = getLegalDoc('dmca', getLocale())
  return { title: `${doc.title} | TunisiaFlicks`, description: doc.description }
}

export default function DmcaPage() {
  const t = getT()
  return (
    <LegalPage page="dmca">
      <section id="notice" className="mt-10 rounded-2xl border border-gray-200 p-5 sm:p-6 dark:border-zinc-800">
        <h2 className="mb-4 text-xl font-semibold">{t('dmca.formTitle')}</h2>
        <ContactForm kind="dmca" />
      </section>
    </LegalPage>
  )
}
