// /u/[handle]: someone's page. Their name, handle, few words and badges, and what they share with
// you (recently watched, ratings, lists). ?k= is the page's private link: it opens what they set to
// 'Anyone with the link' (never echoed into a link here). ?invite= is a friend invitation: the
// banner on top answers it (and survives signing in, picking a profile and creating a page).
import type { Metadata } from 'next'
import { notFound, permanentRedirect } from 'next/navigation'
import ProfileBadges from '@/src/components/badges/ProfileBadges'
import ProfileLists from '@/src/components/lists/ProfileLists'
import KidsBlocked from '@/src/components/profiles/KidsBlocked'
import InviteBanner from '@/src/components/share/InviteBanner'
import RoomTint from '@/src/components/shell/RoomTint'
import ProfileHeader from '@/src/components/social/ProfileHeader'
import ProfileSections from '@/src/components/social/ProfileSections'
import { withCallback } from '@/src/components/auth/links'
import { isInviteToken, readInvite } from '@/src/lib/invites'
import { dateLocale } from '@/src/lib/i18n/locales'
import { getLocale, getT } from '@/src/lib/i18n/server'
import { pageMetadata } from '@/src/lib/seo'
import { getRecentActivity } from '@/src/lib/social/activity'
import { getRecentRatings } from '@/src/lib/social/ratings'
import { withTimeout } from '@/src/lib/with-timeout'
import { rgbTriplet } from '@/src/app/friends/_lib/feed'
import { pathWithQuery } from '@/src/app/friends/_lib/gates'
import { loadProfileView } from './data'

export const dynamic = 'force-dynamic'

type Props = { params: { handle: string }; searchParams: Record<string, string | string[] | undefined> }

const keyOf = (searchParams: Props['searchParams']) => (typeof searchParams.k === 'string' && searchParams.k.length <= 64 ? searchParams.k : null)

// The real 404 and 308 come from the middleware (../_lib/gate.ts): under the root loading screen
// the page streams with a 200 whatever it finds, metadata included. Here a page nobody may see
// only gets a quiet, unindexed title.
export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const t = getT()
  const view = await loadProfileView(params.handle, keyOf(searchParams))
  if (view.kind !== 'page') return { title: `${t('notFound.message')} | TunisiaFlicks`, robots: { index: false, follow: false } }
  const { identity } = view
  return pageMetadata({
    title: t('social.page.metaTitle', { name: identity.name }),
    description: t('social.page.metaDescription', { name: identity.name, handle: identity.handle }),
    path: `/u/${identity.handle}`,
    card: false,
    noIndex: true,
  })
}

export default async function ProfilePage({ params, searchParams }: Props) {
  const key = keyOf(searchParams)
  const view = await loadProfileView(params.handle, key)
  if (view.kind === 'not_found') notFound()
  if (view.kind === 'redirect') permanentRedirect(pathWithQuery(`/u/${view.to}`, searchParams))
  if (view.kind === 'kids_viewer') {
    // Back here after a grown-up profile is picked (the invitation too; never the private key).
    return <KidsBlocked what="social" next={pathWithQuery(`/u/${params.handle.toLowerCase()}`, searchParams, ['k'])} />
  }

  const t = getT()
  const locale = getLocale()
  const { owner, identity, page, privacy, viewer, viewerRef, isOwner } = view
  const path = `/u/${identity.handle}`

  const [activity, ratings] = await Promise.all([
    view.can.activity ? withTimeout(getRecentActivity(owner, viewerRef, 20, locale), 8000, []).catch(() => []) : [],
    view.can.ratings ? withTimeout(getRecentRatings(owner, viewerRef, { shareKey: key, limit: 30, locale }), 8000, []).catch(() => []) : [],
  ])

  // ?invite=: a friend invitation to this page (not on your own page).
  const token = typeof searchParams.invite === 'string' && isInviteToken(searchParams.invite) ? searchParams.invite : null
  let unavailable: string | null = null
  if (token && !isOwner) {
    const invite = await readInvite('friend', token).catch(() => null)
    if (!invite || invite.targetId !== owner.profileId || invite.uses >= invite.maxUses) unavailable = t('social.invite.unavailable')
    else if (view.relationship === 'friends') unavailable = t('social.invite.alreadyFriends')
  }

  const since = view.friendsSince
    ? view.friendsSince.toLocaleDateString(dateLocale(locale), { month: 'long', year: 'numeric', timeZone: 'Africa/Tunis' })
    : null
  // The room takes the newest poster on show, or the person's colour.
  const poster = activity[0]?.media.poster_path ?? ratings[0]?.media.poster_path ?? null
  const viewerKind = isOwner ? 'member' : viewer.kind === 'guest' ? 'guest' : viewer.kind === 'member' ? (viewer.social ? 'member' : 'setup') : 'other'
  const showBadges = view.can.badges

  return (
    <div className="pb-10">
      <RoomTint poster={poster} color={poster ? undefined : rgbTriplet(identity.color) ?? undefined} />
      {token && !isOwner && (
        <div className="page-top">
          <InviteBanner
            token={token}
            inviter={identity}
            sentence={t('social.invite.friendSentence', { name: identity.name })}
            acceptLabel={t('social.invite.friendAccept')}
            accept={{ endpoint: '/api/social/requests', body: {} }}
            signedIn={viewer.kind !== 'guest'}
            unavailable={unavailable}
            consent={t('social.invite.friendConsent')}
          />
        </div>
      )}
      <ProfileHeader
        person={identity}
        bio={page.bio}
        isOwner={isOwner}
        viewer={viewerKind}
        relationship={view.relationship}
        requestId={view.requestId}
        friendsSince={since}
        requestsOff={privacy.requests === 'nobody'}
        // Share profile gives the page link: the owner's own, or the one a visitor came with (only
        // when it matched; it is never put into a link on the page).
        shareUrl={isOwner || view.linkAccess ? `${path}?k=${encodeURIComponent(page.shareKey)}` : path}
        loginHref={withCallback('/login', path)}
        badges={showBadges ? <ProfileBadges owner={owner} view={isOwner ? 'owner' : 'public'} /> : undefined}
        belowBanner={!!token && !isOwner}
        invitePending={!!token && !isOwner && !unavailable}
      />
      <div className="mt-10 space-y-10 sm:mt-12 sm:space-y-12">
        <ProfileSections
          isOwner={isOwner}
          privacy={privacy}
          activity={{ visible: view.can.activity, items: activity }}
          ratings={{ visible: view.can.ratings, items: ratings }}
        />
        <ProfileLists owner={owner} viewer={viewerRef} view={isOwner ? 'owner' : 'public'} linkAccess={view.linkAccess} />
      </div>
    </div>
  )
}
