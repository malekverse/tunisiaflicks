import SwipeRoom from '@/src/components/swipe/SwipeRoom'
import { getT } from '@/src/lib/i18n/server'

export const dynamic = 'force-dynamic'

export function generateMetadata({ params }: { params: { code: string } }) {
  const t = getT()
  return {
    title: `${t('swipe.title')} · ${params.code.toUpperCase()} | TunisiaFlicks`,
    description: t('swipe.inviteText'),
    robots: { index: false },
  }
}

export default function SwipeRoomPage({ params }: { params: { code: string } }) {
  return <SwipeRoom code={params.code.toUpperCase()} />
}
