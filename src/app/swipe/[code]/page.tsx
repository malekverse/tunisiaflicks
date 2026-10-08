import SwipeRoom from '@/src/components/swipe/SwipeRoom'
import { getT } from '@/src/lib/i18n/server'
import { pageMetadata } from '@/src/lib/seo'

export const dynamic = 'force-dynamic'

export function generateMetadata({ params }: { params: { code: string } }) {
  const t = getT()
  // The invitation card comes from ./opengraph-image.tsx (card: false).
  return pageMetadata({
    title: `${t('swipe.title')} (${params.code.toUpperCase()})`,
    description: t('swipe.inviteText'),
    path: `/swipe/${params.code.toUpperCase()}`,
    card: false,
    noIndex: true,
  })
}

export default function SwipeRoomPage({ params }: { params: { code: string } }) {
  return <SwipeRoom code={params.code.toUpperCase()} />
}
