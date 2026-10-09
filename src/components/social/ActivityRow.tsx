"use client"
// One line of the friends feed: the poster (with the friend's face on its corner), one sentence
// ('Sami finished season 1 of The Bear', in Arabic a noun form), the stars when it's a rating, a
// small chip for an episode or a finale, and Save. Never a time: the day group above says when.
// The name goes to their page, the poster and the title to the title; Save is its own button.
import Link from 'next/link'
import { Bookmark, BookmarkCheck } from 'lucide-react'
import { useI18n } from '@/src/components/I18nProvider'
import TmdbImage from '@/src/components/TmdbImage'
import { UserAvatar } from '@/src/components/social/Avatar'
import { StarsReadOnly } from '@/src/components/social/RatingStars'
import { useLibraryToggle } from '@/src/hooks/use-library-toggle'
import { richT } from '@/src/lib/i18n/rich'
import type { ActivityItem } from '@/src/lib/social/activity'
import { cn } from '@/src/lib/utils'
import { useInLibrary } from '@/src/store/library'
import { ACTIVITY_SENTENCE, activityChip, activitySentence } from '@/src/app/friends/_lib/feed'

const href = (item: ActivityItem) => `/${item.media.media_type}/${item.media.id}`

export default function ActivityRow({ item }: { item: ActivityItem }) {
  const { t } = useI18n()
  const toggle = useLibraryToggle()
  const saved = useInLibrary('saved', item.media)
  const chip = activityChip(t, item)
  const link = 'rounded-sm outline-none underline-offset-[3px] decoration-white/40 hover:underline focus-visible:ring-2 focus-visible:ring-red-500'

  const line = richT(t, ACTIVITY_SENTENCE[item.kind], {
    name: <Link href={`/u/${item.actor.handle}`} className={link}>{item.actor.name}</Link>,
    title: <Link href={href(item)} className={link}>{item.media.title}</Link>,
    season: item.season ?? '',
    episode: item.episode ?? '',
  }, { bold: ['name', 'title'] })

  return (
    <article
      aria-label={activitySentence(t, item)}
      data-activity-row=""
      data-poster={item.media.poster_path ?? ''}
      className="flex items-center gap-4 p-3 sm:gap-5 sm:p-4"
    >
      {/* The poster repeats the title's link: one tab stop is enough. */}
      <Link href={href(item)} tabIndex={-1} aria-hidden className="pressable relative block w-16 shrink-0 sm:w-[76px]">
        <span className="relative block aspect-[2/3] overflow-hidden rounded-poster bg-white/[0.05] ring-1 ring-inset ring-white/[0.08]">
          <TmdbImage kind="poster" path={item.media.poster_path} alt="" fill sizes="(min-width: 640px) 76px, 64px" className="object-cover" />
        </span>
        <UserAvatar person={item.actor} size={24} className="absolute -bottom-1.5 -end-1.5 ring-2 ring-[#101012] sm:hidden" />
        <UserAvatar person={item.actor} size={32} className="absolute -bottom-2 -end-2 hidden ring-2 ring-[#101012] sm:inline-flex" />
      </Link>

      <div className="min-w-0 flex-1">
        <p className="text-pretty text-[15px] leading-snug text-white/75 sm:text-[16px]">{line}</p>
        {(chip || (item.kind === 'rated' && item.stars)) && (
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            {item.kind === 'rated' && item.stars ? <StarsReadOnly stars={item.stars} size={15} /> : null}
            {chip && <span className="inline-flex h-6 items-center rounded-full bg-white/[0.08] px-2.5 text-[12px] font-medium text-white/75 ring-1 ring-inset ring-white/[0.06]">{chip}</span>}
          </div>
        )}
      </div>

      <button
        type="button"
        aria-pressed={saved}
        aria-label={t(saved ? 'social.feed.unsave' : 'social.feed.save', { title: item.media.title })}
        title={t(saved ? 'hero.removeSaved' : 'hero.saveForLater')}
        onClick={() => toggle('saved', { id: item.media.id, title: item.media.title, poster_path: item.media.poster_path, media_type: item.media.media_type })}
        className={cn(
          'pressable grid h-11 w-11 shrink-0 place-items-center rounded-full outline-none transition-colors duration-150 [-webkit-tap-highlight-color:transparent] [touch-action:manipulation] focus-visible:ring-2 focus-visible:ring-red-500',
          saved ? 'bg-white text-black hover:bg-white/85' : 'bg-white/[0.06] text-white/75 hover:bg-white/[0.12] hover:text-white',
        )}
      >
        {saved ? <BookmarkCheck aria-hidden className="h-[18px] w-[18px]" strokeWidth={2.1} /> : <Bookmark aria-hidden className="h-[18px] w-[18px]" strokeWidth={2} />}
      </button>
    </article>
  )
}
