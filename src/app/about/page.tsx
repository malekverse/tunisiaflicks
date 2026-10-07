import type { Metadata } from 'next'
import LegalPage from '@/src/components/LegalPage'
import { getLegalDoc } from '@/src/lib/legal'
import { getLocale } from '@/src/lib/i18n/server'

export function generateMetadata(): Metadata {
  const doc = getLegalDoc('about', getLocale())
  return { title: `${doc.title} | TunisiaFlicks`, description: doc.description }
}

export default function AboutPage() {
  return <LegalPage page="about" />
}
