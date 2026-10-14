import type { Metadata } from 'next'
import { getLocale, getT } from '@/src/lib/i18n/server'
import { pageMetadata } from '@/src/lib/seo'
import { getHalalMode, getKidsMode } from '@/src/lib/profiles'
import { aiSearchEnabled } from '@/src/lib/ai-search/config'
import { getLandingData } from '@/src/lib/landing'
import { LandingStage } from '@/src/components/landing/Stage'
import Hero from '@/src/components/landing/Hero'
import Catalogue from '@/src/components/landing/Catalogue'
import TunisiaTrack from '@/src/components/landing/Tunisia'
import Tools from '@/src/components/landing/Tools'
import Screens from '@/src/components/landing/Screens'
import Credits from '@/src/components/landing/Credits'

export function generateMetadata(): Metadata {
  const t = getT()
  return pageMetadata({ title: t('landing.meta.title'), description: t('landing.meta.description'), path: '/about', card: 'about' })
}

/**
 * What TunisiaFlicks is, for someone who just arrived (a link in a bio, a post, a search): the
 * landing page, played like a film. The opening shot (the glass A before a wall of today's posters),
 * everything the site has one word at a time, Made in Tunisia sideways, the little things as live
 * demos, every screen in the house, and the end credits (where the information comes from, what is
 * and isn't stored). The pictures are today's, through the viewer's own filters (Kids, Halal mode).
 */
export default async function AboutPage() {
  const locale = getLocale()
  const [kids, halal] = await Promise.all([getKidsMode().catch(() => false), getHalalMode().catch(() => false)])
  const data = await getLandingData({ locale, kids, halal })
  return (
    <LandingStage>
      <Hero wall={data.wall} />
      <Catalogue reels={data.reels} />
      <TunisiaTrack data={data.tunisia} />
      <Tools data={data} ask={aiSearchEnabled() && !kids} kids={kids} />
      <Screens />
      <Credits />
    </LandingStage>
  )
}
