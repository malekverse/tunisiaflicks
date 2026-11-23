import MusicGuessApp from '@/src/components/guess/MusicGuessApp'
import { getT } from '@/src/lib/i18n/server'
import { pageMetadata } from '@/src/lib/seo'

// Guess the film from its music: like Guess the film, the page carries no data (the day's puzzle
// comes from /api/guess/music/[day], cached by the CDN, and the games stay on the device).
export function generateMetadata() {
  const t = getT()
  return pageMetadata({ title: t('guessMusic.title'), description: t('guessMusic.subtitle'), path: '/guess/music', card: 'guess' })
}

export default function GuessMusicPage() {
  return <MusicGuessApp />
}
