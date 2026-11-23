import { redirect } from 'next/navigation'
import Link from 'next/link'
import { PartyPopper } from 'lucide-react'
import { Button } from '@/src/components/ui/button'
import { getT } from '@/src/lib/i18n/server'
import { partyInfo } from '@/src/lib/party'
import { normalizePartyCode, partyPath } from '@/src/lib/party-rules'
import { pageMetadata } from '@/src/lib/seo'

// A watch party's link (lib/party): straight to the title it plays, with the party in the address
// (the player's section there offers to join). A party that has ended says so. Never indexed.
export const dynamic = 'force-dynamic'

export function generateMetadata() {
  const t = getT()
  return pageMetadata({ title: t('party.title'), description: t('party.text'), path: '/', card: false, noIndex: true })
}

export default async function PartyPage({ params }: { params: { code: string } }) {
  const code = normalizePartyCode(params.code)
  const info = code ? await partyInfo(code, null) : null
  if (info && code) redirect(partyPath(info.media, code))
  const t = getT()
  return (
    <div className="page-top pb-16">
      <div className="page-x">
        <div className="mx-auto max-w-[560px] rounded-stage bg-white/[0.04] px-6 py-12 text-center ring-1 ring-white/10">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-white/[0.07] text-white/70"><PartyPopper aria-hidden className="h-7 w-7" /></span>
          <h1 className="mt-5 font-display text-[clamp(26px,4vw,38px)] font-extrabold leading-tight text-white">{t('party.page.endedTitle')}</h1>
          <p className="mx-auto mt-2 max-w-[44ch] text-[15px] leading-relaxed text-white/65">{t('party.page.endedText')}</p>
          <Button asChild className="mt-6"><Link href="/">TunisiaFlicks</Link></Button>
        </div>
      </div>
    </div>
  )
}
