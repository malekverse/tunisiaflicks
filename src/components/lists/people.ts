// Small shared bits for drawing the people of a list on the client.
import type { AvatarPerson } from '@/src/lib/social/types'

/** Someone we can't name any more (they left and deleted their account). */
export const UNKNOWN: AvatarPerson = { name: '?', color: '#3f3f46', image: null, handle: null }
