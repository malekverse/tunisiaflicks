import type { Metadata } from 'next'
import LegalPage from '@/src/components/LegalPage'
import { getLegalDoc } from '@/src/lib/legal'
import { getLocale } from '@/src/lib/i18n/server'
import { pageMetadata } from '@/src/lib/seo'

export function generateMetadata(): Metadata {
  const doc = getLegalDoc('about', getLocale())
  return pageMetadata({ title: doc.title, description: doc.description, path: '/about' })
}

export default function AboutPage() {
  return <LegalPage page="about" />
}
