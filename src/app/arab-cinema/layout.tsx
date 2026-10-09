import { Suspense } from 'react'
import ArabCinemaShell from '@/src/components/arab-map/ArabCinemaShell'
import ArabMap from '@/src/components/arab-map/ArabMap'
import { MapSkeleton } from '@/src/components/arab-map/Skeletons'
import { getArabMapIndex } from '@/src/lib/arab-cinema'
import { getLocale, getT } from '@/src/lib/i18n/server'
import { getKidsMode } from '@/src/lib/profiles'

// The index takes ~66 TMDB requests on a cold cache (once a day per language and profile kind).
export const maxDuration = 30

/** The map, once its index is in (cached for the day; Kids get their own, filtered). */
async function MapData() {
  const kids = await getKidsMode().catch(() => false)
  const index = await getArabMapIndex(getLocale(), kids)
  return <ArabMap countries={index.countries} kids={kids} />
}

/**
 * /arab-cinema and /arab-cinema/[country]: the map stays mounted while the panel changes (this
 * layout isn't re-rendered between countries). The map streams in, so the panel's title never
 * waits for TMDB.
 */
export default function ArabCinemaLayout({ children }: { children: React.ReactNode }) {
  return (
    <ArabCinemaShell
      map={(
        <Suspense fallback={<MapSkeleton label={getT()('common.loadingAria')} />}>
          <MapData />
        </Suspense>
      )}
    >
      {children}
    </ArabCinemaShell>
  )
}
