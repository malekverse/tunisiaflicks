import DecideApp from '@/src/components/decide/DecideApp'
import { getT } from '@/src/lib/i18n/server'
import { pageMetadata } from '@/src/lib/seo'

// Decide together: everything happens in the browser (names, picks, the wheel, the votes), so the
// page itself carries no data.
export function generateMetadata() {
  const t = getT()
  return pageMetadata({ title: t('decide.title'), description: t('decide.subtitle'), path: '/decide', card: 'decide' })
}

export default function DecidePage() {
  return <DecideApp />
}
