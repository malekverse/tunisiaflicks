import { MapPinOff } from 'lucide-react'
import { EmptyState } from '@/src/components/MediaGrid'
import { Button } from '@/src/components/ui/button'
import CountryLink from '@/src/components/arab-map/CountryLink'
import { getT } from '@/src/lib/i18n/server'

/** /arab-cinema/zz: a 404 in the panel, the map still there to choose from. */
export default function NotFound() {
  const t = getT()
  return (
    <div className="pt-6 xl:pt-16">
      <EmptyState
        title={t('arabMap.notFound.title')}
        icon={<MapPinOff aria-hidden className="h-6 w-6" />}
        action={(
          <Button asChild variant="secondary" className="h-11">
            <CountryLink href="/arab-cinema">{t('arabMap.all')}</CountryLink>
          </Button>
        )}
      >
        {t('arabMap.notFound.text')}
      </EmptyState>
    </div>
  )
}
