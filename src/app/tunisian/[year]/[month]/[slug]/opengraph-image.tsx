import { OG_SIZE, renderTunisianCard } from '@/src/lib/og'
import { renderSection } from '@/src/lib/share-sections'
import { getTunisianDetail } from '@/src/lib/tunisian'

// Share card for a title of the Tunisian catalogue.
export const revalidate = 86400
export const alt = 'Tunisian series on TunisiaFlicks'
export const size = OG_SIZE
export const contentType = 'image/jpeg'

export default async function Image({ params }: { params: { year: string, month: string, slug: string } }) {
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
