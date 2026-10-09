"use client"
// A list on /lists and on a profile's page: its fanned cover, with the faces of the people who
// build it on a glass pill, a red dot while it has titles you haven't seen, and '3 new'.
// The whole tile is one link.
import Link from 'next/link'
import { Link2, Lock, UsersRound } from 'lucide-react'
import { useT } from '@/src/components/I18nProvider'
import ListCover from '@/src/components/library/ListCover'
import { AvatarStack } from '@/src/components/social/Avatar'
import type { AvatarPerson } from '@/src/lib/social/types'
import type { ListVisibility } from '@/src/lib/shared-lists/types'

export const LISTS_GRID = 'grid grid-cols-[repeat(auto-fill,minmax(158px,1fr))] gap-x-4 gap-y-7 sm:grid-cols-[repeat(auto-fill,minmax(232px,1fr))] sm:gap-x-5 sm:gap-y-9'

const MARKER_ICON = { private: Lock, friends: UsersRound, link: Link2 }

export default function ListTile({ slug, title, posters, count, members, memberCount, unread = 0, marker }: {
  slug: string
  title: string
  posters: (string | null)[]
  count: number
  members: AvatarPerson[]
  memberCount: number
  unread?: number
  /** Who can see it, said under the title (the owner's own page). */
  marker?: ListVisibility | null
}) {
  const t = useT()
  const shared = memberCount > 1
  const MarkerIcon = marker ? MARKER_ICON[marker] : null
  const markerText = marker === 'private' ? t(shared ? 'sharedLists.marker.privateShared' : 'sharedLists.marker.private')
    : marker === 'friends' ? t('sharedLists.marker.friends') : marker === 'link' ? t('sharedLists.marker.link') : null
  return (
    <Link href={`/lists/${slug}`} className="group/cover block select-none rounded-tile outline-none [-webkit-touch-callout:none]">
      <div className="relative rounded-tile transition-[transform,box-shadow] duration-300 ease-out group-hover/cover:-translate-y-1 group-hover/cover:shadow-[0_22px_44px_-18px_rgb(0_0_0/0.9)] group-active/cover:scale-[0.98] group-focus-visible/cover:ring-2 group-focus-visible/cover:ring-red-500">
        <ListCover posters={posters} emptyLabel={t('library.emptyList')} />
        {shared && (
          <span className="glass absolute bottom-2.5 start-2.5 z-20 inline-flex items-center gap-1.5 rounded-full p-1 pe-2.5">
            <AvatarStack people={members} total={memberCount} size={24} label={t('sharedLists.peopleCount', { count: memberCount })} />
            {memberCount > members.length && <span className="sr-only">{t('sharedLists.peopleCount', { count: memberCount })}</span>}
          </span>
        )}
        {unread > 0 && (
          <span className="absolute end-2.5 top-2.5 z-20 h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_10px_rgb(255_36_20)] ring-2 ring-black">
            <span className="sr-only">{t('sharedLists.unread')}</span>
          </span>
        )}
      </div>
      <p className="mt-3 truncate px-0.5 text-[15px] font-semibold text-white/90 transition-colors group-hover/cover:text-white"><bdi>{title}</bdi></p>
      <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 px-0.5 text-[13px] text-white/50">
        <span>{count === 1 ? t('library.countOne') : t('library.count', { count })}</span>
        {unread > 0 && <span className="font-medium text-white/80">{t('sharedLists.newCount', { count: unread })}</span>}
        {markerText && MarkerIcon && (
          <span className="inline-flex items-center gap-1"><MarkerIcon aria-hidden className="h-3.5 w-3.5" />{markerText}</span>
        )}
      </p>
    </Link>
  )
}
