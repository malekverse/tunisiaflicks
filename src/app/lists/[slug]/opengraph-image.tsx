import { OG_SIZE, renderFallbackCard, renderListCard } from '@/src/lib/og'
import { getListBySlug } from '@/src/lib/lists-db'
import { visibilityOf } from '@/src/lib/shared-lists/rules'

// Share card for a list: title, owner and a poster collage, only for a list anyone with the link
// may see. A private or friends-only list (and a missing one) gets the site's plain card, so its
// title and posters never travel in a link preview.
export const revalidate = 300 // lists change; refresh the card every few minutes
export const maxDuration = 30
export const alt = 'A list on TunisiaFlicks'
export const size = OG_SIZE
export const contentType = 'image/jpeg'

export default async function Image({ params }: { params: { slug: string } }) {
  const list = await getListBySlug(params.slug)
  if (!list || visibilityOf(list) !== 'link') return renderFallbackCard()
  return renderListCard({
    title: list.title,
    owner: list.ownerName,
    count: list.items.length,
    posters: list.items.filter((item) => item.poster_path).map((item) => `https://image.tmdb.org/t/p/w342${item.poster_path}`),
  })
}
