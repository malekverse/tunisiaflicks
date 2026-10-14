import { isShareSection, renderSection } from '@/src/lib/share-sections'
import { keptShareImage } from '@/src/lib/share-image-store'

// /og/home, /og/discover, /og/ramadan...: the share image of each section (see pageMetadata).
// Kept in the database once drawn and redrawn in the background twice a day, so the poster walls
// follow the trends and a crawler never waits for one.
export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET(_request: Request, { params }: { params: { page: string } }) {
  const name = params.page.replace(/\.(jpe?g|png)$/, '')
  if (!isShareSection(name)) return new Response('Not found', { status: 404 })
  // Kept once drawn, so a crawler never waits (lib/share-image-store); redrawn as the trends move.
  return keptShareImage(`og/${name}`, () => renderSection(name))
}
