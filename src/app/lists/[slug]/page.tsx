import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getServerSession } from 'next-auth/next'
import { MdPlaylistAdd } from 'react-icons/md'
import PosterCard from '@/src/components/PosterCard'
import ShareButtons from '@/src/components/ShareButtons'
import ListEditor from '@/src/components/lists/ListEditor'
import { authOptions } from '@/src/lib/auth'
import { getListBySlug, toPublicList } from '@/src/lib/lists-db'

export const dynamic = 'force-dynamic'

type Props = { params: { slug: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const list = await getListBySlug(params.slug)
  if (!list) return { title: 'List not found | TunisiaFlicks' }
  const names = list.items.slice(0, 5).map((item) => item.title).join(', ')
  const description = list.description
    || (names ? `${list.items.length} titles: ${names}${list.items.length > 5 ? '…' : ''}` : `A list by ${list.ownerName}`)
  return {
    title: `${list.title} · a list by ${list.ownerName} | TunisiaFlicks`,
    description,
    openGraph: { title: list.title, description, type: 'website' },
    twitter: { card: 'summary_large_image', title: list.title, description },
  }
}

export default async function ListPage({ params }: Props) {
  const list = await getListBySlug(params.slug)
  if (!list) notFound()

  const session = await getServerSession(authOptions)
  const isOwner = session?.user?.id === list.userId
  const publicList = toPublicList(list)
  const updated = list.updatedAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div className="w-full max-w-[1800px] px-4 sm:px-6 space-y-8 pb-8">
      <header className="space-y-3">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-500">List</p>
        <h1 className="text-3xl sm:text-5xl font-bold">{list.title}</h1>
        <p className="text-gray-500 dark:text-gray-400">
          A list by <span className="font-semibold text-gray-800 dark:text-gray-200">{list.ownerName}</span>
          {' · '}{list.items.length} title{list.items.length === 1 ? '' : 's'}{' · '}updated {updated}
        </p>
        {list.description && <p className="max-w-3xl text-gray-600 dark:text-gray-300">{list.description}</p>}
        <ShareButtons url={`/lists/${list.slug}`} title={list.title} text={`${list.title}: a list by ${list.ownerName} on TunisiaFlicks`} />
      </header>

      {isOwner ? (
        <ListEditor initial={publicList} />
      ) : list.items.length === 0 ? (
        <p className="text-gray-400">This list is empty for now.</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(145px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(167px,1fr))] gap-4">
          {publicList.items.map((item, index) => (
            <div key={`${item.media_type}-${item.id}`} className="relative transition-transform duration-300 hover:scale-105 hover:z-10">
              <PosterCard posterImg={item.poster_path} title={item.title} mediaType={item.media_type} link={`/${item.media_type}/${item.id}`} />
              <span className="pointer-events-none absolute start-1.5 top-1.5 z-30 rounded-md bg-red-600 px-2 py-0.5 text-xs font-bold text-white">#{index + 1}</span>
            </div>
          ))}
        </div>
      )}

      {!isOwner && (
        <Link href="/lists" className="inline-flex items-center gap-2 rounded-xl bg-zinc-800 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-700">
          <MdPlaylistAdd className="text-xl text-red-500" /> Make your own list
        </Link>
      )}
    </div>
  )
}
