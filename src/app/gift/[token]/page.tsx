import GiftRedeem from '@/src/components/plus/GiftRedeem'
import KidsBlocked from '@/src/components/profiles/KidsBlocked'
import { getT } from '@/src/lib/i18n/server'
import { getActiveProfile, getKidsMode } from '@/src/lib/profiles'
import { giftByToken } from '@/src/lib/plus-gifts'
import { pageMetadata } from '@/src/lib/seo'

// A gift of TunisiaFlicks+ (lib/plus-gifts): what it is, and the way to take it. The link is a
// secret, so the page is never indexed, never cached, and says nothing of the giver's account.
export const dynamic = 'force-dynamic'

export function generateMetadata() {
  const t = getT()
  return pageMetadata({ title: t('gift.page.title'), description: t('gift.page.text'), path: '/plus', card: false, noIndex: true })
}

export default async function GiftPage({ params }: { params: { token: string } }) {
  const t = getT()
  if (await getKidsMode()) return <KidsBlocked title={t('support.kids.title')} description={t('support.kids.desc')} next={`/gift/${params.token}`} />
  const active = await getActiveProfile()
  const gift = await giftByToken(params.token, active?.userId ?? null)
  return <GiftRedeem token={params.token} gift={gift} signedIn={!!active} />
}
