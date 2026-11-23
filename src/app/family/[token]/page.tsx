import FamilyJoin from '@/src/components/plus/FamilyJoin'
import KidsBlocked from '@/src/components/profiles/KidsBlocked'
import { getT } from '@/src/lib/i18n/server'
import { getActiveProfile, getKidsMode } from '@/src/lib/profiles'
import { familyByToken } from '@/src/lib/plus-family'
import { pageMetadata } from '@/src/lib/seo'

// A family's link (lib/plus-family): whose family it is, how many places are left, and Join. The
// link is a secret, so the page is never indexed nor cached.
export const dynamic = 'force-dynamic'

export function generateMetadata() {
  const t = getT()
  return pageMetadata({ title: t('family.page.title'), description: t('family.page.text'), path: '/plus', card: false, noIndex: true })
}

export default async function FamilyPage({ params }: { params: { token: string } }) {
  const t = getT()
  if (await getKidsMode()) return <KidsBlocked title={t('support.kids.title')} description={t('support.kids.desc')} next={`/family/${params.token}`} />
  const active = await getActiveProfile()
  const invite = await familyByToken(params.token, active?.userId ?? null)
  return <FamilyJoin token={params.token} invite={invite} signedIn={!!active} />
}
