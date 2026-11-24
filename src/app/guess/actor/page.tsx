import ActorGuessApp from '@/src/components/guess/ActorGuessApp'
import { getT } from '@/src/lib/i18n/server'
import { pageMetadata } from '@/src/lib/seo'

// Guess the actor: like Guess the film, the page carries no data (the day's puzzle comes from
// /api/guess/actor/[day], cached by the CDN, and the games stay on the device).
export function generateMetadata() {
  const t = getT()
  return pageMetadata({ title: t('guessActor.title'), description: t('guessActor.subtitle'), path: '/guess/actor', card: 'guess' })
}

export default function GuessActorPage() {
  return <ActorGuessApp />
}
