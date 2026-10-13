// A Tunisian title's video (lib/tunisian: YouTube, a video file, or VK Video's player) as what the
// video dialog plays, and the picture its tile shows.
import type { DialogVideo } from '@/src/components/media/YouTubeDialog'
import type { TunisianMedia } from '@/src/lib/tunisian'
import { youtubeThumb } from '@/src/lib/youtube'

export function dialogVideo(media: TunisianMedia, title: string, subtitle?: string): DialogVideo {
  if (media.type === 'youtube') return { key: media.id, title, subtitle }
  if (media.type === 'file') return { key: media.url, title, subtitle, file: media.url }
  return { key: media.url, title, subtitle, embed: media.url }
}

/** YouTube has a thumbnail per video; the others show the title's own picture. */
export const mediaThumb = (media: TunisianMedia | null | undefined, fallback: string | null) =>
  media?.type === 'youtube' ? youtubeThumb(media.id, 'mq') : fallback
