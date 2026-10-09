import { OG_SIZE, renderFallbackCard, renderSectionCard } from '@/src/lib/og'
import { arabCinemaShareSection } from '@/src/lib/arab-cinema'
import { isArabCountry } from '@/src/lib/arab-countries'

// Share card for /arab-cinema/[country]: the country's best-known films and series, in the map's
// sand light. Drawn on request, never at build time (next/og can't run during a Windows build, and
// this segment lists its params for the router), then kept by the CDN for a day (see lib/og).
// Anything that isn't a country on the map gets the brand card.
export const dynamic = 'force-dynamic'
export const maxDuration = 30
export const alt = 'A country on the Arab cinema map, on TunisiaFlicks'
export const size = OG_SIZE
export const contentType = 'image/jpeg'

export default async function Image({ params }: { params: { country: string } }) {
  const code = params.country.toLowerCase()
  if (!isArabCountry(code) || code === 'tn') return renderFallbackCard()
  const { posters, ...section } = arabCinemaShareSection(code)
  return renderSectionCard({ ...section, posters: await posters().catch(() => []) })
}
