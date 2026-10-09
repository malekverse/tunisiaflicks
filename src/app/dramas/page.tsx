import { Suspense } from 'react'
import PosterCard from '@/src/components/PosterCard'
import PageHeader from '@/src/components/browse/PageHeader'
import HubTile from '@/src/components/hubs/HubTile'
import { Row, SectionHeader } from '@/src/components/rows/Row'
import { POSTER_WIDTH } from '@/src/components/dramas/widths'
import KidsBlocked from '@/src/components/profiles/KidsBlocked'
import { RowSkeleton, badgeFor } from '@/src/components/dramas/Rows'
import { getKidsMode } from '@/src/lib/profiles'
import { getLocale, getT } from '@/src/lib/i18n/server'
import { htmlLang, type Locale, type TKey } from '@/src/lib/i18n'
import { cardProps } from '@/src/lib/card-props'
import { pageMetadata, SITE_URL } from '@/src/lib/seo'
import { JsonLd } from '@/src/lib/structured-data'
import { withTimeout } from '@/src/lib/with-timeout'
import { getAllNewEpisodes, getFeatured, hubPicture, type DramaItem } from '@/src/lib/dramas'
import { HUB_IDS, HUBS, compareAir, hubPath, pluralKey, rowMinimum, type HubId } from '@/src/lib/dramas-config'

export const dynamic = 'force-dynamic'
export const maxDuration = 20

export const generateMetadata = () => {
  const t = getT()
  // The index's own share card: opengraph-image.tsx next to this page.
  return pageMetadata({ title: t('dramas.index.title'), description: t('dramas.index.subtitle'), path: '/dramas', card: false })
}

/** A hub's door: today's featured series as the picture, and how many of its series have new episodes. */
async function Door({ hub, newCount }: { hub: HubId, newCount: number }) {
  const t = getT()
  const locale = getLocale()
  const featured = await withTimeout(getFeatured(hub, locale), 6000, null)
  const picture = featured?.backdrop ?? await withTimeout(hubPicture(hub), 3000, null)
  return (
    <HubTile
      href={hubPath(hub)}
      title={t(`dramas.${hub}.title` as TKey)}
      line={newCount > 0 ? t(pluralKey('dramas.index.newCount', locale, newCount) as TKey, { count: newCount }) : t(`dramas.${hub}.line` as TKey)}
      picture={picture ? { kind: 'tmdb-backdrop', src: picture } : null}
      accent={HUBS[hub].accent}
      size="door"
    />
  )
}

/** Both hubs' new-episode weeks (memoised per request: the doors and the row share it). */
const weekOf = (locale: Locale) => withTimeout(getAllNewEpisodes(locale), 9000, HUB_IDS.map((hub) => ({ hub, items: [] as DramaItem[] })))

async function Doors() {
  const week = await weekOf(getLocale())
  const count = (hub: HubId) => week.find((entry) => entry.hub === hub)?.items.length ?? 0
  return (
    <>
      {HUB_IDS.map((hub) => (
        <Suspense key={hub} fallback={<DoorSkeleton />}>
          <Door hub={hub} newCount={count(hub)} />
        </Suspense>
      ))}
    </>
  )
}

const DoorSkeleton = () => <div aria-hidden className="tf-shimmer relative aspect-video rounded-tile ring-1 ring-inset ring-white/[0.08]" />

/** Both hubs' series with an episode out in the last two days or due in the next four. */
async function NewThisWeek() {
  const t = getT()
  const locale = getLocale()
  const week = await weekOf(locale)
  const seen = new Set<number>()
  const items = week.flatMap(({ items }) => items)
    .filter((item) => item.air && !seen.has(item.id) && seen.add(item.id))
    .sort((a, b) => compareAir(a.air!, b.air!))
    .slice(0, 30)
  if (items.length < rowMinimum('new-episodes')) return null
  const title = t('dramas.index.newEpisodes')
  return (
    <section aria-label={title} className="w-full">
      <SectionHeader title={title} />
      <Row label={title} itemClassName={POSTER_WIDTH}>
        {items.map((item) => (
          <PosterCard key={item.id} {...cardProps(item, 'tv')} overlay={badgeFor(item, t, locale)} />
        ))}
      </Row>
    </section>
  )
}

/** /dramas: the two drama hubs' doors, and what's new in both this week. */
export default async function DramasIndexPage() {
  const t = getT()
  // Grown-ups only: "Switch profile" comes back here.
  if (await getKidsMode()) return <KidsBlocked title={t('dramas.kidsBlocked')} next="/dramas" />
  const locale = getLocale()

  return (
    <div className="relative isolate pb-10">
      {/* The two hubs' lights, one on each side of the room. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] overflow-hidden">
        <div className="absolute -start-40 -top-48 h-[520px] w-[640px] rounded-full opacity-70 blur-3xl" style={{ background: `radial-gradient(closest-side, rgb(${HUBS.turkish.accent} / 0.28), transparent)` }} />
        <div className="absolute -end-40 -top-56 h-[520px] w-[640px] rounded-full opacity-70 blur-3xl" style={{ background: `radial-gradient(closest-side, rgb(${HUBS.korean.accent} / 0.3), transparent)` }} />
      </div>
      <PageHeader title={t('dramas.index.title')} subtitle={t('dramas.index.subtitle')} />

      <div className="page-x grid gap-4 xl:grid-cols-2">
        <Suspense fallback={<><DoorSkeleton /><DoorSkeleton /></>}>
          <Doors />
        </Suspense>
      </div>

      <div className="mt-10 sm:mt-12">
        <Suspense fallback={<RowSkeleton />}>
          <NewThisWeek />
        </Suspense>
      </div>

      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: t('dramas.index.title'),
          description: t('dramas.index.subtitle'),
          url: `${SITE_URL}/dramas`,
          inLanguage: htmlLang(locale),
          hasPart: HUB_IDS.map((hub) => ({ '@type': 'CollectionPage', name: t(`dramas.${hub}.title` as TKey), url: `${SITE_URL}${hubPath(hub)}` })),
        }}
      />
    </div>
  )
}
