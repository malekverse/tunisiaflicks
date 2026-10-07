import type { Metadata } from 'next'
import Link from 'next/link'
import ContactForm from '@/src/components/ContactForm'
import { getT } from '@/src/lib/i18n/server'

export function generateMetadata(): Metadata {
  const t = getT()
  return { title: `${t('contact.title')} | TunisiaFlicks`, description: t('contact.metaDesc') }
}

export default function ContactPage() {
  const t = getT()
  return (
    <div className="w-full max-w-2xl px-4 sm:px-6 pb-8">
      <h1 className="text-3xl sm:text-4xl font-bold">{t('contact.title')}</h1>
      <p className="mt-4 text-lg leading-relaxed text-gray-700 dark:text-gray-300">{t('contact.intro')}</p>
      <p className="mt-2 text-sm text-gray-500">
        <Link href="/dmca" className="text-red-500 hover:underline">{t('contact.dmcaHint')}</Link>
      </p>
      <div className="mt-8 rounded-2xl border border-gray-200 p-5 sm:p-6 dark:border-zinc-800">
        <ContactForm kind="contact" />
      </div>
    </div>
  )
}
