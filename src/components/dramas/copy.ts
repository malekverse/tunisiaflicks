// The words of a hub's shelves (chip, row title, grid title and line), so the page, its metadata
// and the share card name them the same way.
import type { TKey, Translate } from '@/src/lib/i18n'
import { HUBS, type FilterShelf, type HubId } from '@/src/lib/dramas-config'

const k = (key: string) => key as TKey

export function chipLabel(t: Translate, hub: HubId, shelf: FilterShelf): string {
  return shelf === 'historical' ? t(k(`dramas.filter.historical.${hub}`)) : t(k(`dramas.filter.${shelf}`))
}

export function rowTitle(t: Translate, hub: HubId, shelf: FilterShelf | 'favourites'): string {
  switch (shelf) {
    case 'historical': return t(k(`dramas.row.historical.${hub}`))
    case 'films': return t(k(`dramas.row.films.${hub}`))
    default: return t(k(`dramas.row.${shelf}`))
  }
}

export function gridTitle(t: Translate, hub: HubId, shelf: FilterShelf): string {
  switch (shelf) {
    case 'historical': return t(k(`dramas.filter.historical.${hub}`))
    case 'films': return t(k(`dramas.row.films.${hub}`))
    default: return t(k(`dramas.grid.${shelf}.${hub}`))
  }
}

export function gridText(t: Translate, hub: HubId, shelf: FilterShelf): string {
  switch (shelf) {
    case 'romance': return t('dramas.grid.romanceText')
    case 'historical': return t(k(`dramas.grid.historicalText.${hub}`))
    case 'thrillers': return t('dramas.grid.thrillersText')
    case 'short': return t('dramas.grid.shortText', { max: HUBS[hub].shortMaxEpisodes })
    case 'films': return t('dramas.grid.filmsText')
  }
}
