// The body of someone's page (/u/[handle]): what they watched lately and what they rated, as far
// as they share it with you. The owner sees everything, each section marked with who else sees
// it ('Only you' with a lock while private). Visitors get a calm lock panel for what isn't shared
// with them, in noun forms ('Watching is private'). Server component.
import { Link2, Lock, UsersRound } from 'lucide-react'
import PosterCard from '@/src/components/PosterCard'
import { Row, SectionHeader } from '@/src/components/rows/Row'
import { StarsReadOnly } from '@/src/components/social/RatingStars'
import { getT } from '@/src/lib/i18n/server'
import type { ActivityItem } from '@/src/lib/social/activity'
import type { PrivacySettings, ShareMedia, Visibility } from '@/src/lib/social/types'
import { activityChip } from '@/src/app/friends/_lib/feed'

// ROW_WIDTH.poster, written out: a value exported from a client module can't be read on the server.
const POSTER_WIDTH = 'w-[34vw] max-w-[150px] sm:w-[156px] sm:max-w-none lg:w-[168px] 2xl:w-[196px]'

type Rated = { media: ShareMedia; stars: number; day: string }

/** Who else sees a section of your page, as the owner is reminded of it. */
function Audience({ value }: { value: Visibility }) {
  const t = getT()
  const Icon = value === 'private' ? Lock : value === 'friends' ? UsersRound : Link2
  const label = value === 'private' ? t('social.page.onlyYou') : value === 'friends' ? t('social.visibility.friends') : t('social.visibility.link')
  return (
    <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white/[0.06] px-3 text-[12.5px] font-medium text-white/70 ring-1 ring-inset ring-white/[0.06]">
      <Icon aria-hidden className="h-3.5 w-3.5" />{label}
    </span>
  )
}

function Quiet({ children }: { children: React.ReactNode }) {
  return <p className="page-x text-[14px] text-white/55">{children}</p>
}

function PosterRow({ label, items }: { label: string; items: { media: ShareMedia; overlay: React.ReactNode }[] }) {
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

export default function ProfileSections({ isOwner, privacy, activity, ratings }: {
  isOwner: boolean
  privacy: PrivacySettings
  activity: { visible: boolean; items: ActivityItem[] }
  ratings: { visible: boolean; items: Rated[] }
}) {
  const t = getT()
  const paused = privacy.paused
  const hidden = [
    !activity.visible && t('social.page.activityPrivate'),
    !ratings.visible && t('social.page.ratingsPrivate'),
  ].filter((line): line is string => !!line)

  return (
    <div className="space-y-10 sm:space-y-12">
      {activity.visible && (
        <section aria-labelledby="page-recent">
          <SectionHeader
            title={<span id="page-recent">{t('social.page.recent')}</span>}
            end={isOwner ? <Audience value={paused ? 'private' : privacy.activity} /> : undefined}
          />
          {activity.items.length === 0 ? (
            <Quiet>{isOwner ? t('social.page.recentEmptyOwner') : t('social.page.recentEmpty')}</Quiet>
          ) : (
            <PosterRow
              label={t('social.page.recent')}
              items={activity.items.map((item) => {
                const chip = activityChip(t, item)
                return {
                  media: item.media,
                  overlay: chip ? (
                    <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end bg-gradient-to-t from-black/85 via-black/35 to-transparent p-2 pt-10">
                      <span className="glass inline-flex h-6 items-center rounded-full px-2.5 text-[11.5px] font-semibold text-white">{chip}</span>
                    </span>
                  ) : null,
                }
              })}
            />
          )}
        </section>
      )}

      {ratings.visible && (
        <section aria-labelledby="page-ratings">
          <SectionHeader
            title={<span id="page-ratings">{t('social.ratings.title')}</span>}
            end={isOwner ? <Audience value={paused ? 'private' : privacy.ratings} /> : undefined}
          />
          {ratings.items.length === 0 ? (
            <Quiet>{isOwner ? t('social.page.ratingsEmptyOwner') : t('social.page.ratingsEmpty')}</Quiet>
          ) : (
            <PosterRow
              label={t('social.ratings.title')}
              items={ratings.items.map((item) => ({
                media: item.media,
                overlay: (
                  <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end bg-gradient-to-t from-black/85 via-black/35 to-transparent p-2 pt-10">
                    <StarsReadOnly stars={item.stars} size={13} className="glass rounded-full px-2 py-1" />
                  </span>
                ),
              }))}
            />
          )}
        </section>
      )}

      {!isOwner && hidden.length > 0 && (
        <div className="page-x">
          <div className="flex max-w-xl items-center gap-4 rounded-[22px] bg-white/[0.04] p-5 ring-1 ring-white/[0.07]">
            <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/[0.07]"><Lock className="h-5 w-5 text-white/70" /></span>
            <ul className="space-y-0.5 text-[15px] font-medium text-white/80">
              {hidden.map((line) => <li key={line}>{line}</li>)}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
