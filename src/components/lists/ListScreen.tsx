"use client"
// A list's page, below the invitation banner: the header (cover, title, who builds it, Invite and
// the share row), then the editor for the people in it, or the titles for everyone else. It stays
// in step with the others while it's open (useSharedList).
import { useState } from 'react'
import Link from 'next/link'
import { ChevronRight, ListPlus, ListVideo, UserPlus } from 'lucide-react'
import ShareButtons from '@/src/components/ShareButtons'
import PosterCard from '@/src/components/PosterCard'
import TmdbImage from '@/src/components/TmdbImage'
import ListCover from '@/src/components/library/ListCover'
import { EmptyState, GRID_CLASS } from '@/src/components/MediaGrid'
import { AvatarStack } from '@/src/components/social/Avatar'
import { Button } from '@/src/components/ui/button'
import { useI18n } from '@/src/components/I18nProvider'
import { useSharedList } from '@/src/hooks/use-shared-list'
import { toast } from '@/src/hooks/use-toast'
import { formatDate } from '@/src/lib/i18n/format'
import { openShare } from '@/src/store/share-sheet'
import type { SharedListView } from '@/src/lib/shared-lists/types'
import ListEditor from './ListEditor'
import ListPeopleSheet from './ListPeopleSheet'
import PeopleNames, { orderedMembers, useNameParts } from './PeopleNames'
import { listErrorText, listFetch } from './list-client'
import { UNKNOWN } from './people'

/** The invitation link stays the same while it works: one per tab, reused until it's turned off or used up. */
const linkKey = (slug: string) => `tf-list-invite:${slug}`

export default function ListScreen({ initial, kids, banner }: { initial: SharedListView; kids: boolean; banner?: React.ReactNode }) {
  const { t, locale } = useI18n()
  const shared = useSharedList(initial)
  const { list } = shared
  const [peopleOpen, setPeopleOpen] = useState(false)
  const [inviting, setInviting] = useState(false)
  const member = list.role === 'owner' || list.role === 'editor'
  const owner = list.role === 'owner'
  const count = list.items.length
  const updated = formatDate(list.updatedAt, locale, { day: 'numeric', month: 'short', year: 'numeric' })
  const glow = list.items.find((item) => item.poster_path)?.poster_path
  const showPeople = member && (list.memberCount > 1 || list.pendingCount > 0)
  const visibleToOthers = list.visibility !== 'private'
  const ordered = orderedMembers(list.members)
  const names = useNameParts(list.members, list.people)

  /** Invite: a link (made once, then reused while it works) in the share sheet, which can also send it to friends. */
  const invite = async () => {
    if (inviting) return
    setInviting(true)
    try {
      let url: string | null = null
      try {
        const kept = JSON.parse(sessionStorage.getItem(linkKey(list.slug)) ?? 'null') as { url: string; expiresAt: string } | null
        if (kept && new Date(kept.expiresAt).getTime() > Date.now() + 60_000) {
          const status = await listFetch<{ invite: { active: boolean; expiresAt: string | null } | null }>(`/api/lists/${encodeURIComponent(list.slug)}/collaborators`)
          if (status?.invite?.active && status.invite.expiresAt === kept.expiresAt) url = kept.url
        }
      } catch {
        // No storage, or the check failed: make a new link.
      }
      if (!url) {
        const made = await listFetch<{ url: string; expiresAt: string }>(`/api/lists/${encodeURIComponent(list.slug)}/collaborators`, { method: 'POST', body: { invite: 'link' } })
        if (!made) throw new Error('no link')
        url = made.url
        try { sessionStorage.setItem(linkKey(list.slug), JSON.stringify(made)) } catch { /* private mode */ }
      }
      openShare({
        kind: 'invite',
        target: 'list',
        url,
        title: list.title,
        text: t('sharedLists.inviteText', { list: list.title }),
        sendTo: { endpoint: `/api/lists/${encodeURIComponent(list.slug)}/collaborators`, body: {} },
      })
    } catch (error) {
      toast({ variant: 'destructive', title: (error as { code?: string })?.code ? listErrorText(t, error) : t('sharedLists.inviteFailed') })
    } finally {
      setInviting(false)
    }
  }

  return (
    <div className="page-top relative isolate pb-10">
      {/* The first poster, blurred into a soft light behind the header. */}
      {glow && (
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] overflow-hidden opacity-45 [mask-image:linear-gradient(to_bottom,black,transparent)]">
          <TmdbImage kind="poster" path={glow} alt="" fill sizes="120px" shimmer={false} priority className="scale-125 object-cover blur-[80px] saturate-150" />
        </div>
      )}

      {banner && <div className="mb-8 sm:mb-10">{banner}</div>}

      <header className="page-x">
        <div className="flex flex-col gap-7 md:flex-row md:items-end md:gap-10">
          <ListCover posters={list.items.map((item) => item.poster_path)} emptyLabel={t('library.emptyList')} priority className="w-full max-w-[300px] shadow-[0_30px_80px_-30px_rgb(0_0_0/0.95)] max-md:max-w-[220px]" />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-[clamp(34px,5vw,64px)] font-extrabold leading-[0.95] text-white"><bdi>{list.title}</bdi></h1>

            {showPeople && (
              <button
                type="button"
                onClick={() => setPeopleOpen(true)}
                aria-label={`${t('sharedLists.people.label')}: ${names.text}`}
                className="group pressable mt-4 inline-flex min-h-11 max-w-full items-center gap-3 rounded-full bg-white/[0.06] py-1.5 pe-3 ps-1.5 text-start outline-none ring-1 ring-inset ring-white/[0.07] transition-colors hover:bg-white/[0.1] focus-visible:ring-2 focus-visible:ring-red-500"
              >
                <AvatarStack people={ordered.map((entry) => list.people[entry.id] ?? UNKNOWN)} total={list.memberCount} size={32} />
                <PeopleNames members={list.members} people={list.people} className="min-w-0 truncate text-[14px] font-medium text-white/85" />
                <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-white/50 transition-transform duration-200 ease-out group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
              </button>
            )}

            <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] text-white/55">
              {/* People outside the list only ever see the owner's name. */}
              {!showPeople && <span>{t('lists.byOwner', { name: list.ownerName })}</span>}
              <span>{count === 1 ? t('library.countOne') : t('library.count', { count })}</span>
              <span>{t('lists.updatedOn', { date: updated })}</span>
            </p>
            {list.description && <p dir="auto" className="mt-4 max-w-[65ch] text-pretty text-[15px] leading-relaxed text-white/75">{list.description}</p>}

            {(owner && !kids) || visibleToOthers ? (
              <div className="mt-6 flex flex-wrap items-center gap-2.5">
                {owner && !kids && (
                  <Button size="lg" onClick={invite} disabled={inviting} className="h-11 sm:h-12">
                    <UserPlus aria-hidden className="h-[18px] w-[18px]" />{t('sharedLists.invite')}
                  </Button>
                )}
                {visibleToOthers && (
                  <ShareButtons url={`/lists/${list.slug}`} title={list.title} text={t('lists.shareText', { title: list.title, name: list.ownerName })} quiet={owner && !kids} />
                )}
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <div className="page-x mt-10 sm:mt-12">
        {member ? (
          <ListEditor shared={shared} kids={kids} onOpenPeople={() => setPeopleOpen(true)} />
        ) : count === 0 ? (
          <EmptyState icon={<ListVideo aria-hidden className="h-6 w-6" />} title={t('lists.emptyPublic')} />
        ) : (
          <ol className={GRID_CLASS}>
            {list.items.map((item, index) => (
              <li key={`${item.media_type}-${item.id}`}>
                <PosterCard
                  posterImg={item.poster_path}
                  title={item.title}
                  mediaType={item.media_type}
                  id={item.id}
                  link={`/${item.media_type}/${item.id}`}
                  overlay={<span className="glass absolute start-2 top-2 min-w-[28px] rounded-full px-2 py-0.5 text-center text-[12px] font-semibold tabular-nums text-white">{index + 1}</span>}
                />
              </li>
            ))}
          </ol>
        )}

        {!member && (
          <div className="mt-12">
            <Button asChild variant="secondary" size="lg">
              <Link href="/lists"><ListPlus aria-hidden className="h-5 w-5" />{t('lists.makeYourOwn')}</Link>
            </Button>
          </div>
        )}
      </div>

      {member && !kids && (
        <ListPeopleSheet
          open={peopleOpen}
          onOpenChange={setPeopleOpen}
          list={list}
          onChanged={shared.refresh}
          onVisibility={shared.setVisibility}
        />
      )}
    </div>
  )
}
