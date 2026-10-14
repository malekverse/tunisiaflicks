import { OG_SIZE, renderSwipeCard } from '@/src/lib/og'
import { renderSection } from '@/src/lib/share-sections'
import { getRoom, isRoomCode } from '@/src/lib/swipe'
import { keptShareImage } from '@/src/lib/share-image-store'

// The invitation people see when a room link is sent to friends: the room's first cards, fanned
// out, and its code. A room that has expired gets the general Swipe card.
export const dynamic = 'force-dynamic'
export const maxDuration = 30
export const alt = 'Swipe to decide on TunisiaFlicks'
export const size = OG_SIZE
export const contentType = 'image/jpeg'

async function draw({ params }: { params: { code: string } }) {
  const code = params.code.toUpperCase()
  const room = isRoomCode(code) ? await getRoom(code).catch(() => null) : null
  if (!room) return renderSection('swipe')
  return renderSwipeCard({
    code,
    names: room.participants.map((participant) => participant.name),
    posters: room.deck.filter((card) => card.poster_path).slice(0, 3).map((card) => `https://image.tmdb.org/t/p/w342${card.poster_path}`),
  })
}

/** Kept once drawn, so a crawler never waits (lib/share-image-store). */
export default function Image({ params }: { params: { code: string } }) {
  return keptShareImage(`swipe/${params.code}`, () => draw({ params }), { personal: true })
}
