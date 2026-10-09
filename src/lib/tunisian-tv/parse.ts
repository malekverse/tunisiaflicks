// Reading what YouTube's free feeds say about Tunisian TV: the Atom feeds, the episode titles
// ("Carte Postale EP13 P02", "مسلسل المايسترو | El Maestro - الحلقة 7"), the playlists named in
// descriptions, and the rhythm of a series. Pure functions: no network, no database, no clock
// unless one is passed in. Unit tested against feeds captured live (tests/fixtures/tunisian-tv).
import { isYouTubeId } from '@/src/lib/youtube'
import { addDays, daysBetween, tunisDate } from '@/src/lib/hijri'

// ---------------------------------------------------------------------------------------------
// Feeds

export type FeedEntry = {
  id: string
  channelId: string | null
  title: string
  description: string
  publishedAt: string
  updatedAt: string | null
  views: number | null
  /** A YouTube Short (the channel feed lists them; the UULF uploads feed doesn't). */
  isShort: boolean
}

export type ParsedFeed = {
  channelId: string | null
  playlistId: string | null
  /** The playlist's title ("Videos" for an uploads feed, the channel's name for a channel feed). */
  title: string | null
  author: string | null
  entries: FeedEntry[]
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }

/** XML text to plain text: the five named entities and numeric references. */
export function decodeXml(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (match, entity: string) => {
    if (entity[0] !== '#') return ENTITIES[entity.toLowerCase()] ?? match
    const code = entity[1] === 'x' || entity[1] === 'X' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10)
    return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : ''
  })
}

const tag = (xml: string, name: string) => {
  const match = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`))
  return match ? decodeXml(match[1]).trim() : null
}

const CHANNEL_ID = /^UC[A-Za-z0-9_-]{22}$/

/**
 * A YouTube Atom feed (uploads, lives, a playlist or a channel). Null when the answer isn't a feed
 * at all (YouTube's feeds often answer an HTML 404 or 500 page). Entries keep the feed's order
 * (newest first); entries without a valid video id are dropped.
 */
export function parseFeed(xml: string): ParsedFeed | null {
  if (typeof xml !== 'string' || !/<feed[\s>]/.test(xml)) return null
  const [head, ...chunks] = xml.split(/<entry>/)
  // A channel feed's header gives the id without its 'UC' (an uploads feed's gives it whole).
  const headChannel = tag(head, 'yt:channelId')
  const channelId = headChannel && /^[A-Za-z0-9_-]{22}$/.test(headChannel) ? `UC${headChannel}` : headChannel
  const authorBlock = head.match(/<author>([\s\S]*?)<\/author>/)?.[1] ?? ''
  const entries: FeedEntry[] = []
  for (const chunk of chunks) {
    const entry = chunk.split('</entry>')[0]
    const id = tag(entry, 'yt:videoId')
    if (!isYouTubeId(id)) continue
    const published = tag(entry, 'published')
    if (!published || Number.isNaN(Date.parse(published))) continue
    const link = entry.match(/<link[^>]*rel="alternate"[^>]*href="([^"]+)"/)?.[1] ?? ''
    const views = entry.match(/<media:statistics[^>]*views="(\d+)"/)?.[1]
    const entryChannel = tag(entry, 'yt:channelId')
    entries.push({
      id,
      channelId: entryChannel && CHANNEL_ID.test(entryChannel) ? entryChannel : null,
      title: (tag(entry, 'title') ?? '').replace(/\s+/g, ' ').trim(),
      description: tag(entry, 'media:description') ?? '',
      publishedAt: new Date(published).toISOString(),
      updatedAt: (() => {
        const updated = tag(entry, 'updated')
        return updated && !Number.isNaN(Date.parse(updated)) ? new Date(updated).toISOString() : null
      })(),
      views: views ? Number(views) : null,
      isShort: /\/shorts\//.test(link),
    })
  }
  return {
    channelId: channelId && CHANNEL_ID.test(channelId) ? channelId : null,
    playlistId: tag(head, 'yt:playlistId'),
    title: tag(head, 'title'),
    author: tag(authorBlock, 'name'),
    entries,
  }
}

// ---------------------------------------------------------------------------------------------
// Titles

export type EpisodeInfo = {
  /** The series' name as written ("Carte Postale", "المايسترو"); '' when the title names none. */
  series: string
  /** The same series in the other script ("El Maestro" next to "المايسترو"). */
  seriesAlt: string | null
  season: number | null
  episode: number | null
  part: number | null
  /** The broadcast day written in the title (ISO), e.g. "24-07-2026" or "9 أكتوبر 2026". */
  date: string | null
  /** The episode's own title ("خدعة العمر"). */
  subtitle: string | null
  /** A summary, promo, teaser or extract rather than an episode. */
  clip: boolean
}

const ARABIC = /[؀-ۿ]/
const LATIN = /[A-Za-z]/
const EMOJI = /[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{20E3}\u{1F1E6}-\u{1F1FF}]/gu

/** Words that say "series" or "programme" before a name: "مسلسل المايسترو", "Sitcom X". */
const SERIES_WORDS = /(?:^|\s)(?:مسلسل|سيتكوم|سلسلة|برنامج|الدراما القصيرة|feuilleton|sitcom|s[ée]rie|[ée]mission)(?=\s)/iu
const CLIP_WORDS = /ملخص|برومو|كواليس|إعلان|اعلان|\bpromo\b|\bteaser\b|\btrailer\b|\bextrait\b|bande[- ]annonce|making[- ]of|coulisses|best[- ]of|\brecap\b|\bresume\b|\brésumé\b/iu

const EPISODE = /(?:^|[\s|\-–—:(])(?:(?:ep(?:i?sode|iosde|isod)?|épisode)\s*\.?\s*#?\s*|e(?=\d))0*(\d{1,4})(?![\d:])|الحلقة\s*(?:رقم\s*)?#?\s*0*(\d{1,4})/iu
const PART = /(?:^|[\s|\-–—(])(?:(?:pt|part|partie)\s*\.?\s*|p\s?(?=\d))0*(\d{1,2})(?!\d)|الجزء\s*0*(\d{1,2})/iu
const SEASON = /(?:^|[\s|\-–—(])(?:(?:saison|season)\s*|s(?=\d))0*(\d{1,2})(?!\d)|الموسم\s*0*(\d{1,2})/iu
const NUMERIC_DATE = /(?:ليوم\s*)?\b(\d{1,2})\s?[-./]\s?(\d{1,2})\s?[-./]\s?(20\d{2})\b/u

const MONTHS: Record<string, number> = {
  janvier: 1, fevrier: 2, février: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7, aout: 8, août: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12, décembre: 12,
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  جانفي: 1, يناير: 1, فيفري: 2, فبراير: 2, مارس: 3, أفريل: 4, افريل: 4, أبريل: 4, ماي: 5, مايو: 5, جوان: 6, يونيو: 6, جويلية: 7, يوليو: 7, أوت: 8, اوت: 8, أغسطس: 8,
  سبتمبر: 9, أكتوبر: 10, اكتوبر: 10, نوفمبر: 11, ديسمبر: 12,
}
const WORD_DATE = new RegExp(`\\b(\\d{1,2})\\s+(${Object.keys(MONTHS).join('|')})\\s+(20\\d{2})\\b`, 'iu')

const isoDate = (day: number, month: number, year: number) => {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  return new Date(`${iso}T00:00:00Z`).toISOString().slice(0, 10) === iso ? iso : null
}

/** Separators between a series' name and the rest: | || ll - – — : */
const LEADING_SEPARATORS = /^(?:\s*(?:\|\||\||ll(?=\s|[؀-ۿ])|[-–—:•]))+\s*/u
const TRAILING_SEPARATORS = /(?:\s*(?:\|\||\||\bll|[-–—:•#]))+\s*$/u

/** Where a date was cut out of a title (a private-use character, never in real titles). */
const DATE_MARK = '\uE000'
const unmark = (text: string) => text.split(DATE_MARK).join(' ')
/** Between a show's name and what an upload is about: " : ", " | ", " - ", " ll ", "..". */
const SEGMENT = /\s*(?:\|\||\||:)\s*|\s+[-–—]\s+|\s+ll\s+|\s*\.{2,}\s*/u

const tidy = (text: string) => text.replace(EMOJI, ' ').replace(/\s+/g, ' ').trim()
const strip = (text: string) => tidy(text).replace(LEADING_SEPARATORS, '').replace(TRAILING_SEPARATORS, '').trim()

/** Drops the "series" word in front of a name ("مسلسل المايسترو" → "المايسترو"). */
function withoutSeriesWord(text: string): string {
  return strip(text.replace(new RegExp(SERIES_WORDS.source, 'iu'), ' '))
}

/** "المايسترو | El Maestro" → ["المايسترو", "El Maestro"]: one name in each script. */
function splitScripts(name: string): [string, string | null] {
  const parts = name.split(/\s*\|\s*|\s+\/\s+/).map(strip).filter(Boolean)
  if (parts.length === 2) {
    const [a, b] = parts
    if ((ARABIC.test(a) && !LATIN.test(a) && LATIN.test(b) && !ARABIC.test(b)) || (LATIN.test(a) && !ARABIC.test(a) && ARABIC.test(b) && !LATIN.test(b))) return [a, b]
  }
  return [name, null]
}

/**
 * The parts of an episode title. Handles the channels' habits: "EP13", "Ep 10", "Episode 30",
 * the "Epiosde" typo, "الحلقة 22", seasons ("S02", "الموسم 2"), parts ("P02", "Partie 03"),
 * a broadcast date ("24-07-2026", "8 OCTOBRE 2026", "9 أكتوبر 2026"), a series word in front
 * ("مسلسل", "سيتكوم") and a name given in both scripts ("مسلسل المايسترو | El Maestro").
 */
export function parseEpisodeTitle(raw: string): EpisodeInfo {
  let text = tidy(decodeXml(raw ?? ''))
  const clip = CLIP_WORDS.test(text)

  // The date leaves a mark where it was: without an episode number, the name is what comes before.
  let date: string | null = null
  const numeric = text.match(NUMERIC_DATE)
  if (numeric) {
    date = isoDate(Number(numeric[1]), Number(numeric[2]), Number(numeric[3]))
    if (date) text = tidy(text.replace(numeric[0], ` ${DATE_MARK} `))
  }
  if (!date) {
    const word = text.match(WORD_DATE)
    if (word) {
      date = isoDate(Number(word[1]), MONTHS[word[2].toLowerCase()] ?? 0, Number(word[3]))
      if (date) text = tidy(text.replace(word[0], ` ${DATE_MARK} `))
    }
  }

  let part: number | null = null
  const partMatch = text.match(PART)
  if (partMatch) {
    part = Number(partMatch[1] ?? partMatch[2])
    text = tidy(text.replace(partMatch[0], ' '))
  }

  let season: number | null = null
  const seasonMatch = text.match(SEASON)
  if (seasonMatch) {
    season = Number(seasonMatch[1] ?? seasonMatch[2])
    text = tidy(text.replace(seasonMatch[0], ' '))
  }

  let episode: number | null = null
  let before: string
  let after: string
  const episodeMatch = text.match(EPISODE)
  if (episodeMatch && episodeMatch.index !== undefined) {
    episode = Number(episodeMatch[1] ?? episodeMatch[2])
    before = unmark(text.slice(0, episodeMatch.index))
    after = unmark(text.slice(episodeMatch.index + episodeMatch[0].length))
  } else {
    const mark = text.indexOf(DATE_MARK)
    before = mark >= 0 ? text.slice(0, mark) : text
    after = mark >= 0 ? text.slice(mark + DATE_MARK.length) : ''
  }

  // A clip names its series after the series word, anywhere: "… سيتكوم الحجامة -ملخص الحلقة 9".
  const named = before.match(new RegExp(`${SERIES_WORDS.source}\\s+([^|\\-–—:]+)`, 'iu'))
  let series = named && named.index !== undefined && named.index > 0 ? strip(named[1]) : withoutSeriesWord(before)
  let subtitle: string | null = strip(after) || null

  // No episode number: the name is the first segment ("AGRO MAG : … | الأسعار…",
  // "برنامج لمة ونجوم : عفيفة العويني"), the rest says what this one is about.
  if (episode === null) {
    const [first, ...rest] = series.split(SEGMENT)
    if (rest.length > 0 && strip(first)) {
      series = strip(first)
      subtitle = strip([strip(rest.join(' | ')), subtitle ?? ''].filter(Boolean).join(' | ')) || null
    }
  }
  series = strip(series.replace(CLIP_WORDS, ' '))

  // "Warthet El Nar EP01 ll ورثة النار الحلقة 01 ll خدعة العمر": the same episode, named again in
  // the other script; that name is the series' other name, the rest the episode's title.
  let seriesAlt: string | null = null
  if (subtitle && episode !== null) {
    const again = subtitle.match(EPISODE)
    if (again && again.index !== undefined && Number(again[1] ?? again[2]) === episode) {
      const alt = strip(subtitle.slice(0, again.index))
      if (alt) seriesAlt = withoutSeriesWord(alt)
      subtitle = strip(subtitle.slice(again.index + again[0].length)) || null
    }
  }

  // The episode number comes first ("الحلقة #7 | تفهم كرة؟ | الفنان أنيس اللطيف"): the next
  // segment is the series.
  if (!series && subtitle && episode !== null) {
    const [first, ...rest] = subtitle.split(/\s*(?:\|\||\||\sll\s)\s*/)
    series = withoutSeriesWord(first)
    subtitle = strip(rest.join(' | ')) || null
  }

  const [main, alt] = splitScripts(series)
  if (alt) {
    series = main
    seriesAlt = seriesAlt ?? alt
  }
  return { series, seriesAlt, season, episode, part, date, subtitle, clip }
}

/**
 * A stable key for a series' name, the same however a channel spells it from one upload to the
 * next: lower case, no diacritics or tashkeel, one alef, no emoji or punctuation, no series word.
 */
export function seriesKey(name: string): string {
  const plain = tidy(decodeXml(name ?? ''))
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .toLowerCase()
  return withoutSeriesWord(` ${plain} `)
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '')
}

// ---------------------------------------------------------------------------------------------
// Series

export type SeriesKind = 'drama' | 'show' | 'clips'

const DRAMA_WORDS = /مسلسل|سيتكوم|سلسلة|دراما|feuilleton|sitcom|\bs[ée]rie\b|\bdrama\b|mosalsal|ramadan|رمضان/iu
const SHOW_WORDS = /برنامج|حصة|منوعة|بودكاست|أخبار|اخبار|الأنباء|مباشر|\bmag\b|magazine|[ée]mission|\btalk\b|\bshow\b|journal|\bnews\b|\bsport\b|podcast|\blive\b|\bdirect\b|\bforum\b|\bmatinale\b/iu

/**
 * What a series is, from its uploads' titles (and durations, with the API): 'drama' (fiction,
 * told in numbered episodes), 'show' (talk, magazines, news, anything dated or on the radio) or
 * 'clips' (summaries, promos, extracts, short pieces; never shown as a series).
 */
export function classifySeries(o: {
  titles: string[]
  playlistTitle?: string | null
  channelKind?: 'tv' | 'radio'
  durations?: (number | null | undefined)[]
}): SeriesKind {
  const titles = o.titles.filter(Boolean)
  const infos = titles.map(parseEpisodeTitle)
  if (infos.length > 0 && infos.filter((info) => info.clip).length * 2 > infos.length) return 'clips'
  const durations = (o.durations ?? []).filter((d): d is number => typeof d === 'number' && d > 0).sort((a, b) => a - b)
  if (durations.length >= 3 && durations[Math.floor(durations.length / 2)] < 6 * 60) return 'clips'
  if (o.channelKind === 'radio') return 'show'

  const words = [o.playlistTitle ?? '', ...titles].join(' \n ')
  let drama = DRAMA_WORDS.test(words) ? 3 : 0
  let show = SHOW_WORDS.test(words) ? 3 : 0
  const numbered = infos.filter((info) => info.episode !== null)
  const dated = infos.filter((info) => info.date !== null)
  if (dated.length * 2 >= infos.length && dated.length > 0) show += 2
  if (infos.some((info) => info.part !== null)) show += 1
  if (numbered.length * 2 > infos.length && dated.length === 0) drama += 1
  return drama > show ? 'drama' : 'show'
}

/** Playlist ids ("PL…") linked in a description, each once, in order (at most 20). */
export function playlistIdsIn(text: string): string[] {
  const found = new Set<string>()
  for (const match of decodeXml(text ?? '').matchAll(/[?&]list=(PL[A-Za-z0-9_-]{10,40})(?![A-Za-z0-9_-])/g)) {
    found.add(match[1])
    if (found.size >= 20) break
  }
  return [...found]
}

/** Lines where a description's boilerplate starts: subscribe, follow us, other programmes. */
const BOILERPLATE = /subscribe|abonnez|abonne-toi|للاشتراك|اشترك|follow us|suivez[- ]nous|تابعونا|تابعنا|regardez nos|retrouvez|facebook|instagram|tiktok|twitter|website|site web|site officiel|موقعنا|digital distribution|للمزيد|all rights|tous droits|copyright/iu
const URL = /https?:\/\/\S+|www\.\S+/giu
const HASHTAGS = /(?:^|\s)#[\p{L}\p{N}_]+/gu

/**
 * A description fit to show under a drama episode: no links, hashtags or channel boilerplate,
 * no repeat of the title, at most `max` characters (cut at a word, with an ellipsis).
 */
export function cleanDescription(text: string, o: { title?: string, max?: number } = {}): string {
  const max = o.max ?? 300
  const title = o.title ? tidy(o.title) : null
  const kept: string[] = []
  for (const rawLine of decodeXml(text ?? '').split(/\r?\n/)) {
    if (BOILERPLATE.test(rawLine)) break
    const line = tidy(rawLine.replace(URL, ' ').replace(HASHTAGS, ' '))
    if (!line || /^[\p{P}\p{S}\s]*$/u.test(line)) continue
    if (title && line === title) continue
    kept.push(line)
  }
  const joined = kept.join(' ').replace(/\s+([,.;:!?،؛])/g, '$1').trim()
  if (joined.length <= max) return joined
  const cut = joined.slice(0, max - 1)
  const space = cut.lastIndexOf(' ')
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:،؛-]+$/u, '')}…`
}

export type Cadence =
  | { kind: 'daily' }
  | { kind: 'weekdays' }
  | { kind: 'days', days: number[] }
  | { kind: 'weekly', day: number }

const weekday = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay()

/**
 * How often new episodes come, from at least 4 upload dates (Tunis days): every day, every
 * weekday, on some days of the week, or once a week on one day. Null when there's no rhythm.
 */
export function airingCadence(dates: (string | Date)[]): Cadence | null {
  const days = [...new Set(dates.map((date) => tunisDate(new Date(date))))].sort().slice(-14)
  if (days.length < 4) return null
  const gaps = days.slice(1).map((day, index) => daysBetween(days[index], day)).sort((a, b) => a - b)
  const median = gaps[Math.floor(gaps.length / 2)]
  const weekdays = [...new Set(days.map(weekday))].sort((a, b) => a - b)
  if (median <= 1.5) {
    if (weekdays.length >= 6) return { kind: 'daily' }
    if (weekdays.every((day) => day >= 1 && day <= 5) && weekdays.length >= 4) return { kind: 'weekdays' }
    return weekdays.length >= 2 ? { kind: 'days', days: weekdays } : null
  }
  if (median >= 5 && median <= 9) {
    const counts = new Map<number, number>()
    for (const day of days) counts.set(weekday(day), (counts.get(weekday(day)) ?? 0) + 1)
    const [day, count] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]
    return count * 2 > days.length ? { kind: 'weekly', day } : null
  }
  return null
}

type Partable = { episode: number | null, part: number | null, season?: number | null, date?: string | null }

/**
 * The uploads of one broadcast together: "EP13 P01" and "EP13 P02" (or three "Partie"s of the
 * same dated show) become one group, its parts in order. Groups keep the order in which they
 * first appear; uploads that aren't parts are groups of one.
 */
export function groupParts<T extends Partable>(items: T[]): T[][] {
  const groups: T[][] = []
  const byKey = new Map<string, T[]>()
  for (const item of items) {
    const key = item.part !== null && (item.episode !== null || item.date)
      ? `${item.season ?? ''}:${item.episode ?? ''}:${item.date ?? ''}`
      : null
    const existing = key ? byKey.get(key) : undefined
    if (existing) {
      existing.push(item)
      continue
    }
    const group = [item]
    groups.push(group)
    if (key) byKey.set(key, group)
  }
  for (const group of groups) group.sort((a, b) => (a.part ?? 0) - (b.part ?? 0))
  return groups
}

// ---------------------------------------------------------------------------------------------
// Live and Ramadan

const LIVE_WORDS = /\blive\b|en direct|\bdirect\b|بث مباشر|البث المباشر|مباشر/iu

/**
 * Without the API, whether a feed entry is a broadcast on air now: a live title, started within
 * the last 14 hours, and still being updated in the last 3 (YouTube touches a live video's entry
 * while it streams). With the API the answer comes from videos.list instead.
 */
export function looksLiveNow(entry: Pick<FeedEntry, 'title' | 'publishedAt' | 'updatedAt'>, now: Date): boolean {
  if (!LIVE_WORDS.test(entry.title)) return false
  const started = Date.parse(entry.publishedAt)
  const touched = entry.updatedAt ? Date.parse(entry.updatedAt) : started
  return now.getTime() - started < 14 * 3600_000 && now.getTime() - touched < 3 * 3600_000 && started <= now.getTime() + 600_000
}

/** A series is a Ramadan series when its first episode came from 3 days before to 10 days after 1 Ramadan. */
export function isRamadanStart(firstAt: Date | string, ramadanStart: string): boolean {
  const first = tunisDate(new Date(firstAt))
  return first >= addDays(ramadanStart, -3) && first <= addDays(ramadanStart, 10)
}

/** "1:02:03" or "42:10" from seconds (null when unknown). */
export function formatDuration(seconds: number | null | undefined): string | null {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) return null
  const s = Math.round(seconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const rest = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${rest}` : `${m}:${rest}`
}

/** ISO 8601 durations from the Data API ("PT1H2M3S") in seconds. */
export function parseIsoDuration(value: string | null | undefined): number | null {
  const match = (value ?? '').match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/)
  if (!match) return null
  const [, d, h, m, s] = match.map((part) => Number(part ?? 0))
  const total = d * 86400 + h * 3600 + m * 60 + s
  return total > 0 ? total : null
}
