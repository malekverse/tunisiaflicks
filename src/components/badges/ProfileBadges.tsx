// STUB: implemented by badges in wave 2; keep the signature
// The badge shelf and weekly streak on a profile page (/me, /u/[handle]), as the owner sees it or
// as others may.
import type { ProfileRef } from '@/src/lib/social/types'

export default async function ProfileBadges(props: { owner: ProfileRef; view: 'owner' | 'public' }): Promise<JSX.Element | null> {
  void props
  return null
}
