// Share cards: the images people see when a TunisiaFlicks link is pasted into WhatsApp, Facebook,
// Messenger, X, Telegram or Discord (Open Graph / Twitter images, 1200x630), plus the 1080x1920
// "My year" story. They speak the site's visual language: a black room lit by the picture, the
// backdrop fading in from the right, a glow in the poster's own colour, the title logo, condensed
// display type, and the red Play pill as the one signal colour.
import { mkdir, writeFile } from 'fs/promises'
import os from 'os'
import path from 'path'
import { ImageResponse } from 'next/og'
import { dominantColor } from '@/src/lib/ambient'
import { SITE_HOST } from '@/src/lib/seo'
import { MARK_PATH, MARK_TRANSFORM, MARK_VIEWBOX, WORDMARK_RATIO, WORDMARK_URI } from '@/src/lib/brand-assets'

export const OG_SIZE = { width: 1200, height: 630 }

const RED = '#FF2414'
const RED_DEEP = '#E50F05'
const STAR = '#FFC53D'
/** The faint red the room keeps when nothing is lighting it (the site's default room light). */
const ROOM_RED = '255 36 20'
const FLAG_RED = '231 0 19'
const GOLD = '245 190 80'

// ---------------------------------------------------------------------------------------------
// Fonts: the site's own faces, as static TTF instances from Google Fonts (Satori can't read woff2
// or variable fonts; without a browser User-Agent, Google serves instanced TTF). Fetched once per
// server instance; a Google Fonts outage degrades to the built-in font instead of failing.

type Weight = 400 | 600 | 700 | 800
// Readex Pro covers Arabic too, but Satori crashes on its Arabic tables: only its Latin glyphs are
// loaded (Google Fonts subsets a font to the characters given in `text=`).
const LATIN = encodeURIComponent([
  ...Array.from({ length: 0x17f - 0x20 + 1 }, (_, index) => String.fromCharCode(0x20 + index)).filter((char) => char < '\x7f' || char >= '\xa0'),
  ...'–—‘’“”…•€™',
].join(''))
const ALEXANDRIA_400 = 'Alexandria:wght@400'
const ALEXANDRIA_700 = 'Alexandria:wght@700'
const FONT_FILES: { name: string, query: string, weight: Weight }[] = [
  { name: 'Display', query: 'Bricolage+Grotesque:opsz,wdth,wght@96,75,800', weight: 800 },
  { name: 'Text', query: `Readex+Pro:wght@400&text=${LATIN}`, weight: 400 },
  { name: 'Text', query: `Readex+Pro:wght@600&text=${LATIN}`, weight: 600 },
  // Satori's fallback for stray Arabic letters; Arabic text proper is set by Pango (below).
  { name: 'Arabic', query: ALEXANDRIA_700, weight: 700 },
]
const fontCache = new Map<string, Promise<ArrayBuffer | null>>()

function loadFont(query: string) {
  let pending = fontCache.get(query)
  if (!pending) {
    pending = (async () => {
      try {
        const css = await fetch(`https://fonts.googleapis.com/css2?family=${query}`).then((res) => res.text())
        const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1]
        return url ? await fetch(url).then((res) => res.arrayBuffer()) : null
      } catch {
        return null
      }
    })()
    fontCache.set(query, pending)
  }
  return pending
}

type LoadedFont = { name: string, data: ArrayBuffer, weight: Weight, style: 'normal' }

async function loadFonts(): Promise<LoadedFont[]> {
  const files = await Promise.all(FONT_FILES.map((font) => loadFont(font.query)))
  return FONT_FILES.flatMap((font, index) => {
    const data = files[index]
    return data ? [{ name: font.name, data, weight: font.weight, style: 'normal' as const }] : []
  })
}

const DISPLAY = 'Display, Text, Arabic'
const TEXT = 'Text, Arabic'

// ---------------------------------------------------------------------------------------------
// Arabic. Satori shapes Arabic letters but has no bidi (every line runs left to right) and
// measures joined letters as if they stood alone, which leaves holes between words. So text with
// Arabic in it is set by Pango instead (inside sharp, with HarfBuzz and FriBidi: proper shaping,
// right-to-left lines, Arabic and English mixed) and placed on the card as a picture.

const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/
const FONT_DIR = path.join(os.tmpdir(), 'tunisiaflicks-share-fonts')
const ARABIC_FILES = { regular: 'alexandria-400.ttf', bold: 'alexandria-700.ttf' }
let pango: Promise<boolean> | null = null

/** Gives Pango the Arabic font, and only it: fontconfig reads its configuration once, on first use. */
function preparePango() {
  pango ??= (async () => {
    try {
      const [regular, bold] = await Promise.all([loadFont(ALEXANDRIA_400), loadFont(ALEXANDRIA_700)])
      if (!regular || !bold) return false
      await mkdir(path.join(FONT_DIR, 'cache'), { recursive: true })
      const config = path.join(FONT_DIR, 'fonts.conf')
      await Promise.all([
        writeFile(path.join(FONT_DIR, ARABIC_FILES.regular), Buffer.from(regular)),
        writeFile(path.join(FONT_DIR, ARABIC_FILES.bold), Buffer.from(bold)),
        writeFile(config, `<?xml version="1.0"?>\n<!DOCTYPE fontconfig SYSTEM "fonts.dtd">\n<fontconfig><dir>${FONT_DIR}</dir><cachedir>${path.join(FONT_DIR, 'cache')}</cachedir></fontconfig>\n`),
      ])
      process.env.FONTCONFIG_FILE ??= config
      return true
    } catch (error) {
      console.error('Share cards: Arabic text setup failed:', error)
      return false
    }
  })()
  return pango
}

/** Plain text, which Satori sets, or a picture of text Pango has set. */
type TextRun = { text: string } | { src: string, width: number, height: number }
type TextSpec = {
  /** Pango's size in pixels. Alexandria is wider than the condensed display face: titles shrink. */
  size: number
  /** Wrap width. */
  width: number
  bold?: boolean
  alpha?: number
  lineGap?: number
  /** An English sentence around an Arabic name (Pango would otherwise run it right to left). */
  ltr?: boolean
}

/** A name inside an English sentence: keeps its direction to itself ("A list by مالك, 3 titles"). */
const isolate = (name: string) => (ARABIC.test(name) ? `\u2068${name}\u2069` : name)

const escapeMarkup = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

async function prepareText(text: string, spec: TextSpec): Promise<TextRun> {
  if (!ARABIC.test(text) || !(await preparePango())) return { text }
  try {
    const sharp = (await import('sharp')).default
    const markup = `<span foreground="#ffffff" fgalpha="${Math.round((spec.alpha ?? 1) * 100)}%">${spec.ltr ? '‎' : ''}${escapeMarkup(text)}</span>`
    const { data, info } = await sharp({
      text: {
        text: markup,
        font: `Alexandria ${spec.bold ? 'Bold ' : ''}${spec.size}`,
        fontfile: path.join(FONT_DIR, spec.bold ? ARABIC_FILES.bold : ARABIC_FILES.regular),
        width: spec.width,
        dpi: 72,
        rgba: true,
        wrap: 'word',
        spacing: spec.lineGap ?? 0,
      },
    }).png().toBuffer({ resolveWithObject: true })
    return { src: `data:image/png;base64,${data.toString('base64')}`, width: info.width, height: info.height }
  } catch (error) {
    console.error('Share cards: Arabic text failed:', error)
    return { text }
  }
}

/** A prepared run: Satori sets it in `type`; a picture of Pango's text only takes the `box` margins. */
function Text({ run, box, type }: { run: TextRun, box?: React.CSSProperties, type: React.CSSProperties }) {
  if ('src' in run) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={run.src} alt="" width={run.width} height={run.height} style={{ ...box, width: run.width, height: run.height }} />
  }
  return <div style={{ display: 'flex', ...box, ...type }}>{run.text}</div>
}

// ---------------------------------------------------------------------------------------------
// Output: JPEG, not Satori's PNG. Photographic PNG cards weigh ~800 KB; WhatsApp (how most links
// get shared here) shrinks or drops previews above roughly 300 KB. JPEG lands around 60-150 KB.

async function asJpeg(image: ImageResponse, quality = 82): Promise<Response> {
  // Rendering errors surface here: the stream can only be read once.
  const png = new Uint8Array(await image.arrayBuffer())
  const cacheControl = image.headers.get('Cache-Control') ?? 'public, max-age=86400'
  try {
    const sharp = (await import('sharp')).default
    const jpeg = await sharp(png).jpeg({ quality, mozjpeg: true, chromaSubsampling: '4:4:4' }).toBuffer()
    return new Response(new Uint8Array(jpeg), { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': cacheControl } })
  } catch (error) {
    console.error('Share cards: JPEG encoding failed, serving PNG:', error)
    return new Response(png, { headers: { 'Content-Type': 'image/png', 'Cache-Control': cacheControl } })
  }
}

async function render(element: React.ReactElement, size: { width: number, height: number } = OG_SIZE): Promise<Response> {
  const fonts = await loadFonts()
  const options = { ...size, fonts: fonts.length ? fonts : undefined }
  try {
    return await asJpeg(new ImageResponse(element, options))
  } catch (error) {
    // A glyph or a picture Satori can't handle: the brand card beats a link with no preview.
    console.error('Share cards: card failed, serving the brand card:', error)
    return asJpeg(new ImageResponse(<BrandCard />, { ...options, ...OG_SIZE }))
  }
}

// ---------------------------------------------------------------------------------------------
// Pictures and colour.

export const tmdbImage = (path: string | null | undefined, size: string) => (path ? `https://image.tmdb.org/t/p/${size}${path}` : null)

/**
 * The title-treatment logo for a card: English or textless, PNG only (some TMDB logos are SVGs
 * Satori can't draw), and wide enough to read as a title.
 */
export function shareLogo(logos: any[] | undefined): { src: string, ratio: number } | null {
  const usable = (logos ?? []).filter((logo) => logo.file_path?.endsWith('.png') && (logo.aspect_ratio ?? 0) >= 1.4)
  const logo = usable.find((item) => item.iso_639_1 === 'en') ?? usable.find((item) => !item.iso_639_1)
  return logo ? { src: `https://image.tmdb.org/t/p/w500${logo.file_path}`, ratio: logo.aspect_ratio } : null
}

const colorCache = new Map<string, Promise<string | null>>()

/** The poster's ambient colour ("r g b"), the same one the site lights the room with. */
export function posterGlow(posterPath: string | null | undefined): Promise<string | null> {
  if (!posterPath) return Promise.resolve(null)
  let pending = colorCache.get(posterPath)
  if (!pending) {
    pending = (async () => {
      try {
        const response = await fetch(`https://image.tmdb.org/t/p/w92${posterPath}`)
        if (!response.ok) return null
        const sharp = (await import('sharp')).default
        const pixels = await sharp(Buffer.from(await response.arrayBuffer())).resize(32, 48, { fit: 'fill' }).ensureAlpha().raw().toBuffer()
        return dominantColor(new Uint8ClampedArray(pixels.buffer, pixels.byteOffset, pixels.length))
      } catch {
        return null
      }
    })()
    colorCache.set(posterPath, pending)
  }
  return pending
}

/**
 * A picture as a data URI at the size the card draws it. Every picture goes through sharp: TMDB
 * sometimes serves WebP even for .jpg URLs, so does the Tunisian catalogue's blog, and Satori
 * can't draw WebP (it leaves a hole). Logos stay PNG, for their transparency.
 */
async function pictureData(url: string | null | undefined, width: number, format: 'jpeg' | 'png' = 'jpeg'): Promise<string | null> {
  if (!url) return null
  try {
    const response = await fetch(url, { next: { revalidate: 86400 } })
    if (!response.ok) return null
    const sharp = (await import('sharp')).default
    const resized = sharp(Buffer.from(await response.arrayBuffer())).resize({ width, withoutEnlargement: true })
    const data = await (format === 'png' ? resized.png() : resized.jpeg({ quality: 84 })).toBuffer()
    return `data:image/${format};base64,${data.toString('base64')}`
  } catch {
    return null
  }
}

const pictures = async (urls: (string | null | undefined)[], width: number) =>
  (await Promise.all(urls.map((url) => pictureData(url, width)))).filter((picture): picture is string => !!picture)

const rgba = (rgb: string, alpha: number) => `rgba(${rgb.split(' ').join(',')},${alpha})`

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text)

/** A title size that keeps the title on one or two lines in a ~600px column. */
const titleSize = (title: string) => (title.length <= 12 ? 108 : title.length <= 20 ? 92 : title.length <= 32 ? 76 : 62)

/** The same title in Alexandria, which is much wider than the condensed display face. */
const arabicTitleSize = (title: string) => Math.round(titleSize(title) * 0.72)

// ---------------------------------------------------------------------------------------------
// Pieces.

function Wordmark({ height }: { height: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={WORDMARK_URI} alt="" width={Math.round(height * WORDMARK_RATIO)} height={height} />
}

function Mark({ size, color = RED }: { size: number, color?: string }) {
  return (
    <svg width={size} height={Math.round((size * 36) / 41.57)} viewBox={MARK_VIEWBOX}>
      <g transform={MARK_TRANSFORM}><path d={MARK_PATH} fill={color} /></g>
    </svg>
  )
}

function Star({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <path fill={STAR} d="M12 2.5l2.9 6.2 6.8.8-5 4.7 1.3 6.7L12 17.6l-6 3.3 1.3-6.7-5-4.7 6.8-.8z" />
    </svg>
  )
}

/** The crescent and star of the Tunisian flag. */
function TunisiaEmblem({ size, color }: { size: number, color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <path fill={color} fillRule="evenodd" d="M50 25a25 25 0 1 0 0 50a25 25 0 1 0 0-50zm7 5a20 20 0 1 1 0 40a20 20 0 1 1 0-40z" />
      <polygon fill={color} points="49.00,50.00 57.28,47.30 57.29,38.59 62.42,45.63 70.71,42.95 65.60,50.00 70.71,57.05 62.42,54.37 57.29,61.41 57.28,52.70" />
    </svg>
  )
}

/** The red "do it" pill, as on the site. */
function Pill({ label, play = true }: { label: string, play?: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', height: 64, padding: play ? '0 32px 0 26px' : '0 32px', borderRadius: 999,
      backgroundImage: `linear-gradient(180deg, ${RED} 0%, ${RED_DEEP} 100%)`, color: 'white', fontFamily: TEXT, fontWeight: 600, fontSize: 26,
      boxShadow: '0 14px 40px -10px rgba(229,15,5,0.75)',
    }}>
      {play && (
        <svg width="22" height="22" viewBox="0 0 24 24" style={{ marginRight: 14 }}><path fill="white" d="M6 3.5v17l14-8.5z" /></svg>
      )}
      {label}
    </div>
  )
}

function Footer({ cta, play = true, children }: { cta: string, play?: boolean, children?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <Pill label={cta} play={play} />
      {children ?? <div style={{ display: 'flex', marginLeft: 22, fontFamily: TEXT, fontSize: 24, color: 'rgba(255,255,255,0.5)' }}>{SITE_HOST}</div>}
    </div>
  )
}

/** Facts separated by space, not dots (as on the site): a rating first when there is one. */
function Facts({ rating, items, size = 28 }: { rating?: number | null, items: (string | null | undefined)[], size?: number }) {
  const shown = items.filter((item): item is string => !!item)
  if (!rating && shown.length === 0) return null
  return (
    <div style={{ display: 'flex', alignItems: 'center', fontFamily: TEXT, fontSize: size, color: 'rgba(255,255,255,0.78)' }}>
      {rating ? (
        <div style={{ display: 'flex', alignItems: 'center', marginRight: 26, fontWeight: 600, color: 'white' }}>
          <Star size={Math.round(size * 0.95)} />
          <div style={{ display: 'flex', marginLeft: 8 }}>{(Math.round(rating * 10) / 10).toFixed(1)}</div>
        </div>
      ) : null}
      {shown.map((item) => (
        <div key={item} style={{ display: 'flex', marginRight: 26 }}>{item}</div>
      ))}
    </div>
  )
}

function Fill({ background }: { background: string }) {
  return <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', backgroundImage: background }} />
}

/** The black room, lit from the bottom-start corner in `glow`. */
function Room({ glow, strength = 0.55 }: { glow: string, strength?: number }) {
  return <Fill background={`radial-gradient(circle at 8% 112%, ${rgba(glow, strength)} 0%, ${rgba(glow, strength * 0.35)} 32%, ${rgba(glow, 0)} 62%)`} />
}

/** The left column every card writes in: the wordmark at the top, the words at the bottom. */
function Column({ width = 620, wordmark = 26, children }: { width?: number, wordmark?: number, children: React.ReactNode }) {
  return (
    <div style={{ position: 'absolute', top: 54, left: 64, bottom: 54, width, display: 'flex', flexDirection: 'column' }}>
      <Wordmark height={wordmark} />
      <div style={{ display: 'flex', flex: 1 }} />
      {children}
    </div>
  )
}

const CARD: React.CSSProperties = { width: '100%', height: '100%', display: 'flex', position: 'relative', background: '#000', color: 'white' }
const TITLE_TYPE: React.CSSProperties = { fontFamily: DISPLAY, fontWeight: 800, lineHeight: 0.95, letterSpacing: -1 }
const LINE_TYPE: React.CSSProperties = { fontFamily: TEXT, fontSize: 27, lineHeight: 1.38, color: 'rgba(255,255,255,0.72)' }
const KICKER_TYPE: React.CSSProperties = { fontFamily: TEXT, fontWeight: 600, fontSize: 26, color: 'rgba(255,255,255,0.6)' }

// ---------------------------------------------------------------------------------------------
// Cards.

export type TitleCard = {
  title: string
  /** Full image URLs. */
  backdrop?: string | null
  poster?: string | null
  /** The title-treatment logo (a PNG URL) and its width/height ratio, shown instead of the title text. */
  logo?: { src: string, ratio: number } | null
  glow?: string | null
  rating?: number | null
  facts: (string | null | undefined)[]
  /** Tagline, or the start of the synopsis. */
  line?: string | null
  cta: string
}

/** A movie or a show, framed like its page's hero. */
export async function renderTitleCard(card: TitleCard) {
  const glow = card.glow ?? ROOM_RED
  // The logo fits a 540x170 box, bottom-start aligned, like the hero's title treatment.
  const logoWidth = card.logo ? Math.round(Math.min(540, 170 * card.logo.ratio)) : 0
  const [title, line, backdrop, poster, logoSrc] = await Promise.all([
    prepareText(clip(card.title, 60), { size: arabicTitleSize(card.title), width: 620, bold: true }),
    card.line ? prepareText(clip(card.line, 110), { size: 25, width: 600, alpha: 0.72, lineGap: 6 }) : null,
    pictureData(card.backdrop, 900),
    card.backdrop ? null : pictureData(card.poster, 327),
    card.logo ? pictureData(card.logo.src, logoWidth * 2, 'png') : null,
  ])
  const logo = card.logo && logoSrc ? { src: logoSrc, width: logoWidth, height: Math.round(logoWidth / card.logo.ratio) } : null

  return render(
    <div style={CARD}>
      {backdrop ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={backdrop} alt="" width={900} height={630} style={{ position: 'absolute', top: 0, right: 0, width: 900, height: 630, objectFit: 'cover' }} />
      ) : null}
      <Fill background="linear-gradient(90deg, #000 0%, #000 26%, rgba(0,0,0,0.86) 42%, rgba(0,0,0,0.35) 70%, rgba(0,0,0,0.08) 100%)" />
      <Fill background="linear-gradient(0deg, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.35) 32%, rgba(0,0,0,0) 55%)" />
      <Room glow={glow} />

      {poster ? (
        <div style={{ position: 'absolute', right: 96, top: 70, display: 'flex' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={poster} alt="" width={327} height={490} style={{ width: 327, height: 490, objectFit: 'cover', borderRadius: 24, boxShadow: `0 40px 90px -10px ${rgba(glow, 0.55)}` }} />
        </div>
      ) : null}

      <Column>
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo.src} alt="" width={logo.width} height={logo.height} style={{ width: logo.width, height: logo.height }} />
        ) : (
          <Text run={title} type={{ ...TITLE_TYPE, fontSize: titleSize(card.title) }} />
        )}
        <div style={{ display: 'flex', marginTop: 26 }}>
          <Facts rating={card.rating} items={card.facts} />
        </div>
        {line ? <Text run={line} box={{ marginTop: 16 }} type={LINE_TYPE} /> : null}
        <div style={{ display: 'flex', marginTop: 34 }}>
          <Footer cta={card.cta} />
        </div>
      </Column>
    </div>
  )
}

export type PersonCard = {
  name: string
  role?: string | null
  facts: (string | null | undefined)[]
  photo?: string | null
  backdrop?: string | null
  /** Posters of their best-known titles. */
  strip: string[]
  glow?: string | null
  cta: string
}

/** A person: a framed portrait on the end side, their name in big display type, their films. */
export async function renderPersonCard(card: PersonCard) {
  const glow = card.glow ?? ROOM_RED
  const size = titleSize(card.name) + 6
  const [name, photo, backdrop, strip] = await Promise.all([
    prepareText(clip(card.name, 40), { size: Math.round(size * 0.72), width: 660, bold: true }),
    pictureData(card.photo, 334),
    pictureData(card.backdrop, 1200),
    pictures(card.strip.slice(0, 5), 84),
  ])
  return render(
    <div style={CARD}>
      {backdrop ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={backdrop} alt="" width={1200} height={630} style={{ position: 'absolute', top: 0, left: 0, width: 1200, height: 630, objectFit: 'cover', opacity: 0.28 }} />
      ) : null}
      <Fill background="linear-gradient(90deg, #000 0%, rgba(0,0,0,0.9) 45%, rgba(0,0,0,0.55) 100%)" />
      <Room glow={glow} strength={0.5} />

      <div style={{ position: 'absolute', right: 84, top: 64, display: 'flex' }}>
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" width={334} height={502} style={{ width: 334, height: 502, objectFit: 'cover', borderRadius: 26, boxShadow: `0 40px 90px -10px ${rgba(glow, 0.5)}` }} />
        ) : (
          <div style={{ width: 334, height: 502, display: 'flex', borderRadius: 26, background: 'rgba(255,255,255,0.06)' }} />
        )}
      </div>

      <Column width={660}>
        {card.role ? <div style={{ display: 'flex', ...KICKER_TYPE, color: 'rgba(255,255,255,0.55)' }}>{card.role}</div> : null}
        <Text run={name} box={{ marginTop: 6 }} type={{ ...TITLE_TYPE, fontSize: size }} />
        <div style={{ display: 'flex', marginTop: 22 }}>
          <Facts items={card.facts} size={26} />
        </div>
        {strip.length > 0 ? (
          <div style={{ display: 'flex', marginTop: 28 }}>
            {strip.map((src) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={src} src={src} alt="" width={84} height={126} style={{ width: 84, height: 126, objectFit: 'cover', borderRadius: 12, marginRight: 14, boxShadow: '0 16px 30px -12px rgba(0,0,0,0.9)' }} />
            ))}
          </div>
        ) : null}
        <div style={{ display: 'flex', marginTop: 30 }}>
          <Footer cta={card.cta} play={false} />
        </div>
      </Column>
    </div>
  )
}

/** Posters as a tilted wall drifting off the end side (the sign-in pages' poster wall). */
function PosterWall({ posters }: { posters: string[] }) {
  const columns = [0, 1, 2, 3].map((column) => [0, 1, 2].map((row) => posters[(column * 3 + row) % posters.length]))
  return (
    <div style={{ position: 'absolute', top: -170, left: 540, width: 900, height: 1000, display: 'flex', transform: 'rotate(-9deg)' }}>
      {columns.map((column, index) => (
        <div key={index} style={{ display: 'flex', flexDirection: 'column', marginRight: 22, marginTop: index % 2 === 0 ? 0 : 120 }}>
          {column.map((src, row) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={`${src}-${row}`} src={src} alt="" width={190} height={285} style={{ width: 190, height: 285, objectFit: 'cover', borderRadius: 18, marginBottom: 22, boxShadow: '0 30px 60px -20px rgba(0,0,0,0.9)' }} />
          ))}
        </div>
      ))}
    </div>
  )
}

export type SectionCard = {
  title: string
  subtitle: string
  posters: string[]
  cta: string
  glow?: string
  /** A watermark behind the words: the crescent and star for Tunisian and Ramadan pages. */
  emblem?: 'tunisia' | 'ramadan'
}

/** A section of the site (home, Discover, Clips...): a wall of what's on it today behind the words. */
export async function renderSectionCard(card: SectionCard) {
  const glow = card.glow ?? (card.emblem === 'tunisia' ? FLAG_RED : card.emblem === 'ramadan' ? GOLD : ROOM_RED)
  const size = card.title.length <= 18 ? 100 : 82
  const [title, subtitle, posters] = await Promise.all([
    prepareText(card.title, { size: Math.round(size * 0.72), width: 640, bold: true }),
    prepareText(clip(card.subtitle, 120), { size: 26, width: 620, alpha: 0.72, lineGap: 6, ltr: true }),
    pictures(card.posters.slice(0, 12), 190),
  ])
  return render(
    <div style={CARD}>
      {posters.length > 0 ? <PosterWall posters={posters} /> : null}
      <Fill background="linear-gradient(90deg, #000 0%, #000 34%, rgba(0,0,0,0.82) 50%, rgba(0,0,0,0.25) 78%, rgba(0,0,0,0.05) 100%)" />
      <Fill background="linear-gradient(0deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0) 40%)" />
      <Room glow={glow} strength={0.6} />
      {card.emblem ? (
        <div style={{ position: 'absolute', top: 40, left: 330, display: 'flex' }}>
          <TunisiaEmblem size={300} color={rgba(glow, card.emblem === 'ramadan' ? 0.16 : 0.18)} />
        </div>
      ) : null}

      <Column width={640} wordmark={30}>
        <Text run={title} type={{ ...TITLE_TYPE, fontSize: size, lineHeight: 0.93 }} />
        <Text run={subtitle} box={{ marginTop: 22 }} type={{ ...LINE_TYPE, fontSize: 28, lineHeight: 1.4 }} />
        <div style={{ display: 'flex', marginTop: 36 }}>
          <Footer cta={card.cta} />
        </div>
      </Column>
    </div>
  )
}

/** A user's list: title and owner, and a tilted wall of the list's posters. */
export function renderListCard({ title, owner, count, posters }: { title: string, owner: string, count: number, posters: string[] }) {
  return renderSectionCard({
    title: clip(title, 44),
    subtitle: `A list by ${isolate(clip(owner, 30))}, ${count} title${count === 1 ? '' : 's'}.`,
    posters,
    cta: 'See the list',
  })
}

export type SwipeCardData = { code: string, names: string[], posters: string[] }

/** Three posters fanned out like a hand of cards, on the end side. */
function Fan({ posters }: { posters: string[] }) {
  return (
    <div style={{ position: 'absolute', top: 70, left: 676, width: 500, height: 500, display: 'flex' }}>
      {posters.slice(0, 3).map((src, index) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src}
          src={src}
          alt=""
          width={260}
          height={390}
          style={{
            position: 'absolute', top: index === 1 ? 20 : 50, left: 96 + (index - 1) * 128, width: 260, height: 390, objectFit: 'cover', borderRadius: 24,
            transform: `rotate(${(index - 1) * 11}deg)`, boxShadow: '0 40px 70px -20px rgba(0,0,0,0.95)', border: '2px solid rgba(255,255,255,0.12)',
          }}
        />
      ))}
    </div>
  )
}

/** An invitation to a Swipe room: three posters fanned out, the room code, and a call to join. */
export async function renderSwipeCard({ code, names, posters }: SwipeCardData) {
  const host = names[0]
  const [kicker, fan] = await Promise.all([
    prepareText(host ? `${isolate(clip(host, 20))} is picking what to watch` : 'Help pick what to watch tonight', { size: 24, width: 560, bold: true, alpha: 0.6, ltr: true }),
    pictures(posters.slice(0, 3), 260),
  ])
  return render(
    <div style={CARD}>
      <Room glow={ROOM_RED} strength={0.7} />
      <Fill background={`radial-gradient(circle at 78% 50%, ${rgba(ROOM_RED, 0.22)} 0%, rgba(0,0,0,0) 45%)`} />
      <Fan posters={fan} />
      <Column width={560}>
        <Text run={kicker} type={KICKER_TYPE} />
        <div style={{ display: 'flex', marginTop: 8, ...TITLE_TYPE, fontSize: 100, lineHeight: 0.93 }}>Swipe to decide</div>
        <div style={{ display: 'flex', marginTop: 22, ...LINE_TYPE }}>Everyone swipes on their own phone. The first title you all like wins.</div>
        <div style={{ display: 'flex', marginTop: 34 }}>
          <Footer cta="Join the room" play={false}>
            <div style={{ display: 'flex', marginLeft: 20, padding: '10px 20px', borderRadius: 16, border: '2px solid rgba(255,255,255,0.18)', fontFamily: TEXT, fontWeight: 600, fontSize: 32, letterSpacing: 4 }}>{code}</div>
          </Footer>
        </div>
      </Column>
    </div>
  )
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

const PERSONA_GOLD = '#FCD27B'

/** "Your year in film": a 1200x630 link preview ('og') or a 1080x1920 story ('story'). */
export async function renderWrappedCard(data: WrappedCardData, format: 'og' | 'story') {
  const story = format === 'story'
  const genre = data.topGenres[0]?.name
  const [kicker, show, posters] = await Promise.all([
    prepareText(`${isolate(clip(data.name, 24))}'s year in film`, { size: story ? 38 : 24, width: story ? 900 : 600, bold: true, alpha: 0.6, ltr: true }),
    story && data.topShow ? prepareText(clip(data.topShow.title, 18), { size: 72, width: 440, bold: true }) : null,
    pictures(data.posters.slice(0, 3).map((poster) => `https://image.tmdb.org/t/p/w342${poster}`), story ? 280 : 260),
  ])

  const stat = (label: string, value: TextRun, valueSize: number, labelSize: number, box: React.CSSProperties) => (
    <div style={{ display: 'flex', flexDirection: 'column', ...box }}>
      <Text run={value} type={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: valueSize, lineHeight: 1 }} />
      <div style={{ display: 'flex', marginTop: 8, fontFamily: TEXT, fontSize: labelSize, color: 'rgba(255,255,255,0.6)' }}>{label}</div>
    </div>
  )
  // Red from the top corner, gold from the bottom one (Satori drops fragments: one layer, two lights).
  const light = <Fill background={`radial-gradient(circle at 0% 0%, ${rgba(ROOM_RED, 0.6)} 0%, ${rgba(ROOM_RED, 0.18)} 35%, rgba(0,0,0,0) 65%), radial-gradient(circle at 100% 100%, ${rgba(GOLD, 0.28)} 0%, rgba(0,0,0,0) 50%)`} />

  if (!story) {
    return render(
      <div style={CARD}>
        {light}
        <Fan posters={posters} />
        <Column width={600}>
          <Text run={kicker} type={KICKER_TYPE} />
          <div style={{ display: 'flex', ...TITLE_TYPE, fontSize: 150, lineHeight: 1, letterSpacing: -3 }}>{String(data.year)}</div>
          <div style={{ display: 'flex', marginTop: 6, ...TITLE_TYPE, fontSize: 42, color: PERSONA_GOLD }}>{clip(data.personality.title, 28)}</div>
          <div style={{ display: 'flex', marginTop: 26 }}>
            {stat('titles watched', { text: String(data.titles) }, 50, 20, { marginRight: 40 })}
            {stat('hours', { text: `~${hoursLabel(data.minutes)}` }, 50, 20, { marginRight: 40 })}
            {genre ? stat('top genre', { text: clip(genre, 15) }, 50, 20, {}) : null}
          </div>
          <div style={{ display: 'flex', marginTop: 32 }}>
            <Footer cta="What was your year?" play={false} />
          </div>
        </Column>
      </div>
    )
  }

  return render(
    <div style={CARD}>
      {light}
      <div style={{ position: 'absolute', top: 110, left: 84, right: 84, bottom: 110, display: 'flex', flexDirection: 'column' }}>
        <Wordmark height={40} />
        <Text run={kicker} box={{ marginTop: 120 }} type={{ ...KICKER_TYPE, fontSize: 40 }} />
        <div style={{ display: 'flex', marginTop: 10, ...TITLE_TYPE, fontSize: 300, lineHeight: 1, letterSpacing: -6 }}>{String(data.year)}</div>
        <div style={{ display: 'flex', marginTop: 20, ...TITLE_TYPE, fontSize: 68, color: PERSONA_GOLD }}>{clip(data.personality.title, 28)}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', marginTop: 80 }}>
          {stat('titles watched', { text: String(data.titles) }, 110, 34, { width: 456, marginBottom: 50 })}
          {stat('hours', { text: `~${hoursLabel(data.minutes)}` }, 110, 34, { width: 456, marginBottom: 50 })}
          {genre ? stat('top genre', { text: clip(genre, 15) }, 72, 34, { width: 456 }) : null}
          {show ? stat('most-watched show', show, 72, 34, { width: 456 }) : null}
        </div>
        <div style={{ display: 'flex', flex: 1 }} />
        {posters.length > 0 ? (
          <div style={{ display: 'flex' }}>
            {posters.map((src) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={src} src={src} alt="" width={280} height={420} style={{ width: 280, height: 420, objectFit: 'cover', borderRadius: 22, marginRight: 22, boxShadow: '0 24px 50px -14px rgba(0,0,0,0.9)' }} />
            ))}
          </div>
        ) : null}
        <div style={{ display: 'flex', marginTop: 50, fontFamily: TEXT, fontSize: 34, color: 'rgba(255,255,255,0.55)' }}>
          {`What was your year? ${SITE_HOST}`}
        </div>
      </div>
    </div>,
    { width: 1080, height: 1920 },
  )
}

// The catalogue's post titles read like "مشاهدة فيلم ويكاند كامل - Film Weekend".
const AR_NOISE = new Set(['مشاهدة', 'فيلم', 'مسلسل', 'كامل', 'كاملة', 'اون', 'أون', 'لاين'])
const LATIN_NOISE = /^(film|films|movie|serie|series|série|séries|feuilleton)\s+/i

/** "مشاهدة فيلم ويكاند كامل - Film Weekend" → { latin: 'Weekend', arabic: 'ويكاند' } */
function splitTunisianTitle(raw: string) {
  const words = raw.replace(/\s*[-–|:]+\s*/g, ' ').split(/\s+/).filter(Boolean)
  const arabic = words.filter((word) => ARABIC.test(word) && !AR_NOISE.has(word)).join(' ')
  let latin = words.filter((word) => !ARABIC.test(word)).join(' ').replace(LATIN_NOISE, '').trim()
  // All lower case on the source site: give it capitals ("fana mhat" → "Fana Mhat").
  if (latin === latin.toLowerCase()) latin = latin.replace(/(^|\s)(\S)/g, (_, space: string, char: string) => space + char.toUpperCase())
  return { latin, arabic }
}

export type TunisianCardData = { title: string, poster?: string | null, backdrop?: string | null, badges: string[], line?: string | null, kind: 'movie' | 'series' }

/** A title from the Tunisian catalogue: the poster framed under the crescent and star, in flag red. */
export async function renderTunisianCard(card: TunisianCardData) {
  const { latin, arabic } = splitTunisianTitle(card.title)
  const name = latin || arabic || card.title
  const badges = card.badges.filter((badge) => !AR_NOISE.has(badge.trim())).slice(0, 4)
  const [poster, backdrop, title, subtitle, line, ...badgeRuns] = await Promise.all([
    pictureData(card.poster, 327),
    pictureData(card.backdrop || card.poster, 1200),
    prepareText(clip(name, 50), { size: arabicTitleSize(name), width: 620, bold: true }),
    latin && arabic ? prepareText(clip(arabic, 40), { size: 34, width: 620, bold: true, alpha: 0.78 }) : null,
    card.line ? prepareText(clip(card.line, 110), { size: 23, width: 600, alpha: 0.7, lineGap: 6 }) : null,
    ...badges.map((badge) => prepareText(clip(badge, 24), { size: 20, width: 300, alpha: 0.8 })),
  ])
  return render(
    <div style={CARD}>
      {backdrop ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={backdrop} alt="" width={1200} height={630} style={{ position: 'absolute', top: 0, left: 0, width: 1200, height: 630, objectFit: 'cover', opacity: 0.22 }} />
      ) : null}
      <Fill background="linear-gradient(90deg, #000 0%, rgba(0,0,0,0.9) 50%, rgba(0,0,0,0.6) 100%)" />
      <Room glow={FLAG_RED} strength={0.6} />
      <div style={{ position: 'absolute', top: -60, right: 250, display: 'flex' }}><TunisiaEmblem size={520} color={rgba(FLAG_RED, 0.16)} /></div>
      {poster ? (
        <div style={{ position: 'absolute', right: 96, top: 70, display: 'flex' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={poster} alt="" width={327} height={490} style={{ width: 327, height: 490, objectFit: 'cover', borderRadius: 24, boxShadow: `0 40px 90px -10px ${rgba(FLAG_RED, 0.45)}`, border: '2px solid rgba(255,255,255,0.1)' }} />
        </div>
      ) : null}
      <Column>
        <div style={{ display: 'flex', alignItems: 'center', ...KICKER_TYPE }}>
          <TunisiaEmblem size={34} color={RED} />
          <div style={{ display: 'flex', marginLeft: 10 }}>{card.kind === 'series' ? 'Tunisian series' : 'Tunisian film'}</div>
        </div>
        <Text run={title} box={{ marginTop: 8 }} type={{ ...TITLE_TYPE, fontSize: titleSize(name), lineHeight: 1 }} />
        {subtitle ? <Text run={subtitle} box={{ marginTop: 10 }} type={{ ...KICKER_TYPE, fontSize: 34 }} /> : null}
        {badgeRuns.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', marginTop: 22 }}>
            {badgeRuns.map((badge, index) => (
              <div key={index} style={{ display: 'flex', alignItems: 'center', marginRight: 10, marginBottom: 8, padding: '6px 16px', borderRadius: 999, border: '2px solid rgba(255,255,255,0.18)' }}>
                <Text run={badge as TextRun} type={{ fontFamily: TEXT, fontSize: 22, color: 'rgba(255,255,255,0.8)' }} />
              </div>
            ))}
          </div>
        ) : null}
        {line ? <Text run={line} box={{ marginTop: 14 }} type={{ ...LINE_TYPE, fontSize: 25, lineHeight: 1.4 }} /> : null}
        <div style={{ display: 'flex', marginTop: 30 }}>
          <Footer cta="Watch now" />
        </div>
      </Column>
    </div>
  )
}

/** The brand alone: no pictures, no data, nothing that can fail. */
function BrandCard() {
  return (
    <div style={CARD}>
      <Room glow={ROOM_RED} strength={0.75} />
      <div style={{ position: 'absolute', top: -40, right: -60, display: 'flex' }}><Mark size={620} color="rgba(255,36,20,0.1)" /></div>
      <Column width={760} wordmark={30}>
        <div style={{ display: 'flex', ...TITLE_TYPE, fontSize: 96, lineHeight: 0.93 }}>Movies, TV and Tunisian series</div>
        <div style={{ display: 'flex', marginTop: 22, ...LINE_TYPE, fontSize: 28 }}>Trailers, a daily Top 10, Ramadan series and release alerts, in English and Arabic.</div>
        <div style={{ display: 'flex', marginTop: 36 }}>
          <Footer cta="Start watching" />
        </div>
      </Column>
    </div>
  )
}

/** The brand card, for anything that can't be loaded. */
export function renderFallbackCard() {
  return render(<BrandCard />)
}
