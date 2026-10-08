import { OG_SIZE, renderFallbackCard, renderSectionCard } from '@/src/lib/og'
import { dramaShareSection } from '@/src/lib/dramas'
import { isHubId } from '@/src/lib/dramas-config'

// Share card for /dramas/turkish and /dramas/korean: the hub's most popular posters this week,
// in its light. Re-rendered every six hours, so it follows the charts.
export const revalidate = 21600
export const maxDuration = 30
export const alt = 'Turkish and Korean dramas on TunisiaFlicks'
export const size = OG_SIZE
export const contentType = 'image/jpeg'

export default async function Image({ params }: { params: { hub: string } }) {
  if (!isHubId(params.hub)) return renderFallbackCard()
  const { posters, ...section } = dramaShareSection(params.hub)
  return renderSectionCard({ ...section, posters: await posters().catch(() => []) })
}
