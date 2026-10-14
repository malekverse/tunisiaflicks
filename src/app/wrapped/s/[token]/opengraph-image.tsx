import { OG_SIZE, renderFallbackCard, renderWrappedCard } from '@/src/lib/og'
import { getShare } from '@/src/lib/wrapped'
import { keptShareImage } from '@/src/lib/share-image-store'

// Link preview for a shared year recap.
export const dynamic = 'force-dynamic'
export const maxDuration = 30
export const alt = 'A year on TunisiaFlicks'
export const size = OG_SIZE
export const contentType = 'image/jpeg'

async function draw({ params }: { params: { token: string } }) {
  const share = await getShare(params.token)
  return share ? renderWrappedCard(share.stats, 'og') : renderFallbackCard()
}

/** Kept once drawn, so a crawler never waits (lib/share-image-store). */
export default function Image({ params }: { params: { token: string } }) {
  return keptShareImage(`wrapped/${params.token}`, () => draw({ params }), { personal: true })
}
