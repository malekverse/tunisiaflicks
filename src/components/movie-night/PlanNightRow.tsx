// The ShareSheet's "Plan a movie night" row for a title (to /movie-night/new?title=type:id). Null for
// guests and Kids. `onDone` closes the sheet.
"use client"
import { Popcorn } from 'lucide-react'
import { ShareActionRow } from '@/src/components/share/ShareActionRow'
import { useSocialSelf } from '@/src/components/social/use-social-self'
import { useT } from '@/src/components/I18nProvider'
import { useProfiles } from '@/src/hooks/use-profiles'
import type { ShareMedia } from '@/src/lib/social/types'

export default function PlanNightRow(props: { media: ShareMedia; onDone: () => void }): JSX.Element | null {
  const t = useT()
  const { status } = useSocialSelf()
  const { active } = useProfiles()
  if (active?.kids || status !== 'ready') return null
  const { media, onDone } = props
  return (
    <ShareActionRow
      icon={<Popcorn />}
      label={t('movieNight.row.label')}
      hint={t('movieNight.row.hint')}
      href={`/movie-night/new?title=${media.media_type}:${encodeURIComponent(media.id)}`}
      onSelect={onDone}
    />
  )
}
