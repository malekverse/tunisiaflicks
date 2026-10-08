import { isShareSection, renderSection } from '@/src/lib/share-sections'

// /og/home, /og/discover, /og/ramadan...: the share image of each section (see pageMetadata).
// Rendered on demand and kept at the edge for six hours, so the poster walls follow the trends.
export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: { params: { page: string } }) {
  const name = params.page.replace(/\.(jpe?g|png)$/, '')
  if (!isShareSection(name)) return new Response('Not found', { status: 404 })
  const image = await renderSection(name)
  const headers = new Headers(image.headers)
  headers.set('Cache-Control', 'public, max-age=3600, s-maxage=21600, stale-while-revalidate=86400')
  return new Response(image.body, { status: 200, headers })
}
