"use client"
import { Clapperboard, Crown, Fingerprint, Heart, Hourglass } from 'lucide-react'
import { Chip, ChipGroup } from '@/src/components/ui/chip'
import { useT } from '@/src/components/I18nProvider'
import { FILTER_SHELVES, hubPath, type FilterShelf, type HubId } from '@/src/lib/dramas-config'
import type { TKey } from '@/src/lib/i18n'

const ICONS: Record<FilterShelf, React.ComponentType<{ className?: string }>> = {
  romance: Heart,
  historical: Crown,
  thrillers: Fingerprint,
  short: Hourglass,
  films: Clapperboard,
}

/** All, then one chip per shelf: each opens that shelf as a full grid (`?shelf=`). Links, so a nav. */
export default function HubFilters({ hub, active }: { hub: HubId, active: FilterShelf | null }) {
  const t = useT()
  const label = (shelf: FilterShelf) => (shelf === 'historical' ? t(`dramas.filter.historical.${hub}` as TKey) : t(`dramas.filter.${shelf}` as TKey))
  return (
    <ChipGroup label={t('dramas.filter.label')} mode="nav" scroll>
      <Chip href={hubPath(hub)} active={!active}>{t('common.all')}</Chip>
      {FILTER_SHELVES.map((shelf) => (
        <Chip key={shelf} href={hubPath(hub, shelf)} active={active === shelf} icon={ICONS[shelf]}>
          {label(shelf)}
        </Chip>
      ))}
    </ChipGroup>
  )
}
