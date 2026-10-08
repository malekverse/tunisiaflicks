// Home slot 7, "Friends are watching": titles friends shared lately, each with the faces of the
// friends who watched or rated it. Renders nothing otherwise (never a placeholder): for guests,
// Kids, TVs, people without a page or friends, or when fewer than 3 titles are worth showing.
// Mounted in src/app/page.tsx inside Suspense; its data is bounded to 4 seconds.
import PosterCard from '@/src/components/PosterCard'
import { Row, ROW_WIDTH, SectionHeader } from '@/src/components/rows/Row'
import { getLocale, getT } from '@/src/lib/i18n/server'
import { htmlLang } from '@/src/lib/i18n/locales'
import { getFriendsActivity, type ActivityItem } from '@/src/lib/social/activity'
import { mediaHref } from '@/src/lib/social/media'
import { socialSelf } from '@/src/lib/social/session'
import type { PublicIdentity, ShareMedia } from '@/src/lib/social/types'
import { withTimeout } from '@/src/lib/with-timeout'
import { AvatarStack } from './Avatar'

const MIN_TITLES = 3

export default async function FriendsRow(): Promise<JSX.Element | null> {
  const self = await socialSelf().catch(() => null)
  if (!self || self.kids || self.limited || !self.social) return null
  const feed = await withTimeout(getFriendsActivity(self.ref, { limit: 12, locale: getLocale() }), 4000, null)
  if (!feed || feed.items.length === 0) return null

  // One poster per title, with everyone who watched or rated it.
  const titles = new Map<string, { media: ShareMedia; people: PublicIdentity[] }>()
  for (const item of feed.items as ActivityItem[]) {
    const key = `${item.media.media_type}:${item.media.id}`
    const entry = titles.get(key) ?? { media: item.media, people: [] }
    if (!entry.people.some((person) => person.handle === item.actor.handle)) entry.people.push(item.actor)
    titles.set(key, entry)
  }
  if (titles.size < MIN_TITLES) return null

  const t = getT()
  const formatList = (names: string[]) => {
    try {
      return new Intl.ListFormat(htmlLang(getLocale()), { type: 'conjunction' }).format(names)
    } catch {
      return names.join(', ')
    }
  }
  return (
    <section>
      <SectionHeader title={t('social.row.title')} href="/friends" />
      <Row label={t('social.row.title')} itemClassName={ROW_WIDTH.poster}>
        {Array.from(titles.values()).map(({ media, people }) => (
          <PosterCard
            key={`${media.media_type}-${media.id}`}
            posterImg={media.poster_path}
            title={media.title}
            id={media.id}
            mediaType={media.media_type}
            link={mediaHref(media.media_type, media.id)}
            overlay={(
              <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end bg-gradient-to-t from-black/85 via-black/40 to-transparent p-2 pt-10">
                <AvatarStack
                  people={people}
                  total={people.length}
                  size={24}
                  label={t('social.row.watchedBy', { title: media.title, names: formatList(people.map((person) => person.name)) })}
                />
              </span>
            )}
          />
        ))}
      </Row>
    </section>
  )
}
