import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import WrappedCards from '@/src/components/wrapped/WrappedCards'
import ShareButtons from '@/src/components/ShareButtons'
import { getShare } from '@/src/lib/wrapped'

export const dynamic = 'force-dynamic'

type Props = { params: { token: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const share = await getShare(params.token)
  if (!share) return { title: 'Not found | TunisiaFlicks' }
  const { stats } = share
  const title = `${stats.name}'s ${stats.year} on TunisiaFlicks`
  const description = `${stats.titles} titles, ~${Math.round(stats.minutes / 60)} hours, top genre ${stats.topGenres[0]?.name ?? '—'}. ${stats.personality.title}. What was your year?`
  return { title, description, openGraph: { title, description, type: 'website' }, twitter: { card: 'summary_large_image', title, description } }
}

/** Public, shareable version of someone's year recap (a snapshot they chose to publish). */
export default async function SharedWrappedPage({ params }: Props) {
  const share = await getShare(params.token)
  if (!share) notFound()

  return (
    <div className="w-full max-w-[1400px] px-4 sm:px-6 space-y-6 pb-8">
      <WrappedCards stats={share.stats} isCurrentYear={share.year === new Date().getFullYear()} />
      <section className="rounded-3xl bg-zinc-900 border border-zinc-800 p-6 sm:p-8 text-white flex flex-col sm:flex-row sm:items-center gap-5 justify-between">
        <div>
          <h2 className="text-2xl font-black">What was your year?</h2>
          <p className="mt-1 text-gray-400">Sign in and get your own TunisiaFlicks recap in one click.</p>
        </div>
        <Link href="/wrapped" className="inline-flex shrink-0 rounded-xl bg-red-500 px-5 py-3 font-semibold text-white hover:bg-red-400">See my year</Link>
      </section>
      <ShareButtons url={`/wrapped/s/${share.token}`} title={`${share.stats.name}'s ${share.year} on TunisiaFlicks`} />
    </div>
  )
}
