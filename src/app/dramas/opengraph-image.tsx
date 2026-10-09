import { OG_SIZE, renderSectionCard } from '@/src/lib/og'
import { dramaShareSection } from '@/src/lib/dramas'

// Share card for /dramas: both hubs' most popular posters this week. Drawn on request (never at
// build time, where next/og can't run on Windows) and kept by the CDN for a day (see lib/og).
export const dynamic = 'force-dynamic'
export const maxDuration = 30
export const alt = 'Turkish and Korean dramas on TunisiaFlicks'
export const size = OG_SIZE
export const contentType = 'image/jpeg'

export default async function Image() {
  const { posters, ...section } = dramaShareSection('index')
  return renderSectionCard({ ...section, posters: await posters().catch(() => []) })
}
