// Shared renderer for social share cards (Open Graph / Twitter images, 1200x630).
//
// When a TunisiaFlicks link is pasted into Facebook, WhatsApp, Messenger, X or Telegram, these
// cards are what people see: backdrop, poster, title, year, rating, genres and the brand.
import { ImageResponse } from 'next/og'

export const OG_SIZE = { width: 1200, height: 630 }
export const SITE_HOST = 'tunisiaflicks.vercel.app'

const RED = '#ef4444'
const BG = '#0d0c0f'

// Inter (bold + regular) from Google Fonts, fetched once per server instance. Satori needs TTF/OTF:
// Google serves TTF when the request carries no browser User-Agent.
const fontCache = new Map<number, Promise<ArrayBuffer | null>>()

function loadInter(weight: 400 | 800): Promise<ArrayBuffer | null> {
  let pending = fontCache.get(weight)
  if (!pending) {
    pending = (async () => {
      try {
        const css = await fetch(`https://fonts.googleapis.com/css2?family=Inter:wght@${weight}`).then((res) => res.text())
        const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1]
        return url ? await fetch(url).then((res) => res.arrayBuffer()) : null
      } catch {
        return null
      }
    })()
    fontCache.set(weight, pending)
  }
  return pending
}

async function fonts() {
  const [regular, bold] = await Promise.all([loadInter(400), loadInter(800)])
  return [
    regular && { name: 'Inter', data: regular, weight: 400 as const, style: 'normal' as const },
    bold && { name: 'Inter', data: bold, weight: 800 as const, style: 'normal' as const },
  ].filter(Boolean) as { name: string, data: ArrayBuffer, weight: 400 | 800, style: 'normal' }[]
}

/**
 * Re-encodes a rendered card as JPEG. Satori outputs PNG, which is huge for photographic cards
 * (~800 KB); JPEG is ~5-10x smaller, and WhatsApp (the main way links get shared here) drops or
 * shrinks preview images above roughly 300 KB. Falls back to the PNG if sharp is unavailable.
 */
async function asJpeg(image: ImageResponse, quality = 80): Promise<Response> {
  // Rendering errors surface here (and become a 500): the stream can only be read once.
  const png = new Uint8Array(await image.arrayBuffer())
  const cacheControl = image.headers.get('Cache-Control') ?? 'public, max-age=86400'
  try {
    const sharp = (await import('sharp')).default
    const jpeg = await sharp(png).jpeg({ quality, mozjpeg: true }).toBuffer()
    return new Response(new Uint8Array(jpeg), { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': cacheControl } })
  } catch (error) {
    console.error('JPEG encoding failed, serving PNG:', error)
    return new Response(png, { headers: { 'Content-Type': 'image/png', 'Cache-Control': cacheControl } })
  }
}

// Satori calls .trim() on every style value, so a style key set to `undefined` crashes the render.
// Only add fontFamily when the font actually loaded (a Google Fonts outage must not break cards).
const fontStyle = (fontList: unknown[]): { fontFamily?: string } => (fontList.length ? { fontFamily: 'Inter' } : {})

const truncate = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text)

export type ShareCard = {
  title: string
  /** Small line above the title, e.g. "Movie" / "TV Series" / "Actor". */
  eyebrow?: string
  /** "2019 • 2h 19m • Drama, Thriller" */
  meta?: string
  rating?: number | null
  description?: string | null
  /** Full image URLs. */
  backdrop?: string | null
  poster?: string | null
  /** Small posters shown along the bottom (e.g. an actor's best-known films). */
  strip?: string[]
}

/** A branded 1200x630 share card. */
export async function renderShareCard(card: ShareCard) {
  const fontList = await fonts()
  const family = fontStyle(fontList)
  const rating = card.rating ? Math.round(card.rating * 10) / 10 : null

  return asJpeg(new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', background: BG, ...family, color: 'white' }}>
        {card.backdrop && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={card.backdrop} alt="" width={1200} height={630} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: 1200, height: 630, objectFit: 'cover' }} />
        )}
        {/* Readability: dark on the left where the text sits, lighter on the right. */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', background: 'linear-gradient(90deg, rgba(13,12,15,0.97) 0%, rgba(13,12,15,0.88) 45%, rgba(13,12,15,0.45) 100%)' }} />

        <div style={{ display: 'flex', width: '100%', height: '100%', padding: '56px 64px', gap: 48, position: 'relative' }}>
          {card.poster && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={card.poster}
              alt=""
              width={300}
              height={450}
              style={{ width: 300, height: 450, objectFit: 'cover', borderRadius: 20, alignSelf: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.7)' }}
            />
          )}

          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 24, fontWeight: 800, letterSpacing: 4, color: RED }}>
              <div style={{ display: 'flex', width: 12, height: 12, borderRadius: 3, background: RED }} />
              TUNISIAFLICKS{card.eyebrow ? `  ·  ${card.eyebrow.toUpperCase()}` : ''}
            </div>

            <div style={{ display: 'flex', marginTop: 20, fontSize: card.title.length > 28 ? 58 : 72, fontWeight: 800, lineHeight: 1.05 }}>
              {truncate(card.title, 60)}
            </div>

            {(card.meta || rating) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginTop: 24, fontSize: 28, color: '#d4d4d8' }}>
                {rating && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(250,204,21,0.15)', color: '#facc15', padding: '6px 16px', borderRadius: 999, fontWeight: 800 }}>
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="#facc15"><path d="M12 2l2.9 6.9 7.1.6-5.4 4.7 1.6 7L12 17.3 5.8 21.2l1.6-7L2 9.5l7.1-.6L12 2z" /></svg>
                    {rating}
                  </div>
                )}
                {card.meta && <div style={{ display: 'flex' }}>{truncate(card.meta, 60)}</div>}
              </div>
            )}

            {card.description && (
              <div style={{ display: 'flex', marginTop: 24, fontSize: 26, lineHeight: 1.4, color: '#a1a1aa' }}>
                {truncate(card.description, card.strip?.length ? 110 : 190)}
              </div>
            )}

            {card.strip && card.strip.length > 0 && (
              <div style={{ display: 'flex', gap: 14, marginTop: 28 }}>
                {card.strip.slice(0, 5).map((src) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={src} src={src} alt="" width={92} height={138} style={{ width: 92, height: 138, objectFit: 'cover', borderRadius: 10 }} />
                ))}
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 'auto', paddingTop: 24, fontSize: 24, color: '#e4e4e7' }}>
              <div style={{ display: 'flex', background: RED, color: 'white', fontWeight: 800, padding: '8px 18px', borderRadius: 10, alignItems: 'center' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="white" style={{ marginRight: 8 }}><path d="M6 4l15 8-15 8z" /></svg>Watch now</div>
              {SITE_HOST}
            </div>
          </div>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: fontList.length ? fontList : undefined }
  ))
}

/** Share card for a user list: title + owner on the left, a 3x2 poster collage on the right. */
export async function renderListCard({ title, owner, count, posters }: { title: string, owner: string, count: number, posters: string[] }) {
  const fontList = await fonts()
  const tiles = posters.slice(0, 6)

  return asJpeg(new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: `radial-gradient(circle at 85% 20%, rgba(239,68,68,0.35), ${BG} 60%)`, ...fontStyle(fontList), color: 'white', padding: '56px 64px', gap: 48 }}>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 24, fontWeight: 800, letterSpacing: 4, color: RED }}>
            <div style={{ display: 'flex', width: 12, height: 12, borderRadius: 3, background: RED }} />
            TUNISIAFLICKS  ·  LIST
          </div>
          <div style={{ display: 'flex', marginTop: 22, fontSize: title.length > 30 ? 58 : 70, fontWeight: 800, lineHeight: 1.05 }}>
            {truncate(title, 70)}
          </div>
          <div style={{ display: 'flex', marginTop: 24, fontSize: 30, color: '#d4d4d8' }}>
            {`A list by ${truncate(owner, 30)}  •  ${count} title${count === 1 ? '' : 's'}`}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 'auto', fontSize: 24, color: '#e4e4e7' }}>
            <div style={{ display: 'flex', background: RED, color: 'white', fontWeight: 800, padding: '8px 18px', borderRadius: 10 }}>See the list</div>
            {SITE_HOST}
          </div>
        </div>
        {tiles.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', width: 474, gap: 12, alignContent: 'center' }}>
            {tiles.map((src) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={src} src={src} alt="" width={150} height={225} style={{ width: 150, height: 225, objectFit: 'cover', borderRadius: 14, boxShadow: '0 10px 30px rgba(0,0,0,0.6)' }} />
            ))}
          </div>
        )}
      </div>
    ),
    { ...OG_SIZE, fonts: fontList.length ? fontList : undefined }
  ))
}

export type WrappedCardData = {
  name: string
  year: number
  titles: number
  minutes: number
  episodes: number
  topGenres: { name: string }[]
  personality: { title: string }
  topShow: { title: string, poster_path: string | null } | null
  posters: string[]
}

const hoursLabel = (minutes: number) => {
  const hours = minutes / 60
  return hours >= 10 ? String(Math.round(hours)) : hours.toFixed(1)
}

/** "Your year" recap image: 1200x630 link preview ('og') or 1080x1920 story ('story'). */
export async function renderWrappedCard(data: WrappedCardData, format: 'og' | 'story') {
  const fontList = await fonts()
  const family = fontStyle(fontList)
  const story = format === 'story'
  const size = story ? { width: 1080, height: 1920 } : OG_SIZE
  const posters = data.posters.slice(0, 6).map((path) => `https://image.tmdb.org/t/p/w342${path}`)

  // Long values (show titles, "Sci-Fi & Fantasy") shrink so a single word never overflows its column.
  const valueSize = (value: string) => {
    const longestWord = Math.max(...value.split(/\s+/).map((word) => word.length))
    // ~0.6em per bold glyph: fit the longest word inside the 440px story column.
    if (story) return Math.min(120, Math.floor(430 / (longestWord * 0.6)))
    return value.length <= 8 ? 64 : 48
  }

  const stat = (label: string, value: string, sub?: string) => (
    <div style={{ display: 'flex', flexDirection: 'column', ...(story ? { width: 440 } : {}) }}>
      <div style={{ display: 'flex', fontSize: story ? 30 : 20, fontWeight: 800, letterSpacing: 3, color: '#fca5a5' }}>{label}</div>
      <div style={{ display: 'flex', fontSize: valueSize(value), fontWeight: 800, lineHeight: 1.05 }}>{value}</div>
      {sub && <div style={{ display: 'flex', fontSize: story ? 32 : 22, color: '#e4e4e7', marginTop: 6 }}>{sub}</div>}
    </div>
  )

  return asJpeg(new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', ...family, color: 'white', padding: story ? '96px 80px' : '52px 64px', background: 'linear-gradient(135deg, #dc2626 0%, #7f1d1d 45%, #0d0c0f 100%)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: story ? 34 : 22, fontWeight: 800, letterSpacing: 4, color: '#fecaca' }}>
          <div style={{ display: 'flex', width: story ? 18 : 12, height: story ? 18 : 12, borderRadius: 4, background: 'white' }} />
          TUNISIAFLICKS  ·  WRAPPED
        </div>
        <div style={{ display: 'flex', marginTop: story ? 40 : 16, fontSize: story ? 104 : 60, fontWeight: 800, lineHeight: 1.02 }}>
          {truncate(`${data.name}'s ${data.year}`, 30)}
        </div>
        <div style={{ display: 'flex', marginTop: story ? 20 : 8, fontSize: story ? 44 : 28, color: '#fde68a', fontWeight: 800 }}>
          {data.personality.title}
        </div>

        <div style={{ display: 'flex', flexWrap: story ? 'wrap' : 'nowrap', rowGap: 56, columnGap: story ? 40 : 56, marginTop: story ? 72 : 32 }}>
          {stat('TITLES WATCHED', String(data.titles))}
          {stat('HOURS', `~${hoursLabel(data.minutes)}`, data.episodes ? `≈ ${data.episodes} episodes` : undefined)}
          {data.topGenres[0] && stat('TOP GENRE', truncate(data.topGenres[0].name, 16), data.topGenres.slice(1).map((g) => g.name).join(' · ') || undefined)}
          {story && data.topShow && stat('MOST-WATCHED SHOW', truncate(data.topShow.title, 22))}
        </div>

        {posters.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: story ? 18 : 12, marginTop: 'auto' }}>
            {posters.map((src) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={src} src={src} alt="" width={story ? 260 : 96} height={story ? 390 : 144} style={{ width: story ? 260 : 96, height: story ? 390 : 144, objectFit: 'cover', borderRadius: story ? 18 : 10 }} />
            ))}
          </div>
        )}

        <div style={{ display: 'flex', marginTop: story ? 56 : 'auto', paddingTop: story ? 0 : 20, fontSize: story ? 34 : 22, color: '#fecaca' }}>
          {`What was your year? ${SITE_HOST}`}
        </div>
      </div>
    ),
    { ...size, fonts: fontList.length ? fontList : undefined }
  ))
}

/** The plain brand card, used when a title can't be loaded. */
export function renderFallbackCard() {
  return renderShareCard({ title: 'Movies & TV shows', description: 'Stream the latest movies, TV shows and Tunisian series.' })
}

export const tmdbImage = (path: string | null | undefined, size: string) => (path ? `https://image.tmdb.org/t/p/${size}${path}` : null)
