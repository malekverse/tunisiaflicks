import Link from 'next/link'
import { getServerSession } from 'next-auth/next'
import { Clapperboard, LogIn } from 'lucide-react'
import { authOptions } from '@/src/lib/auth'
import WrappedCards from '@/src/components/wrapped/WrappedCards'
import WrappedShare from '@/src/components/wrapped/WrappedShare'
import { Button } from '@/src/components/ui/button'
import { getT } from '@/src/lib/i18n/server'
import { cn } from '@/src/lib/utils'
import { computeWrapped, firstName, sharesCollection, yearFromParam } from '@/src/lib/wrapped'

export const dynamic = 'force-dynamic'

export function generateMetadata() {
  return { title: `${getT()('nav.myYear')} | TunisiaFlicks` }
}

/**
 * A year with nothing in it yet (or a guest, who has no year yet): the year itself as an empty,
 * outlined numeral, one line on what will show up here, and the way forward.
 */
function BlankYear({ year, title, text, children }: { year: number, title: string, text: string, children: React.ReactNode }) {
  return (
    <section className="relative isolate overflow-hidden rounded-stage bg-white/[0.03] px-6 pb-14 pt-10 text-center ring-1 ring-white/[0.07] sm:pb-20 sm:pt-14">
      <div aria-hidden className="absolute inset-x-0 top-0 -z-10 h-[70%] bg-[radial-gradient(ellipse_at_top,rgb(255_255_255/0.07),transparent_65%)]" />
      <p aria-hidden dir="ltr" className="numeral-outline select-none font-display text-[clamp(112px,26vw,300px)] font-extrabold leading-[0.85]">{year}</p>
      <h1 className="mx-auto mt-6 max-w-[18ch] text-balance font-display text-[clamp(30px,4.6vw,54px)] font-extrabold leading-[0.95]">{title}</h1>
      <p className="mx-auto mt-4 max-w-[52ch] text-pretty text-[15px] leading-relaxed text-white/60">{text}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">{children}</div>
    </section>
  )
}

export default async function WrappedPage({ searchParams }: { searchParams: { year?: string } }) {
  const t = getT()
  const session = await getServerSession(authOptions)
  const currentYear = new Date().getFullYear()

  if (!session?.user?.id) {
    return (
      <div className="page-top pb-10">
        <div className="page-x">
          <BlankYear year={currentYear} title={t('wrapped.guestTitle')} text={t('wrapped.guestText')}>
            <Button asChild size="lg"><Link href="/login"><LogIn aria-hidden className="h-5 w-5 rtl:-scale-x-100" />{t('nav.signIn')}</Link></Button>
            <Button asChild size="lg" variant="secondary"><Link href="/signup">{t('nav.createAccount')}</Link></Button>
          </BlankYear>
        </div>
      </div>
    )
  }

  const year = yearFromParam(searchParams.year)
  const [stats, share] = await Promise.all([
    computeWrapped(session.user.id, year, firstName(session.user.name)),
    sharesCollection().then((collection) => collection.findOne({ userId: session.user.id, year })).catch(() => null),
  ])

  const years = [currentYear, currentYear - 1, currentYear - 2].filter((y) => y >= 2020)

  return (
    <div className="page-top pb-10">
      <div className="page-x space-y-5 sm:space-y-6">
        <nav aria-label={t('wrapped.chooseYear')} className="flex w-fit rounded-full bg-white/[0.06] p-1">
          {years.map((y) => (
            <Link
              key={y}
              href={y === currentYear ? '/wrapped' : `/wrapped?year=${y}`}
              aria-current={y === year ? 'page' : undefined}
              className={cn(
                'flex h-9 items-center rounded-full px-4 text-sm font-medium tabular-nums transition-colors duration-200',
                y === year ? 'bg-white text-black' : 'text-white/70 hover:text-white',
              )}
            >
              {y}
            </Link>
          ))}
        </nav>

        {stats.titles === 0 ? (
          <BlankYear year={year} title={t('wrapped.emptyTitle', { year })} text={t('wrapped.emptyText')}>
            <Button asChild size="lg"><Link href="/"><Clapperboard aria-hidden className="h-5 w-5" />{t('wrapped.emptyAction')}</Link></Button>
          </BlankYear>
        ) : (
          <div className="space-y-10 sm:space-y-12">
            <WrappedCards stats={stats} isCurrentYear={year === currentYear} />
            <WrappedShare year={year} initialToken={share?.token ?? null} />
          </div>
        )}
      </div>
    </div>
  )
}
