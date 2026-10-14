import { keptShareImage } from '@/src/lib/share-image-store'

// /og/home, /og/discover, /og/ramadan...: the share image of each section (see pageMetadata), used
// by most pages. Built with each deployment and served as a static file from the first second
// (no function to start, no database to reach: a crawler gets it at once), then rebuilt in the
// background twice a day so the poster walls follow the trends.
//
// Each build reads the card kept in the database (lib/share-image-store) or draws it, with all the
// time it needs: a stand-in brand card here would be served for half a day. Drawing fails on a
// Windows build (next/og can't load its font there); the brand card from disk is served instead,
// and the build goes on.
export const revalidate = 43200
export const dynamicParams = false
export const maxDuration = 30
const BUILD_BUDGET_MS = 25_000

export async function generateStaticParams() {
  const { SHARE_SECTIONS } = await import('@/src/lib/share-sections')
  return Object.keys(SHARE_SECTIONS).map((page) => ({ page }))
}

export async function GET(_request: Request, { params }: { params: { page: string } }) {
  const name = params.page.replace(/\.(jpe?g|png)$/, '')
  // The sections (and the drawing code) load only when a card has to be drawn.
  return keptShareImage(`og/${name}`, async () => {
    const { isShareSection, renderSection } = await import('@/src/lib/share-sections')
    return isShareSection(name) ? renderSection(name) : new Response('Not found', { status: 404 })
  }, { budgetMs: BUILD_BUDGET_MS })
}
