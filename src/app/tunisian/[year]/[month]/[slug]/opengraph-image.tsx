import { getTunisianDetail } from '@/src/lib/tunisian'
import { SHARE_CARD_SIZE, keptShareImage } from '@/src/lib/share-image-store'

// Share card for a title of the Tunisian catalogue.
export const dynamic = 'force-dynamic'
export const maxDuration = 30
export const alt = 'A Tunisian title on TunisiaFlicks'
export const size = SHARE_CARD_SIZE
export const contentType = 'image/jpeg'

async function draw({ params }: { params: { year: string, month: string, slug: string } }) {
  // The drawing code loads only when a card has to be drawn (a kept card never needs it).
  const { renderTunisianCard } = await import('@/src/lib/og')
  const { renderSection } = await import('@/src/lib/share-sections')
  const detail = await getTunisianDetail(`${params.year}/${params.month}/${params.slug}`)
  if (!detail) return renderSection('tunisian')
  return renderTunisianCard({
    kind: detail.kind,
    title: detail.title,
    poster: detail.poster,
    backdrop: detail.backdrop,
    badges: detail.badges,
    line: detail.description,
  })
}

/** Kept once drawn, so a crawler never waits (lib/share-image-store). */
export default function Image({ params }: { params: { year: string, month: string, slug: string } }) {
  return keptShareImage(`tunisian/${params.year}/${params.month}/${params.slug}`, () => draw({ params }))
}
