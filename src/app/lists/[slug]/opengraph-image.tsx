import { getListBySlug } from '@/src/lib/lists-db'
import { visibilityOf } from '@/src/lib/shared-lists/rules'
import { SHARE_CARD_SIZE, keptShareImage } from '@/src/lib/share-image-store'

// Share card for a list: title, owner and a poster collage, only for a list anyone with the link
// may see. A private or friends-only list (and a missing one) gets the site's plain card, so its
// title and posters never travel in a link preview.
export const dynamic = 'force-dynamic'
export const maxDuration = 30
export const alt = 'A list on TunisiaFlicks'
export const size = SHARE_CARD_SIZE
export const contentType = 'image/jpeg'

async function draw({ params }: { params: { slug: string } }) {
  // The drawing code loads only when a card has to be drawn (a kept card never needs it).
  const { renderFallbackCard, renderListCard } = await import('@/src/lib/og')
  const list = await getListBySlug(params.slug)
  if (!list || visibilityOf(list) !== 'link') return renderFallbackCard()
  return renderListCard({
    title: list.title,
    owner: list.ownerName,
    count: list.items.length,
    posters: list.items.filter((item) => item.poster_path).map((item) => `https://image.tmdb.org/t/p/w342${item.poster_path}`),
  })
}

/** Kept once drawn, so a crawler never waits (lib/share-image-store). */
export default function Image({ params }: { params: { slug: string } }) {
  return keptShareImage(`lists/${params.slug}`, () => draw({ params }), { personal: true })
}
