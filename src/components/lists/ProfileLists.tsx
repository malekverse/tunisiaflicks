// The lists a page shows (/me, /u/[handle]). Its owner sees all of them, each marked with who can
// see it ('Only you', 'Friends', 'Anyone with the link'); anyone else only the ones opened up to
// them: 'friends' lists for friends, 'link' lists for friends and whoever holds the page's link.
// Never a private one, never the faces of the people who build them with the owner. Nothing at all
// when there is nothing to show (or for a Kids profile).
import { SectionHeader, Row } from '@/src/components/rows/Row'
import ListTile from '@/src/components/lists/ListTile'
import { getT } from '@/src/lib/i18n/server'
import { withTimeout } from '@/src/lib/with-timeout'
import { getOwnListsOf, getPublicListsOf, type ProfileListTile } from '@/src/lib/shared-lists/queries'
import { loadListViewer } from '@/src/lib/shared-lists/server'
import type { ProfileRef } from '@/src/lib/social/types'

const TILE_WIDTH = 'w-[58vw] max-w-[240px] sm:w-[232px] sm:max-w-none lg:w-[248px]'

export default async function ProfileLists(props: { owner: ProfileRef; viewer: ProfileRef | null; view: 'owner' | 'public'; linkAccess: boolean }): Promise<JSX.Element | null> {
  const { owner, viewer, view, linkAccess } = props
  const me = await loadListViewer()
  if (me?.kids) return null
  const own = view === 'owner' && !!viewer && viewer.profileId === owner.profileId
  const tiles: ProfileListTile[] = await withTimeout(
    own ? getOwnListsOf(owner) : getPublicListsOf(owner, viewer, linkAccess),
    4000,
    [],
  ).catch(() => [])
  if (tiles.length === 0) return null
  const t = getT()
  return (
    <section aria-labelledby="profile-lists">
      <SectionHeader title={<span id="profile-lists">{t('sharedLists.profile.title')}</span>} href={own ? '/lists' : undefined} />
      <Row itemClassName={TILE_WIDTH} label={t('sharedLists.profile.title')}>
        {tiles.map((tile) => (
          <ListTile
            key={tile.slug}
            slug={tile.slug}
            title={tile.title}
            posters={tile.posters}
            count={tile.count}
            members={tile.members}
            memberCount={own ? tile.memberCount : 1}
            marker={own ? tile.visibility : null}
          />
        ))}
      </Row>
    </section>
  )
}
