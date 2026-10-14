import { arabCinemaShareSection } from '@/src/lib/arab-cinema'
import { SHARE_CARD_SIZE, keptShareImage } from '@/src/lib/share-image-store'

// Share card for /arab-cinema: today's film from each country, in the map's sand light. Drawn on
// request (never at build time, where next/og can't run on Windows) and kept by the CDN for a day
// (see lib/og), like the drama hubs' index card.
export const dynamic = 'force-dynamic'
export const maxDuration = 30
export const alt = 'The Arab cinema map on TunisiaFlicks'
export const size = SHARE_CARD_SIZE
export const contentType = 'image/jpeg'

async function draw() {
  // The drawing code loads only when a card has to be drawn (a kept card never needs it).
  const { renderSectionCard } = await import('@/src/lib/og')
  const { posters, ...section } = arabCinemaShareSection()
  return renderSectionCard({ ...section, posters: await posters().catch(() => []) })
}

/** Kept once drawn, so a crawler never waits (lib/share-image-store). */
export default function Image() {
  return keptShareImage('arab-cinema', draw)
}
