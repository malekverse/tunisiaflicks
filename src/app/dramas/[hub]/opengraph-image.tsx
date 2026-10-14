import { OG_SIZE, renderFallbackCard, renderSectionCard } from '@/src/lib/og'
import { dramaShareSection } from '@/src/lib/dramas'
import { isHubId } from '@/src/lib/dramas-config'
import { keptShareImage } from '@/src/lib/share-image-store'

// Share card for /dramas/turkish and /dramas/korean: the hub's most popular posters this week,
// in its light. Re-rendered every six hours, so it follows the charts.
export const dynamic = 'force-dynamic'
export const maxDuration = 30
export const alt = 'Turkish and Korean dramas on TunisiaFlicks'
export const size = OG_SIZE
export const contentType = 'image/jpeg'

async function draw({ params }: { params: { hub: string } }) {
  if (!isHubId(params.hub)) return renderFallbackCard()
  const { posters, ...section } = dramaShareSection(params.hub)
  return renderSectionCard({ ...section, posters: await posters().catch(() => []) })
}

/** Kept once drawn, so a crawler never waits (lib/share-image-store). */
export default function Image({ params }: { params: { hub: string } }) {
  return keptShareImage(`dramas/${params.hub}`, () => draw({ params }))
}
