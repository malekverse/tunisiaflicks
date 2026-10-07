import { Clapperboard } from 'lucide-react'
import ClipsFeed from '@/src/components/clips/ClipsFeed'
import { EmptyState } from '@/src/components/MediaGrid'
import { getClips } from '@/src/lib/clips'
import { getLocale, getT } from '@/src/lib/i18n/server'
import { getKidsMode } from '@/src/lib/profiles'

export const dynamic = 'force-dynamic'

export function generateMetadata() {
  const t = getT()
  return { title: `${t('clips.title')} | TunisiaFlicks`, description: t('clips.description') }
}

export default async function ClipsPage() {
  const clips = await getClips(await getKidsMode(), getLocale())
  const t = getT()
  if (clips.length === 0) {
    return (
      <div className="page-x page-top">
        <EmptyState title={t('clips.title')} icon={<Clapperboard aria-hidden className="h-6 w-6" />}>{t('clips.unavailable')}</EmptyState>
      </div>
    )
  }
  return (
    <>
      <h1 className="sr-only">{t('clips.title')}</h1>
      <ClipsFeed clips={clips} />
    </>
  )
}
