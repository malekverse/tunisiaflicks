// YouTube addresses, in one place (pure helpers, safe on the server and the client).
//
// - Thumbnails go through our own /api/yt-thumb route, so a visitor's browser never talks to Google
//   until they press play.
// - Players are youtube-nocookie embeds. Never give their iframe referrerPolicy="no-referrer":
//   YouTube refuses to play without a referrer (player error 153). The site-wide
//   strict-origin-when-cross-origin policy is what they need.

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/
const CHANNEL_ID = /^UC[A-Za-z0-9_-]{22}$/
const EMBED_ORIGIN = 'https://www.youtube-nocookie.com'

export type YouTubeThumbSize = 'mq' | 'hq' | 'maxres'

/** A YouTube video id: 11 characters of [A-Za-z0-9_-]. */
export const isYouTubeId = (v: unknown): v is string => typeof v === 'string' && VIDEO_ID.test(v)

/** A YouTube channel id ("UC" and 22 characters). */
export const isYouTubeChannelId = (v: unknown): v is string => typeof v === 'string' && CHANNEL_ID.test(v)

/**
 * The video's thumbnail, served by our own route (see app/api/yt-thumb). mq is 320x180 (16:9),
 * hq 480x360 (4:3, letterboxed: crop it with object-cover), maxres 1280x720 when the uploader
 * provided one.
 */
export function youtubeThumb(key: string, size: YouTubeThumbSize): string {
  return `/api/yt-thumb/${encodeURIComponent(key)}/${size}`
}

/** The privacy-enhanced player for one video: no related videos from other channels, inline on iOS. */
export function youtubeEmbedUrl(key: string, o: { autoplay?: boolean, start?: number, hl?: string } = {}): string {
  const params = new URLSearchParams({ rel: '0', playsinline: '1', modestbranding: '1' })
  if (o.autoplay) params.set('autoplay', '1')
  if (o.start && o.start > 0) params.set('start', String(Math.floor(o.start)))
  if (o.hl) params.set('hl', o.hl)
  return `${EMBED_ORIGIN}/embed/${encodeURIComponent(key)}?${params}`
}

/** A channel's current live stream (whatever it is broadcasting now), started on open. */
export function youtubeLiveEmbedUrl(channelId: string, o: { hl?: string } = {}): string {
  const params = new URLSearchParams({ channel: channelId, autoplay: '1', rel: '0', playsinline: '1', modestbranding: '1' })
  if (o.hl) params.set('hl', o.hl)
  return `${EMBED_ORIGIN}/embed/live_stream?${params}`
}

/** The video's page on YouTube itself (for videos whose owner blocks embedding). */
export function youtubeWatchUrl(key: string): string {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(key)}`
}

/** A channel's live page on YouTube itself. */
export function youtubeChannelLiveUrl(channelId: string): string {
  return `https://www.youtube.com/channel/${encodeURIComponent(channelId)}/live`
}
