import { arabCinemaShareSection } from '@/src/lib/arab-cinema'
import { isArabCountry } from '@/src/lib/arab-countries'
import { SHARE_CARD_SIZE, keptShareImage } from '@/src/lib/share-image-store'

// Share card for /arab-cinema/[country]: the country's best-known films and series, in the map's
// sand light. Drawn on request, never at build time (next/og can't run during a Windows build, and
// this segment lists its params for the router), then kept by the CDN for a day (see lib/og).
// Anything that isn't a country on the map gets the brand card.
export const dynamic = 'force-dynamic'
export const maxDuration = 30
export const alt = 'A country on the Arab cinema map, on TunisiaFlicks'
export const size = SHARE_CARD_SIZE
export const contentType = 'image/jpeg'

async function draw({ params }: { params: { country: string } }) {
  // The drawing code loads only when a card has to be drawn (a kept card never needs it).
  const { renderFallbackCard, renderSectionCard } = await import('@/src/lib/og')
  const code = params.country.toLowerCase()
  if (!isArabCountry(code) || code === 'tn') return renderFallbackCard()
  const { posters, ...section } = arabCinemaShareSection(code)
  return renderSectionCard({ ...section, posters: await posters().catch(() => []) })
}

/** Kept once drawn, so a crawler never waits (lib/share-image-store). */
export default function Image({ params }: { params: { country: string } }) {
  return keptShareImage(`arab-cinema/${params.country}`, () => draw({ params }))
}
