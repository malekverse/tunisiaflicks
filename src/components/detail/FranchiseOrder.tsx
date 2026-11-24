"use client"
// A film page's franchise in the order to watch it (lib/franchise): each film numbered, this one
// marked, the ones you've watched ticked, how many of them you've seen and which comes next. The
// films not out yet close the row.
import React from 'react'
import { Check } from 'lucide-react'
import PosterCard from '@/src/components/PosterCard'
import { Row, ROW_WIDTH, SectionHeader } from '@/src/components/rows/Row'
import { useT } from '@/src/components/I18nProvider'
import { toRoute } from '@/src/lib/card-props'
import { franchiseProgress, type Franchise } from '@/src/lib/franchise'
import { cn } from '@/src/lib/utils'
import Link from 'next/link'

export default function FranchiseOrder({ id, franchise, currentId, signedIn }: { id: string, franchise: Franchise, currentId: string, signedIn: boolean }) {
  const t = useT()
  const progress = franchiseProgress(franchise.parts, franchise.seen)
  const seen = new Set(franchise.seen)
  const done = progress.total > 0 && progress.watched === progress.total

  const subtitle = !signedIn
    ? t('franchise.count', { count: progress.total })
    : progress.watched === 0
      ? t('franchise.start', { count: progress.total })
      : done
        ? t('franchise.done', { count: progress.total })
        : t('franchise.progress', { watched: progress.watched, count: progress.total })

  let number = 0
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-[calc(var(--topbar)+72px)]">
      <SectionHeader
        title={<span id={`${id}-title`}>{franchise.name || t('franchise.title')}</span>}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>{subtitle}</span>
            {signedIn && progress.watched > 0 && !done && progress.next && progress.next.id !== currentId && (
              <Link href={`${toRoute('movie', progress.next.id)}#streamSection`} className="font-medium text-white/75 underline-offset-4 hover:text-white hover:underline">
                {t('franchise.next', { title: progress.next.title })}
              </Link>
            )}
          </span>
        }
      />
      {signedIn && progress.total > 0 && (
        <div className="page-x mb-4">
          <div className="h-1.5 max-w-[420px] overflow-hidden rounded-full bg-white/[0.08]" role="progressbar" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.watched} aria-label={subtitle}>
            <div className="h-full rounded-full bg-red-500 transition-[width] duration-700" style={{ width: `${(progress.watched / progress.total) * 100}%` }} />
          </div>
        </div>
      )}
      <Row itemClassName={ROW_WIDTH.poster} label={franchise.name}>
        {franchise.parts.map((part) => {
          const here = part.id === currentId
          const watched = seen.has(part.id)
          if (!part.upcoming) number += 1
          return (
            <PosterCard
              key={part.id}
              id={part.id}
              title={part.title}
              posterImg={part.poster}
              backdropImg={part.backdrop}
              voteAverage={part.vote}
              releaseDate={part.date ?? undefined}
              overview={part.overview}
              genreIds={part.genreIds}
              mediaType="movie"
              link={toRoute('movie', part.id)}
              className={cn(here && '[&>div:first-child]:ring-2 [&>div:first-child]:ring-red-500')}
              overlay={
                <>
                  <span className={cn('absolute start-2 top-2 grid h-7 min-w-7 place-items-center rounded-full px-1.5 text-[13px] font-bold tabular-nums ring-1 ring-inset', here ? 'bg-red-600 text-white ring-red-400/50' : 'bg-black/70 text-white ring-white/15 backdrop-blur-md')}>
                    {part.upcoming ? '…' : number}
                  </span>
                  {watched && (
                    <span className="absolute end-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-emerald-500 text-white shadow-lg" title={t('franchise.watched')}>
                      <Check aria-hidden className="h-4 w-4" strokeWidth={3} />
                      <span className="sr-only">{t('franchise.watched')}</span>
                    </span>
                  )}
                  {(here || part.upcoming) && (
                    <span className="absolute inset-x-2 bottom-2 rounded-full bg-black/75 px-2 py-1 text-center text-[11.5px] font-semibold text-white backdrop-blur-md">
                      {here ? t('franchise.thisFilm') : part.date ? t('franchise.coming', { year: part.date.slice(0, 4) }) : t('franchise.announced')}
                    </span>
                  )}
                </>
              }
            />
          )
        })}
      </Row>
    </section>
  )
}
