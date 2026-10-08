import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getServerSession } from 'next-auth/next'
import { ListPlus, ListVideo } from 'lucide-react'
import PosterCard from '@/src/components/PosterCard'
import ShareButtons from '@/src/components/ShareButtons'
import ListEditor from '@/src/components/lists/ListEditor'
import ListCover from '@/src/components/library/ListCover'
import TmdbImage from '@/src/components/TmdbImage'
import { EmptyState, GRID_CLASS } from '@/src/components/MediaGrid'
import { Button } from '@/src/components/ui/button'
import { authOptions } from '@/src/lib/auth'
import { getListBySlug, toPublicList } from '@/src/lib/lists-db'
import { dateLocale } from '@/src/lib/i18n'
import { getLocale, getT } from '@/src/lib/i18n/server'

export const dynamic = 'force-dynamic'

type Props = { params: { slug: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = getT()
  const list = await getListBySlug(params.slug)
  if (!list) return { title: `${t('lists.notFound')} | TunisiaFlicks` }
  const names = list.items.slice(0, 5).map((item) => item.title).join(', ')
  const description = list.description
    || (names ? t('lists.metaTitles', { count: list.items.length, names: `${names}${list.items.length > 5 ? '…' : ''}` }) : t('lists.byOwner', { name: list.ownerName }))
  return {
    title: `${t('lists.metaTitle', { title: list.title, name: list.ownerName })} | TunisiaFlicks`,
    description,
    openGraph: { title: list.title, description, type: 'website' },
    twitter: { card: 'summary_large_image', title: list.title, description },
  }
}

export default async function ListPage({ params }: Props) {
  const list = await getListBySlug(params.slug)
  if (!list) notFound()

  const t = getT()
  const session = await getServerSession(authOptions)
  const isOwner = session?.user?.id === list.userId
  const publicList = toPublicList(list)
  const updated = list.updatedAt.toLocaleDateString(dateLocale(getLocale()) ?? 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  const count = list.items.length
  const glow = publicList.items.find((item) => item.poster_path)?.poster_path

  return (
    <div className="page-top relative isolate pb-10">
      {/* The first poster, blurred into a soft light behind the header. */}
      {glow && (
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] overflow-hidden opacity-45 [mask-image:linear-gradient(to_bottom,black,transparent)]">
          <TmdbImage kind="poster" path={glow} alt="" fill sizes="120px" shimmer={false} priority className="scale-125 object-cover blur-[80px] saturate-150" />
        </div>
      )}

      <header className="page-x">
        <div className="flex flex-col gap-7 md:flex-row md:items-end md:gap-10">
          <ListCover posters={publicList.items.map((item) => item.poster_path)} emptyLabel={t('library.emptyList')} priority className="w-full max-w-[300px] shadow-[0_30px_80px_-30px_rgb(0_0_0/0.95)] max-md:max-w-[220px]" />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-[clamp(34px,5vw,64px)] font-extrabold leading-[0.95] text-white"><bdi>{list.title}</bdi></h1>
            <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] text-white/55">
              <span>{t('lists.byOwner', { name: list.ownerName })}</span>
              <span>{count === 1 ? t('library.countOne') : t('library.count', { count })}</span>
              <span>{t('lists.updatedOn', { date: updated })}</span>
            </p>
            {list.description && <p dir="auto" className="mt-4 max-w-[65ch] text-pretty text-[15px] leading-relaxed text-white/75">{list.description}</p>}
            <div className="mt-6">
              <ShareButtons url={`/lists/${list.slug}`} title={list.title} text={t('lists.shareText', { title: list.title, name: list.ownerName })} />
            </div>
          </div>
        </div>
      </header>

      <div className="page-x mt-10 sm:mt-12">
        {isOwner ? (
          <ListEditor initial={publicList} />
        ) : count === 0 ? (
          <EmptyState icon={<ListVideo aria-hidden className="h-6 w-6" />} title={t('lists.emptyPublic')} />
        ) : (
          <ol className={GRID_CLASS}>
            {publicList.items.map((item, index) => (
              <li key={`${item.media_type}-${item.id}`}>
                <PosterCard
                  posterImg={item.poster_path}
                  title={item.title}
                  mediaType={item.media_type}
                  link={`/${item.media_type}/${item.id}`}
                  overlay={<span className="glass absolute start-2 top-2 min-w-[28px] rounded-full px-2 py-0.5 text-center text-[12px] font-semibold tabular-nums text-white">{index + 1}</span>}
                />
              </li>
            ))}
          </ol>
        )}

        {!isOwner && (
          <div className="mt-12">
            <Button asChild variant="secondary" size="lg">
              <Link href="/lists"><ListPlus aria-hidden className="h-5 w-5" />{t('lists.makeYourOwn')}</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
