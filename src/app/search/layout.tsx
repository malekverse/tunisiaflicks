import { getT } from '@/src/lib/i18n/server'
import { pageMetadata } from '@/src/lib/seo'
import { getKidsMode } from '@/src/lib/profiles'
import { isTvMode } from '@/src/lib/tv-mode'
import { aiSearchEnabled } from '@/src/lib/ai-search/config'
import { AskAvailableProvider } from '@/src/components/search/ai/AskContext'
import ClientMessages from '@/src/components/ClientMessages'

// The search page is a client component, so its metadata lives here.
export function generateMetadata() {
  const t = getT()
  return pageMetadata({ title: t('nav.search'), description: t('search.description'), path: '/search', card: 'search', noIndex: true })
}

/**
 * Tells the page whether it offers Ask (the site has it, the profile isn't Kids, not TV mode), and
 * hands it its strings (see ClientMessages).
 */
export default async function SearchLayout({ children }: { children: React.ReactNode }) {
  const ask = aiSearchEnabled() && !isTvMode() && !(await getKidsMode())
  return (
    <ClientMessages scope="search/layout">
      <AskAvailableProvider value={ask}>{children}</AskAvailableProvider>
    </ClientMessages>
  )
}
