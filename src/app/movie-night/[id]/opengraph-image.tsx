import { OG_SIZE, renderFallbackCard, renderNightCard } from '@/src/lib/og'
import { getNight } from '@/src/lib/movie-night'
import { firstName, isNightId } from '@/src/lib/movie-night-rules'
import { nightDay, nightTime } from '@/src/lib/movie-night-format'
import { avatarPerson } from '@/src/lib/social/identity'
import { keptShareImage } from '@/src/lib/share-image-store'

// What people see when a night's link is pasted into WhatsApp or Messenger: the host's first name,
// the date and the posters. Never who else is coming, the place or the note.
export const dynamic = 'force-dynamic'
export const maxDuration = 30
export const alt = 'A movie night on TunisiaFlicks'
export const size = OG_SIZE
export const contentType = 'image/jpeg'

async function draw({ params }: { params: { id: string } }) {
  const night = isNightId(params.id) ? await getNight(params.id).catch(() => null) : null
  if (!night) return renderFallbackCard()
  const host = await avatarPerson(night.host).catch(() => null)
  const posters = (night.chosen ? [night.chosen.media.poster_path] : night.candidates.map((candidate) => candidate.media.poster_path))
    .filter((path): path is string => !!path)
  return renderNightCard({
    host: host ? firstName(host.name) : '',
    when: `${nightDay(night.starts_at, night.tz, 'en')}, ${nightTime(night.starts_at, night.tz, 'en')}`,
    film: night.chosen?.media.title ?? null,
    posters,
    cancelled: night.status === 'cancelled',
  })
}

/** Kept once drawn, so a crawler never waits (lib/share-image-store). */
export default function Image({ params }: { params: { id: string } }) {
  return keptShareImage(`movie-night/${params.id}`, () => draw({ params }), { personal: true })
}
