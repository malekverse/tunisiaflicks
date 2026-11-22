import GuessApp from '@/src/components/guess/GuessApp'
import { getT } from '@/src/lib/i18n/server'
import { pageMetadata } from '@/src/lib/seo'

// Guess the film: the page carries no data (the day's puzzle comes from /api/guess/[day], cached by
// the CDN, and the games stay on the device), so it's the same static page for everyone.
export function generateMetadata() {
  const t = getT()
  return pageMetadata({ title: t('guess.title'), description: t('guess.subtitle'), path: '/guess', card: 'guess' })
}

export default function GuessPage() {
  return <GuessApp />
}
