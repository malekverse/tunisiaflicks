import { OG_SIZE, renderFallbackCard, renderWrappedCard } from '@/src/lib/og'
import { getShare } from '@/src/lib/wrapped'

// Link preview for a shared year recap.
export const revalidate = 300
export const alt = 'A year on TunisiaFlicks'
export const size = OG_SIZE
export const contentType = 'image/jpeg'

export default async function Image({ params }: { params: { token: string } }) {
  const share = await getShare(params.token)
  return share ? renderWrappedCard(share.stats, 'og') : renderFallbackCard()
}
