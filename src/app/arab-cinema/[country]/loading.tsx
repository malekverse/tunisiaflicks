import { PanelSkeleton } from '@/src/components/arab-map/Skeletons'
import { getT } from '@/src/lib/i18n/server'

/** A country's panel while it loads: shown at once when a tile is chosen, the map stays put. */
export default function Loading() {
  return <PanelSkeleton label={getT()('common.loadingAria')} />
}
