// The official Tunisian channels on YouTube (each one checked live). Pure data, safe anywhere.
//
// Two environment switches, both comma-separated slugs:
// - TUNISIAN_TV_CHANNELS: only these channels (empty or unset: all of them).
// - TUNISIAN_TV_CHANNELS_OFF: never these; `*` or `all` turns Tunisian TV off entirely (the cron
//   stops, the pages say it is warming up, the channel pages are 404s).

export type TvChannelKind = 'tv' | 'radio'

export type TvChannelDef = {
  slug: string
  /** Latin name, then the Arabic one (radio stations go by their Latin name everywhere). */
  name: string
  nameAr: string
  /** The YouTube channel id ("UC" + 22). */
  youtubeId: string
  handle: string
  kind: TvChannelKind
  /** The brand's light ('r g b'), until the avatar gives a better one. */
  color: string
}

export const TV_CHANNELS: readonly TvChannelDef[] = [
  { slug: 'watania-1', name: 'Watania 1', nameAr: 'الوطنية 1', youtubeId: 'UCdvWVsmQBROkgcGzVep73oA', handle: '@WataniaReplay', kind: 'tv', color: '214 40 40' },
  { slug: 'watania-2', name: 'Watania 2', nameAr: 'الوطنية 2', youtubeId: 'UCJW9gatYczI191TunQxMGbA', handle: '@Watania2Replay', kind: 'tv', color: '40 120 214' },
  { slug: 'elhiwar', name: 'Elhiwar Ettounsi', nameAr: 'الحوار التونسي', youtubeId: 'UCXzmMkXaHxMVlutDBD8goHA', handle: '@EttounsiaReplay', kind: 'tv', color: '226 120 30' },
  { slug: 'attessia', name: 'Attessia', nameAr: 'التاسعة', youtubeId: 'UCQS3ejF2jBAhwmbGD9Q3oeA', handle: '@attessiatvofficial', kind: 'tv', color: '196 60 150' },
  { slug: 'nessma', name: 'Nessma', nameAr: 'نسمة', youtubeId: 'UC-48PCT3flS86JkLzxlTA9g', handle: '@nessmatv', kind: 'tv', color: '230 70 90' },
  { slug: 'hannibal', name: 'Hannibal TV', nameAr: 'حنبعل', youtubeId: 'UCMowjs_MJ-oIWEeHUu3DrOQ', handle: '@hannibaltvofficielle', kind: 'tv', color: '212 170 60' },
  { slug: 'carthage-plus', name: 'Carthage+', nameAr: 'قرطاج+', youtubeId: 'UCivxHCcy2MQwPBGQyPYcPcg', handle: '@carthageplus4007', kind: 'tv', color: '120 90 210' },
  { slug: 'mosaique-fm', name: 'Mosaique FM', nameAr: 'Mosaique FM', youtubeId: 'UC6y8T-vG9SeQ-FKOCt_o8MA', handle: '@mosaiquefm', kind: 'radio', color: '40 170 200' },
  { slug: 'diwan-fm', name: 'Diwan FM', nameAr: 'Diwan FM', youtubeId: 'UCWbA7UIK1pKf2aFvoDyi61w', handle: '@radiodiwan', kind: 'radio', color: '60 180 120' },
  { slug: 'jawhara-fm', name: 'Jawhara FM', nameAr: 'Jawhara FM', youtubeId: 'UCXowBzuwUrjfRt68d5VphAg', handle: '@JawharaFM', kind: 'radio', color: '235 150 50' },
]

/** Path segments under /tunisian/tv that are never a channel. */
export const RESERVED_SLUGS: readonly string[] = ['series', 'live']

const SLUG = /^[a-z0-9-]{2,40}$/

const slugList = (value: string | undefined) =>
  (value ?? '').split(',').map((part) => part.trim().toLowerCase()).filter(Boolean)

type Env = Record<string, string | undefined>

/** Tunisian TV is switched off as a whole (TUNISIAN_TV_CHANNELS_OFF=*). */
export function tunisianTvOff(env: Env = process.env): boolean {
  return slugList(env.TUNISIAN_TV_CHANNELS_OFF).some((slug) => slug === '*' || slug === 'all')
}

/** The channels in use, in table order, after both switches. */
export function enabledChannels(env: Env = process.env): TvChannelDef[] {
  if (tunisianTvOff(env)) return []
  const only = slugList(env.TUNISIAN_TV_CHANNELS)
  const off = new Set(slugList(env.TUNISIAN_TV_CHANNELS_OFF))
  return TV_CHANNELS.filter((channel) => (only.length === 0 || only.includes(channel.slug)) && !off.has(channel.slug))
}

/** An enabled channel by its slug, or null (unknown, reserved, malformed or switched off). */
export function channelBySlug(slug: unknown, env: Env = process.env): TvChannelDef | null {
  if (typeof slug !== 'string' || !SLUG.test(slug) || RESERVED_SLUGS.includes(slug)) return null
  return enabledChannels(env).find((channel) => channel.slug === slug) ?? null
}

/** The channel a YouTube channel id belongs to (enabled or not). */
export function channelByYoutubeId(id: string): TvChannelDef | null {
  return TV_CHANNELS.find((channel) => channel.youtubeId === id) ?? null
}

/** The channel's uploads (no Shorts, no lives) and lives playlists: "UC…" → "UULF…" / "UULV…". */
export const uploadsPlaylist = (youtubeId: string) => `UULF${youtubeId.slice(2)}`
export const livesPlaylist = (youtubeId: string) => `UULV${youtubeId.slice(2)}`
