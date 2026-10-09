import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import InviteBanner from '@/src/components/share/InviteBanner'
import KidsBlocked from '@/src/components/profiles/KidsBlocked'
import ListScreen from '@/src/components/lists/ListScreen'
import { isInviteToken, readInvite } from '@/src/lib/invites'
import { getListBySlug } from '@/src/lib/lists-db'
import { getT } from '@/src/lib/i18n/server'
import { pageMetadata } from '@/src/lib/seo'
import { livePending, visibilityOf } from '@/src/lib/shared-lists/rules'
import { loadListViewer, nameOf, peopleFor, resolveAccess, toListView } from '@/src/lib/shared-lists/server'

export const dynamic = 'force-dynamic'

type Props = { params: { slug: string }; searchParams: { invite?: string | string[] } }

const tokenOf = (searchParams: Props['searchParams']) => {
  const raw = Array.isArray(searchParams.invite) ? searchParams.invite[0] : searchParams.invite
  return isInviteToken(raw) ? raw : null
}

/** A working invitation link to this very list (invalid ones are simply ignored). */
async function inviteFor(slug: string, token: string | null) {
  if (!token) return null
  const invite = await readInvite('list', token).catch(() => null)
  return invite && invite.targetId === slug && invite.uses < invite.maxUses ? invite : null
}

// Never indexed (lists are found through their link, not search engines), and the title only shows
// to people who may see the list.
export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const t = getT()
  const missing = { title: `${t('lists.notFound')} | TunisiaFlicks`, robots: { index: false, follow: false } }
  const list = await getListBySlug(params.slug)
  if (!list) return missing
  const viewer = await loadListViewer()
  const invite = await inviteFor(list.slug, tokenOf(searchParams))
  const { access } = await resolveAccess(list, viewer, { invited: !!invite })
  if (access === 'none') return missing
  const open = visibilityOf(list) === 'link'
  const names = list.items.slice(0, 5).map((item) => item.title).join(', ')
  const description = !open
    ? undefined
    : list.description || (names ? t('lists.metaTitles', { count: list.items.length, names: `${names}${list.items.length > 5 ? '…' : ''}` }) : t('lists.byOwner', { name: list.ownerName }))
  return pageMetadata({ title: t('lists.metaTitle', { title: list.title, name: list.ownerName }), description, path: `/lists/${params.slug}`, card: false, noIndex: true })
}

export default async function ListPage({ params, searchParams }: Props) {
  const t = getT()
  const token = tokenOf(searchParams)
  const viewer = await loadListViewer()
  const list = await getListBySlug(params.slug)

  // Kids see their own lists, nothing else (whether or not the address points anywhere).
  if (viewer?.kids) {
    const own = list ? (await resolveAccess(list, viewer)).access === 'owner' : false
    if (!list || !own) {
      const next = `/lists/${encodeURIComponent(params.slug)}${token ? `?invite=${encodeURIComponent(token)}` : ''}`
      return <KidsBlocked what="social" next={next} />
    }
  }
  if (!list) notFound()

  const invite = await inviteFor(list.slug, token)
  const { access, ownerProfileId } = await resolveAccess(list, viewer, { invited: !!invite })
  if (access === 'none') notFound()

  const member = access === 'owner' || access === 'editor'
  const view = await toListView(list, access, viewer, ownerProfileId)
  // Invited by name, waiting to answer.
  const pending = !member && viewer?.profileId ? livePending(list.pending, Date.now()).find((entry) => entry.profileId === viewer.profileId) : undefined

  let banner: React.ReactNode = null
  if (!member && (invite || pending)) {
    const inviterRef = pending ? { userId: list.userId, profileId: pending.invitedBy } : invite!.owner
    const inviter = (await peopleFor([inviterRef])).get(inviterRef.profileId) ?? null
    const full = (list.members?.length ?? 1) >= 8
    banner = (
        <InviteBanner
          token={token ?? ''}
          inviter={inviter}
          sentence={t('sharedLists.banner.sentence', { name: inviter?.name ?? (await nameOf(inviterRef)), list: list.title })}
          acceptLabel={t('sharedLists.banner.accept')}
          accept={{ endpoint: `/api/lists/${list.slug}/collaborators`, body: pending ? { accept: true } : {} }}
          signedIn={!!viewer}
          unavailable={full ? t('sharedLists.banner.full') : null}
          consent={t('sharedLists.banner.consent')}
        />
    )
  }

  return <ListScreen key={`${list.slug}:${access}`} initial={view} kids={!!viewer?.kids} banner={banner} />
}
