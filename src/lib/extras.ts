// A title's videos, grouped for the Extras section and the hero's trailer dialog: YouTube only,
// each video once, the viewer's language first. Pure helpers, safe on the server and the client.
import { isYouTubeId } from '@/src/lib/youtube'
import { pickTrailer } from '@/src/lib/media-assets'

export type ExtrasGroupId = 'trailers' | 'behind' | 'clips' | 'bloopers' | 'recaps'
export const EXTRAS_GROUPS: readonly ExtrasGroupId[] = ['trailers', 'behind', 'clips', 'bloopers', 'recaps']

/** TMDB's video type ('Behind the Scenes') as a key part ('BehindTheScenes'). */
export type ExtraType = 'Trailer' | 'Teaser' | 'Featurette' | 'BehindTheScenes' | 'Clip' | 'Bloopers' | 'Recap' | 'OpeningCredits'

export type ExtraVideo = { key: string, name: string, type: ExtraType, language: string | null, official: boolean, published: string | null }
export type ExtrasGroup = { id: ExtrasGroupId, videos: ExtraVideo[] }

const TYPES: Record<string, { type: ExtraType, group: ExtrasGroupId }> = {
  'Trailer': { type: 'Trailer', group: 'trailers' },
  'Teaser': { type: 'Teaser', group: 'trailers' },
  'Featurette': { type: 'Featurette', group: 'behind' },
  'Behind the Scenes': { type: 'BehindTheScenes', group: 'behind' },
  'Clip': { type: 'Clip', group: 'clips' },
  'Opening Credits': { type: 'OpeningCredits', group: 'clips' },
  'Bloopers': { type: 'Bloopers', group: 'bloopers' },
  'Recap': { type: 'Recap', group: 'recaps' },
}

const PER_GROUP = 24

/**
 * The videos of a TMDB `videos.results` list, grouped (trailers, behind the scenes, clips,
 * bloopers, recaps; at most 24 each; empty groups left out). Within a group: the viewer's
 * languages first (`prefer`, best first), official before fan uploads, trailers before teasers,
 * then newest first. `skip`: a video shown elsewhere (the hero's main trailer).
 */
export function extrasFromVideos(videos: any[] | null | undefined, opts: { prefer?: string[], skip?: string | null } = {}): ExtrasGroup[] {
  const prefer = opts.prefer ?? []
  const seen = new Set<string>()
  const groups = new Map<ExtrasGroupId, ExtraVideo[]>()
  for (const video of videos ?? []) {
    if (video?.site !== 'YouTube' || !isYouTubeId(video.key)) continue
    const kind = TYPES[video.type]
    if (!kind || seen.has(video.key)) continue
    seen.add(video.key)
    if (video.key === opts.skip) continue
    const list = groups.get(kind.group) ?? []
    list.push({
      key: video.key,
      name: typeof video.name === 'string' && video.name.trim() ? video.name.trim().slice(0, 160) : '',
      type: kind.type,
      language: typeof video.iso_639_1 === 'string' ? video.iso_639_1 : null,
      official: video.official === true,
      published: typeof video.published_at === 'string' ? video.published_at : null,
    })
    groups.set(kind.group, list)
  }
  const rank = (video: ExtraVideo) => {
    const language = video.language ? prefer.indexOf(video.language) : -1
    return language === -1 ? prefer.length : language
  }
  return EXTRAS_GROUPS.flatMap((id) => {
    const list = groups.get(id)
    if (!list?.length) return []
    list.sort((a, b) => rank(a) - rank(b)
      || Number(b.official) - Number(a.official)
      || Number(b.type === 'Trailer') - Number(a.type === 'Trailer')
      || (b.published ?? '').localeCompare(a.published ?? ''))
    return [{ id, videos: list.slice(0, PER_GROUP) }]
  })
}

/** All the videos of the groups, in order (what the Extras row shows when there is one group). */
export const allExtras = (groups: ExtrasGroup[]) => groups.flatMap((group) => group.videos)

/**
 * The hero's trailer dialog and the Extras row from a title's videos: the main trailer (in the
 * viewer's language when there is one) and the other trailers and teasers for the dialog; every
 * other video, without that main trailer, for the row.
 */
export function videoExtras(videos: any[] | null | undefined, prefer: string[]): { trailers: { key: string, title: string }[], groups: ExtrasGroup[] } {
  const main = pickTrailer(videos ?? [], prefer)
  const all = extrasFromVideos(videos, { prefer })
  const trailerGroup = all.find((group) => group.id === 'trailers')?.videos ?? []
  const mainVideo = trailerGroup.find((video) => video.key === main)
  const trailers = main
    ? [mainVideo ?? { key: main, name: '' }, ...trailerGroup.filter((video) => video.key !== main)].map((video) => ({ key: video.key, title: video.name }))
    : []
  return { trailers, groups: extrasFromVideos(videos, { prefer, skip: main }) }
}
