import PlusView, { type PlusData } from '@/src/components/plus/PlusView'
import PlusSignIn from '@/src/components/plus/PlusSignIn'
import KidsBlocked from '@/src/components/profiles/KidsBlocked'
import { getT } from '@/src/lib/i18n/server'
import { getActiveProfile, getKidsMode } from '@/src/lib/profiles'
import { getPlus, inviteProgress } from '@/src/lib/plus'
import { daysLeft, towardsNext } from '@/src/lib/plus-rules'
import { linkBase, pageMetadata } from '@/src/lib/seo'
import { supportUrl } from '@/src/lib/support-url'

// TunisiaFlicks+: the account's Plus, its perks' settings, and the ways to get it (Ko-fi, invites).
// Personal, so never indexed; Kids profiles never see it (no money talk).
export const dynamic = 'force-dynamic'

export function generateMetadata() {
  const t = getT()
  return pageMetadata({ title: 'TunisiaFlicks+', description: t('plus.subtitle'), path: '/plus', card: false, noIndex: true })
}

export default async function PlusPage() {
  const t = getT()
  if (await getKidsMode()) return <KidsBlocked title={t('support.kids.title')} description={t('support.kids.desc')} next="/plus" />
  const active = await getActiveProfile()
  if (!active) return <PlusSignIn />
  const [plus, invite] = await Promise.all([getPlus(active.userId), inviteProgress(active.userId)])
  const data: PlusData = {
    active: plus.active,
    accent: plus.accent,
    until: plus.until ? plus.until.toISOString() : null,
    daysLeft: daysLeft(plus.until),
    showBadge: plus.showBadge,
    membership: plus.membership,
    invite: {
      link: invite.code ? `${linkBase()}/?ref=${invite.code}` : null,
      friends: invite.friends,
      waiting: invite.waiting,
      months: invite.months,
      towardsNext: towardsNext(invite.friends),
    },
  }
  return <PlusView initial={data} kofi={!!supportUrl()} />
}
