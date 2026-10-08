import { getT } from '@/src/lib/i18n/server'
import { pageMetadata } from '@/src/lib/seo'

// The search page is a client component, so its metadata lives here.
export function generateMetadata() {
  const t = getT()
  return pageMetadata({ title: t('nav.search'), description: t('search.description'), path: '/search', card: 'search', noIndex: true })
}

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return children
}
