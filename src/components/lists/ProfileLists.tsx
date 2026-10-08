// STUB: implemented by shared-lists in wave 2; keep the signature
// The lists a profile shows on its page (/me, /u/[handle]): all of them for the owner, the ones the
// viewer may see otherwise (linkAccess = the viewer holds the share key).
import type { ProfileRef } from '@/src/lib/social/types'

export default async function ProfileLists(props: { owner: ProfileRef; viewer: ProfileRef | null; view: 'owner' | 'public'; linkAccess: boolean }): Promise<JSX.Element | null> {
  void props
  return null
}
