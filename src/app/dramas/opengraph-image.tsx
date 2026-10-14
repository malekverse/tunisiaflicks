import { dramaShareSection } from '@/src/lib/dramas'
import { SHARE_CARD_SIZE, keptShareImage } from '@/src/lib/share-image-store'

// Share card for /dramas: both hubs' most popular posters this week. Drawn on request (never at
// build time, where next/og can't run on Windows) and kept by the CDN for a day (see lib/og).
export const dynamic = 'force-dynamic'
export const maxDuration = 30
export const alt = 'Turkish and Korean dramas on TunisiaFlicks'
export const size = SHARE_CARD_SIZE
export const contentType = 'image/jpeg'

async function draw() {
  // The drawing code loads only when a card has to be drawn (a kept card never needs it).
  const { renderSectionCard } = await import('@/src/lib/og')
  const { posters, ...section } = dramaShareSection('index')
  return renderSectionCard({ ...section, posters: await posters().catch(() => []) })
}

/** Kept once drawn, so a crawler never waits (lib/share-image-store). */
export default function Image() {
  return keptShareImage('dramas', draw)
}
