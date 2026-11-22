// Taste match, on a friend's page (/u/[handle]): how close your ratings are to theirs, the titles
// you both loved, where you disagree, what they loved that you haven't rated and the other way
// round. Only for a signed-in visitor who may see that person's ratings; nothing of it is ever
// shown to them. Server component, streamed (it renders nothing when there's nothing to compare).
import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import PosterCard from '@/src/components/PosterCard'
import TmdbImage from '@/src/components/TmdbImage'
import { Row, SectionHeader } from '@/src/components/rows/Row'
import { StarsReadOnly } from '@/src/components/social/RatingStars'
import ScoreRing from '@/src/components/social/ScoreRing'
import { getLocale, getT } from '@/src/lib/i18n/server'
import { richT } from '@/src/lib/i18n/rich'
import { MIN_COMMON, type Verdict } from '@/src/lib/taste'
import { getTasteMatch } from '@/src/lib/social/taste'
import type { ProfileRef, PublicIdentity, ShareMedia } from '@/src/lib/social/types'
import { withTimeout } from '@/src/lib/with-timeout'

const POSTER_WIDTH = 'w-[34vw] max-w-[150px] sm:w-[156px] sm:max-w-none lg:w-[168px] 2xl:w-[196px]'
const SHADE = 'pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-start gap-1 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-2 pt-12'

const VERDICT_KEY: Record<Verdict, 'taste.verdict.twins' | 'taste.verdict.great' | 'taste.verdict.common' | 'taste.verdict.opposites'> = {
  twins: 'taste.verdict.twins',
  great: 'taste.verdict.great',
  common: 'taste.verdict.common',
  opposites: 'taste.verdict.opposites',
}

function Posters({ label, items }: { label: string, items: { media: ShareMedia, overlay: React.ReactNode }[] }) {
  return (
    <Row label={label} itemClassName={POSTER_WIDTH}>
      {items.map(({ media, overlay }) => (
        <PosterCard
          key={`${media.media_type}-${media.id}`}
          posterImg={media.poster_path}
          title={media.title}
          id={media.id}
          mediaType={media.media_type}
          link={`/${media.media_type}/${media.id}`}
          overlay={overlay}
        />
      ))}
    </Row>
  )
}

/** "You" and "Lina" with their stars, on a poster. */
function BothStars({ mine, theirs, name }: { mine: number, theirs: number, name: string }) {
  const t = getT()
  return (
    <span className={SHADE}>
      <span className="glass inline-flex h-6 items-center gap-1.5 rounded-full px-2 text-[11px] font-semibold text-white">{t('taste.you')}<StarsReadOnly stars={mine} size={10} /></span>
      <span className="glass inline-flex h-6 max-w-full items-center gap-1.5 rounded-full px-2 text-[11px] font-semibold text-white"><bdi className="truncate">{name}</bdi><StarsReadOnly stars={theirs} size={10} /></span>
    </span>
  )
}

export default async function TasteMatch({ viewer, owner, person, shareKey }: {
  viewer: ProfileRef
  owner: ProfileRef
  person: PublicIdentity
  shareKey: string | null
}) {
  const t = getT()
  const match = await withTimeout(getTasteMatch(viewer, owner, { shareKey, locale: getLocale() }), 8000, null).catch(() => null)
  // Nothing they share to compare with: their ratings section already says so.
  if (!match || match.counts.theirs === 0) return null
  const name = person.name
  const first = name.split(/\s+/)[0] || name
  const media = (key: string) => match.media[key]

  const summary = match.score !== null
    ? richT(t, 'taste.common', { count: match.common })
    : match.counts.mine === 0
      ? t('taste.noRatings')
      : richT(t, 'taste.needMore', { count: MIN_COMMON - match.common, name })

  return (
    <section id="taste" aria-labelledby="taste-title" className="scroll-mt-[calc(var(--topbar)+env(safe-area-inset-top,0px)+20px)] space-y-8">
      <div className="page-x">
        <div className="flex max-w-[760px] items-center gap-5 rounded-[22px] bg-white/[0.04] p-5 ring-1 ring-white/[0.07] sm:gap-7 sm:p-6">
          <ScoreRing score={match.score} />
          <div className="min-w-0">
            <h2 id="taste-title" className="text-[14px] font-medium text-white/60">{richT(t, 'taste.title', { name })}</h2>
            <p className="mt-1 font-display text-[clamp(24px,4vw,32px)] font-extrabold leading-tight text-white">
              {match.verdict ? t(VERDICT_KEY[match.verdict]) : t('taste.verdict.unknown')}
            </p>
            <p className="mt-1.5 text-[14px] leading-relaxed text-white/60">{summary}</p>
            {match.score === null && match.theyLoved.length > 0 && (
              <p className="mt-3 inline-flex items-center gap-2 text-[13.5px] text-white/75"><Sparkles aria-hidden className="h-4 w-4 text-red-500" />{t('taste.startHere')}</p>
            )}
          </div>
        </div>
      </div>

      {match.bothLoved.length > 0 && (
        <div>
          <SectionHeader title={t('taste.bothLoved')} />
          <Posters
            label={t('taste.bothLoved')}
            items={match.bothLoved.flatMap((pair) => (media(pair.key) ? [{ media: media(pair.key), overlay: <BothStars mine={pair.mine} theirs={pair.theirs} name={first} /> }] : []))}
          />
        </div>
      )}

      {match.theyLoved.length > 0 && (
        <div>
          <SectionHeader title={richT(t, 'taste.theyLoved', { name: first })} />
          <Posters
            label={t('taste.theyLoved', { name: first })}
            items={match.theyLoved.flatMap((row) => (media(row.key) ? [{
              media: media(row.key),
              overlay: <span className={SHADE}><StarsReadOnly stars={row.stars} size={13} className="glass rounded-full px-2 py-1" /></span>,
            }] : []))}
          />
        </div>
      )}

      {match.disagree.length > 0 && (
        <div className="page-x">
          <h3 className="mb-3 font-display text-[21px] font-bold leading-tight text-white sm:text-[26px]">{t('taste.disagree')}</h3>
          <ul className="grid max-w-[1100px] gap-2.5 sm:grid-cols-2">
            {match.disagree.flatMap((pair) => {
              const item = media(pair.key)
              if (!item) return []
              return [(
                <li key={pair.key}>
                  <Link href={`/${item.media_type}/${item.id}`} className="pressable flex items-center gap-3.5 rounded-[18px] bg-white/[0.04] p-2.5 pe-4 outline-none ring-1 ring-white/[0.07] transition-colors hover:bg-white/[0.07] focus-visible:ring-2 focus-visible:ring-red-500">
                    <span className="relative aspect-[2/3] w-[52px] shrink-0 overflow-hidden rounded-[8px] bg-white/[0.06]">
                      <TmdbImage kind="poster" path={item.poster_path} name={item.title} alt="" fill sizes="52px" className="object-cover" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <bdi dir="auto" className="block truncate text-[15px] font-semibold text-white">{item.title}</bdi>
                      <span className="mt-1.5 grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1 text-[12.5px] text-white/60">
                        <span>{t('taste.you')}</span><StarsReadOnly stars={pair.mine} size={12} />
                        <bdi className="truncate">{first}</bdi><StarsReadOnly stars={pair.theirs} size={12} />
                      </span>
                    </span>
                  </Link>
                </li>
              )]
            })}
          </ul>
        </div>
      )}

      {match.youLoved.length > 0 && (
        <div>
          <SectionHeader title={richT(t, 'taste.youLoved', { name: first })} />
          <Posters
            label={t('taste.youLoved', { name: first })}
            items={match.youLoved.flatMap((row) => (media(row.key) ? [{
              media: media(row.key),
              overlay: <span className={SHADE}><StarsReadOnly stars={row.stars} size={13} className="glass rounded-full px-2 py-1" /></span>,
            }] : []))}
          />
        </div>
      )}
    </section>
  )
}
