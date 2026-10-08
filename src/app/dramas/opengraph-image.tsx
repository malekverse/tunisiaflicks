import { OG_SIZE, renderSectionCard } from '@/src/lib/og'
import { dramaShareSection } from '@/src/lib/dramas'

// Share card for /dramas: both hubs' most popular posters this week. Re-rendered every six hours.
export const revalidate = 21600
export const maxDuration = 30
export const alt = 'Turkish and Korean dramas on TunisiaFlicks'
export const size = OG_SIZE
export const contentType = 'image/jpeg'

export default async function Image() {
  const { posters, ...section } = dramaShareSection('index')
  return renderSectionCard({ ...section, posters: await posters().catch(() => []) })
}
