import { getShare } from '@/src/lib/wrapped'
import { SHARE_CARD_SIZE, keptShareImage } from '@/src/lib/share-image-store'

// Link preview for a shared year recap.
export const dynamic = 'force-dynamic'
export const maxDuration = 30
export const alt = 'A year on TunisiaFlicks'
export const size = SHARE_CARD_SIZE
export const contentType = 'image/jpeg'

async function draw({ params }: { params: { token: string } }) {
  // The drawing code loads only when a card has to be drawn (a kept card never needs it).
  const { renderFallbackCard, renderWrappedCard } = await import('@/src/lib/og')
  const share = await getShare(params.token)
  return share ? renderWrappedCard(share.stats, 'og') : renderFallbackCard()
}

/** Kept once drawn, so a crawler never waits (lib/share-image-store). */
export default function Image({ params }: { params: { token: string } }) {
  return keptShareImage(`wrapped/${params.token}`, () => draw({ params }), { personal: true })
}
