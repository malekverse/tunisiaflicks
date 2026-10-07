import { OG_SIZE, renderFallbackCard, renderListCard } from '@/src/lib/og'
import { getListBySlug } from '@/src/lib/lists-db'

// Share card for a list: title, owner and a poster collage.
export const revalidate = 300 // lists change; refresh the card every few minutes
export const alt = 'A list on TunisiaFlicks'
export const size = OG_SIZE
export const contentType = 'image/jpeg'

export default async function Image({ params }: { params: { slug: string } }) {
  const list = await getListBySlug(params.slug)
  if (!list) return renderFallbackCard()
  return renderListCard({
    title: list.title,
    owner: list.ownerName,
    count: list.items.length,
    posters: list.items.filter((item) => item.poster_path).map((item) => `https://image.tmdb.org/t/p/w342${item.poster_path}`),
  })
}
