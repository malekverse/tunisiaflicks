import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { CloudOff } from 'lucide-react'
import PosterCard from '@/src/components/PosterCard'
import { EmptyState, GRID_CLASS } from '@/src/components/MediaGrid'
import SegmentedLinks from '@/src/components/browse/SegmentedLinks'
import HubHeader from '@/src/components/hubs/HubHeader'
import HubTile from '@/src/components/hubs/HubTile'
import { SectionHeader } from '@/src/components/rows/Row'
import KidsBlocked from '@/src/components/profiles/KidsBlocked'
import HubScreen from '@/src/components/dramas/HubScreen'
import HubFilters from '@/src/components/dramas/HubFilters'
import RetryButton from '@/src/components/dramas/RetryButton'
import { HubWatermark } from '@/src/components/dramas/Lattice'
import { ForYouRows, HubTop10, RowSkeleton, ShelfRow, badgeFor } from '@/src/components/dramas/Rows'
import { gridText, gridTitle, rowTitle } from '@/src/components/dramas/copy'
import { getKidsMode } from '@/src/lib/profiles'
import { getLocale, getT } from '@/src/lib/i18n/server'
import { htmlLang, type TKey } from '@/src/lib/i18n'
import { cardProps } from '@/src/lib/card-props'
import { pageMetadata, SITE_URL } from '@/src/lib/seo'
import { JsonLd } from '@/src/lib/structured-data'
import { withTimeout } from '@/src/lib/with-timeout'
import { getFeatured, getShelf, hubPicture, type DramaItem } from '@/src/lib/dramas'
import { GRID_SIZE, HUB_IDS, HUBS, hubPath, isFilterShelf, isHubId, otherHub, type FilterShelf, type HubId } from '@/src/lib/dramas-config'

// TMDB lists are cached (see lib/dramas.ts); rendering per request keeps the day's rotation, the
// air-date badges and the featured series current.
export const dynamic = 'force-dynamic'
export const maxDuration = 20

type Props = { params: { hub: string }, searchParams: { shelf?: string | string[] } }

const shelfOf = (searchParams: Props['searchParams']): FilterShelf | null => (isFilterShelf(searchParams.shelf) ? searchParams.shelf : null)

export function generateMetadata({ params, searchParams }: Props) {
  if (!isHubId(params.hub)) return {}
  const t = getT()
  const hub = params.hub
  const shelf = shelfOf(searchParams)
  return pageMetadata({
    title: shelf ? gridTitle(t, hub, shelf) : t(`dramas.${hub}.title` as TKey),
    description: shelf ? gridText(t, hub, shelf) : t(`dramas.${hub}.subtitle` as TKey),
    path: hubPath(hub, shelf),
    // The hub's own share card (opengraph-image.tsx next to this page).
    card: false,
  })
}

const titleOf = (item: DramaItem) => item.name || item.title || ''

function collectionJsonLd({ name, description, path, items, locale }: { name: string, description: string, path: string, items: DramaItem[], locale: string }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name,
    description,
    url: `${SITE_URL}${path}`,
    inLanguage: locale,
    isPartOf: { '@type': 'WebSite', name: 'TunisiaFlicks', url: SITE_URL },
    ...(items.length > 0 ? {
      mainEntity: {
        '@type': 'ItemList',
        itemListElement: items.slice(0, 10).map((item, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: titleOf(item),
          url: `${SITE_URL}/${item.media_type}/${item.id}`,
        })),
      },
    } : {}),
  }
}

/** TMDB isn't answering: say so, and offer to try again. */
function Unavailable() {
  const t = getT()
  return (
    <EmptyState title={t('dramas.error.title')} icon={<CloudOff aria-hidden className="h-6 w-6" />} action={<RetryButton label={t('dramas.error.retry')} />}>
      {t('dramas.error.text')}
    </EmptyState>
  )
}

/** The other drama hub, as a picture door at the end of the page. */
async function CrossLink({ hub }: { hub: HubId }) {
  const t = getT()
  const other = otherHub(hub)
  const picture = await withTimeout(hubPicture(other), 4000, null)
  const title = t('dramas.row.elsewhere')
  return (
    <section aria-label={title}>
      <SectionHeader title={title} />
      <div className="page-x grid gap-4 md:grid-cols-2">
        <HubTile
          href={hubPath(other)}
          title={t(`dramas.${other}.title` as TKey)}
          line={t(`dramas.${other}.line` as TKey)}
          picture={picture ? { kind: 'tmdb-backdrop', src: picture } : null}
          accent={HUBS[other].accent}
          size="door"
        />
      </div>
    </section>
  )
}

/** The Turkish and Korean drama hubs: a featured series, filter chips, then the hub's rows. */
export default async function DramaHubPage({ params, searchParams }: Props) {
  if (!isHubId(params.hub)) notFound()
  const hub = params.hub
  const t = getT()
  const shelf = shelfOf(searchParams)
  // Grown-ups only: "Switch profile" comes back here.
  if (await getKidsMode()) return <KidsBlocked title={t('dramas.kidsBlocked')} next={hubPath(hub, shelf)} />

  const config = HUBS[hub]
  const locale = getLocale()
  const watermark = <HubWatermark kind={config.watermark} />
  const switcher = (
    <SegmentedLinks
      label={t('dramas.switch')}
      items={HUB_IDS.map((id) => ({ href: hubPath(id, shelf), label: t(`dramas.${id}.short` as TKey), active: id === hub }))}
    />
  )

  // One shelf, as a full grid.
  if (shelf) {
    // null: the shelf didn't answer in time, which is not the same as an empty shelf.
    const [items, top] = await Promise.all([
      withTimeout(getShelf(hub, shelf, locale, GRID_SIZE), 15000, null),
      withTimeout(getShelf(hub, 'trending', locale, 10), 8000, []),
    ])
    const title = gridTitle(t, hub, shelf)
    const description = gridText(t, hub, shelf)
    return (
      <div className="pb-10">
        <HubHeader title={title} subtitle={description} accent={config.accent} watermark={watermark} end={switcher} />
        <div className="page-x">
          <HubFilters hub={hub} active={shelf} />
          <div className="mt-6 sm:mt-8">
            {items && items.length > 0 ? (
              <div className={GRID_CLASS}>
                {items.map((item) => (
                  <PosterCard key={`${item.media_type}-${item.id}`} {...cardProps(item, item.media_type)} overlay={badgeFor(item, t, locale)} />
                ))}
              </div>
            ) : !items || top.length === 0 ? (
              <Unavailable />
            ) : (
              <EmptyState>{t('dramas.grid.empty')}</EmptyState>
            )}
          </div>
        </div>
        <JsonLd data={collectionJsonLd({ name: title, description, path: hubPath(hub, shelf), items: items ?? [], locale: htmlLang(locale) })} />
      </div>
    )
  }

  const [featured, top, favourites] = await Promise.all([
    withTimeout(getFeatured(hub, locale), 12000, null),
    withTimeout(getShelf(hub, 'trending', locale, 10), 12000, []),
    withTimeout(getShelf(hub, 'favourites', locale), 12000, []),
  ])
  const title = t(`dramas.${hub}.title` as TKey)
  const subtitle = t(`dramas.${hub}.subtitle` as TKey)
  const header = <HubHeader size="compact" title={title} subtitle={subtitle} accent={config.accent} watermark={watermark} end={switcher} />

  // Both sources TMDB gives the hub are empty: it's down, not the hub.
  if (!featured && top.length === 0 && favourites.length === 0) {
    return (
      <div className="pb-10">
        {header}
        <div className="page-x">
          <HubFilters hub={hub} active={null} />
          <Unavailable />
        </div>
      </div>
    )
  }

  return (
    <div className="pb-10">
      {header}
      {featured && <HubScreen series={featured} accent={config.accent} />}
      <div className="page-x mt-6 sm:mt-8">
        <HubFilters hub={hub} active={null} />
      </div>

      <div className="mt-8 space-y-10 sm:mt-10 sm:space-y-12">
        <Suspense fallback={<RowSkeleton />}>
          <ShelfRow hub={hub} shelf="new-episodes" title={t('dramas.row.newEpisodes')} />
        </Suspense>
        <Suspense fallback={<RowSkeleton />}>
          <HubTop10 hub={hub} />
        </Suspense>
        <Suspense fallback={null}>
          <ForYouRows hub={hub} />
        </Suspense>
        <Suspense fallback={<RowSkeleton />}>
          <ShelfRow hub={hub} shelf="favourites" title={rowTitle(t, hub, 'favourites')} />
        </Suspense>
        {(['romance', 'historical', 'thrillers', 'short', 'films'] as const).map((id) => (
          <Suspense key={id} fallback={<RowSkeleton />}>
            <ShelfRow hub={hub} shelf={id} title={rowTitle(t, hub, id)} seeAll={id} />
          </Suspense>
        ))}
        <Suspense fallback={null}>
          <CrossLink hub={hub} />
        </Suspense>
      </div>

      <JsonLd data={collectionJsonLd({ name: title, description: subtitle, path: hubPath(hub), items: top, locale: htmlLang(locale) })} />
    </div>
  )
}
