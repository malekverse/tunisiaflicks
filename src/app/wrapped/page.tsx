import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/src/lib/auth'
import WrappedCards from '@/src/components/wrapped/WrappedCards'
import WrappedShare from '@/src/components/wrapped/WrappedShare'
import { computeWrapped, firstName, sharesCollection, yearFromParam } from '@/src/lib/wrapped'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Your year | TunisiaFlicks' }

export default async function WrappedPage({ searchParams }: { searchParams: { year?: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login')

  const year = yearFromParam(searchParams.year)
  const currentYear = new Date().getFullYear()
  const [stats, share] = await Promise.all([
    computeWrapped(session.user.id, year, firstName(session.user.name)),
    sharesCollection().then((collection) => collection.findOne({ userId: session.user.id, year })).catch(() => null),
  ])

  const years = [currentYear, currentYear - 1, currentYear - 2].filter((y) => y >= 2020)

  return (
    <div className="w-full max-w-[1400px] px-4 sm:px-6 space-y-6 pb-8">
      <nav className="flex gap-2" aria-label="Year">
        {years.map((y) => (
          <Link
            key={y}
            href={y === currentYear ? '/wrapped' : `/wrapped?year=${y}`}
            className={`px-4 py-2 rounded-xl text-sm font-medium ${y === year ? 'bg-red-500 text-white' : 'bg-zinc-800 text-gray-300 hover:bg-zinc-600 hover:text-white'}`}
          >
            {y}
          </Link>
        ))}
      </nav>

      {stats.titles === 0 ? (
        <section className="rounded-3xl bg-gradient-to-br from-zinc-800 to-zinc-950 p-8 sm:p-12 text-white text-center">
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-red-400">TunisiaFlicks Wrapped</p>
          <h1 className="mt-3 text-3xl sm:text-5xl font-black">Your {year} is still a blank page</h1>
          <p className="mt-4 text-gray-400 max-w-xl mx-auto">
            Watch a few movies or episodes and come back: your top genres, viewer personality and most-watched show will show up here.
          </p>
          <Link href="/" className="mt-6 inline-flex rounded-xl bg-red-500 px-5 py-3 font-semibold text-white hover:bg-red-400">Find something to watch</Link>
        </section>
      ) : (
        <>
          <WrappedCards stats={stats} isCurrentYear={year === currentYear} />
          <WrappedShare year={year} initialToken={share?.token ?? null} />
        </>
      )}
    </div>
  )
}
