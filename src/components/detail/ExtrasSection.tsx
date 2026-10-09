"use client"
// Extras: the title's other videos (featurettes, behind the scenes, clips, bloopers, recaps; the
// main trailer stays in the hero) as a row of tiles that open in the YouTube dialog, and the
// soundtrack. The section is left out when both are empty. A soundtrack the server didn't know
// about yet is fetched as the section comes near and renders in place (the page's section nav
// only lists what the server knew).
import { useState } from 'react'
import { Row, ROW_WIDTH, SectionHeader } from '@/src/components/rows/Row'
import { Chip, ChipGroup } from '@/src/components/ui/chip'
import VideoTile from '@/src/components/media/VideoTile'
import YouTubeDialog from '@/src/components/media/YouTubeDialog'
import { useI18n } from '@/src/components/I18nProvider'
import type { ExtrasGroup, ExtrasGroupId } from '@/src/lib/extras'
import type { TKey } from '@/src/lib/i18n'
import type { useSoundtrack } from '@/src/hooks/use-soundtrack'
import SoundtrackSection from './SoundtrackSection'

const PANEL = 'extras-videos'

export default function ExtrasSection({ type, id, title, kids, groups, soundtrack }: {
  type: 'movie' | 'tv'
  id: string
  title: string
  kids: boolean
  groups: ExtrasGroup[]
  soundtrack: ReturnType<typeof useSoundtrack>
}) {
  const { t } = useI18n()
  const [groupId, setGroupId] = useState<ExtrasGroupId | null>(groups[0]?.id ?? null)
  const [dialog, setDialog] = useState<{ open: boolean, index: number }>({ open: false, index: 0 })
  const group = groups.find((entry) => entry.id === groupId) ?? groups[0]
  const videos = group?.videos ?? []
  const album = soundtrack.status === 'found' ? soundtrack.album : null

  // Nothing to show (yet): only the soundtrack's sentinel, while it may still turn up.
  if (!videos.length && !album) {
    return soundtrack.status === 'unknown' ? <div ref={soundtrack.sentinel} aria-hidden className="h-px" /> : null
  }

  const dialogVideos = videos.map((video) => ({
    key: video.key,
    title: video.name || t(`extras.type.${video.type}` as TKey),
    subtitle: t(`extras.type.${video.type}` as TKey),
  }))

  return (
    <section id="extras" aria-labelledby="extras-title" className="scroll-mt-[calc(var(--topbar)+72px)] space-y-8">
      <div>
        <SectionHeader title={<span id="extras-title">{t('extras.title')}</span>} />
        {videos.length > 0 && (
          <>
            {groups.length > 1 && (
              <div className="page-x mb-4">
                <ChipGroup label={t('extras.groups')} mode="tabs" scroll>
                  {groups.map((entry) => (
                    <Chip key={entry.id} active={entry.id === group?.id} controls={PANEL} count={entry.videos.length} onClick={() => setGroupId(entry.id)}>
                      {t(`extras.group.${entry.id}` as TKey)}
                    </Chip>
                  ))}
                </ChipGroup>
              </div>
            )}
            <div id={PANEL} role={groups.length > 1 ? 'tabpanel' : undefined} aria-label={group ? t(`extras.group.${group.id}` as TKey) : undefined}>
              <Row key={group?.id} itemClassName={ROW_WIDTH.landscape} label={t('extras.videos')}>
                {videos.map((video, index) => (
                  <VideoTile
                    key={video.key}
                    videoKey={video.key}
                    title={video.name || t(`extras.type.${video.type}` as TKey)}
                    meta={<span>{t(`extras.type.${video.type}` as TKey)}</span>}
                    onPlay={() => setDialog({ open: true, index })}
                  />
                ))}
              </Row>
            </div>
          </>
        )}
      </div>

      {album ? (
        <SoundtrackSection type={type} id={id} kids={kids} album={album} tracks={soundtrack.tracks} failed={soundtrack.failed} />
      ) : soundtrack.status === 'unknown' ? (
        <div ref={soundtrack.sentinel} aria-hidden className="h-px" />
      ) : null}

      {videos.length > 0 && (
        <YouTubeDialog
          open={dialog.open}
          onOpenChange={(open) => setDialog((current) => ({ ...current, open }))}
          videos={dialogVideos}
          index={dialog.index}
          onIndexChange={(index) => setDialog((current) => ({ ...current, index }))}
          label={t('extras.dialog', { title })}
          external={!kids}
        />
      )}
    </section>
  )
}
