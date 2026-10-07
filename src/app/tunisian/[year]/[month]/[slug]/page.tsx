import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { FaPlay } from 'react-icons/fa6'
import TunisianSeasons from '@/src/components/detail/TunisianSeasons'
import PosterCard from '@/src/components/PosterCard'
import { GRID_CLASS } from '@/src/components/MediaGrid'
import KidsBlocked from '@/src/components/profiles/KidsBlocked'
import { getKidsMode } from '@/src/lib/profiles'
import { getTunisianDetail, getTunisianTitles } from '@/src/lib/tunisian'
import { getT } from '@/src/lib/i18n/server'

export const dynamic = 'force-dynamic'

type Props = { params: { year: string, month: string, slug: string } }

const slugOf = ({ year, month, slug }: Props['params']) => `${year}/${month}/${slug}`

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const detail = await getTunisianDetail(slugOf(params))
  if (!detail) return {}
  return {
    title: `${detail.title} | TunisiaFlicks`,
    description: detail.description || undefined,
    openGraph: { title: detail.title, description: detail.description || undefined, images: detail.poster ? [detail.poster] : undefined },
  }
}

export default async function TunisianDetailPage({ params }: Props) {
  // The Tunisian catalogue has no age ratings, so Kids profiles can't be offered it.
  if (await getKidsMode()) return <KidsBlocked what={'The Tunisian catalogue'} />
  const detail = await getTunisianDetail(slugOf(params))
  const t = getT()
  if (detail === null) notFound()
  if (detail === undefined) {
    return (
      <div className='flex flex-col items-center justify-center gap-3 w-full py-24 text-center px-4'>
        <p className='text-gray-400'>{t('tunisian.detailFailed')}</p>
        <Link href='/tunisian' className='text-sm text-gray-400 hover:text-white underline'>{t('tunisian.back')}</Link>
      </div>
    )
  }

  // Other titles from the (cached) catalogue.
  const more = ((await getTunisianTitles()) ?? []).filter((title) => title.slug !== detail.slug).slice(0, 12)

  const episodeCount = detail.seasons.reduce((total, season) => total + season.episodes.length, 0)

  return (
    <div className='w-full min-w-0 space-y-8 pb-8 -mt-4'>
      {/* Always dark, like the movie / TV hero. */}
      <section className='relative w-full overflow-hidden bg-[#0d0c0f] text-white'>
        {detail.backdrop && (
          <div className='absolute inset-0'>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={detail.backdrop} alt='' className='w-full h-full object-cover opacity-40 blur-sm scale-105' />
            <div className='absolute inset-0 bg-gradient-to-t from-[#0d0c0f] via-[#0d0c0f]/60 to-transparent' />
          </div>
        )}
        <div className='relative z-10 flex flex-col md:flex-row items-center md:items-end gap-6 px-5 md:px-10 pt-16 md:pt-24 pb-10'>
          {detail.poster && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={detail.poster} alt={detail.title} className='w-40 md:w-52 rounded-xl shadow-2xl shadow-black shrink-0' />
          )}
          <div className='flex flex-col items-center md:items-start min-w-0 max-w-3xl' dir='auto'>
            <h1 className='text-3xl md:text-4xl font-bold text-center md:text-start'>{detail.title}</h1>
            <div className='flex flex-wrap gap-2 mt-3'>
              {detail.badges.map((badge) => (
                <span key={badge} className='bg-red-500 px-3 py-0.5 rounded-xl text-sm'>{badge}</span>
              ))}
              {detail.kind === 'series' && episodeCount > 0 && (
                <span className='bg-zinc-700 px-3 py-0.5 rounded-xl text-sm'>{t('tv.episodeCount', { count: episodeCount })}</span>
              )}
            </div>
            {detail.description && <p className='mt-4 text-gray-300 text-center md:text-start'>{detail.description}</p>}
            {detail.kind === 'movie' && (
              <a
                href={detail.url}
                target='_blank'
                rel='noopener noreferrer'
                className='mt-6 inline-flex items-center rounded-xl bg-red-500 hover:bg-red-400 text-white px-4 py-2 text-sm font-medium'
              >
                <FaPlay className='me-2' /> {t('tunisian.watchOnSource')}
              </a>
            )}
          </div>
        </div>
      </section>

      {detail.kind === 'series' && (
        <div className='px-4 sm:px-14 max-w-[1800px] mx-auto w-full'>
          {detail.seasons.length > 0 ? (
            <TunisianSeasons seasons={detail.seasons} />
          ) : (
            <p className='text-gray-400'>{t('tunisian.noEpisodes')}</p>
          )}
        </div>
      )}

      {more.length > 0 && (
        <section aria-label={t('tunisian.more')} className='px-4 sm:px-14 max-w-[1800px] mx-auto w-full'>
          <h2 className='text-2xl sm:text-3xl font-semibold mb-3'>{t('tunisian.more')}</h2>
          <div className={GRID_CLASS}>
            {more.map((title) => (
              <PosterCard
                key={title.slug}
                posterImg={title.poster}
                title={title.title}
                releaseDate={title.published}
                externalImg
                actions={false}
                link={`/tunisian/${title.slug}`}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
