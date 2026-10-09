import { IndexSkeleton } from '@/src/components/arab-map/Skeletons'
import { getT } from '@/src/lib/i18n/server'

/** The index panel's shape while it loads (the map beside it streams on its own). */
export default function Loading() {
  const t = getT()
  return <IndexSkeleton label={t('common.loadingAria')} title={t('arabMap.all')} />
}
