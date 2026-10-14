import { keptShareImage } from '@/src/lib/share-image-store'

// /og/home, /og/discover, /og/ramadan...: the share image of each section (see pageMetadata).
// Kept in the database once drawn and redrawn in the background twice a day, so the poster walls
// follow the trends and a crawler never waits for one.
export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET(_request: Request, { params }: { params: { page: string } }) {
  const name = params.page.replace(/\.(jpe?g|png)$/, '')
  if (!/^[a-z][a-z-]{0,39}$/.test(name)) return new Response('Not found', { status: 404 })
  // Kept once drawn, so a crawler never waits (lib/share-image-store); redrawn as the trends move.
  // The sections (and the drawing code) load only when a card has to be drawn.
  return keptShareImage(`og/${name}`, async () => {
    const { isShareSection, renderSection } = await import('@/src/lib/share-sections')
    return isShareSection(name) ? renderSection(name) : new Response('Not found', { status: 404 })
  })
}
