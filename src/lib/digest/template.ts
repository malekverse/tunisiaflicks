// The weekly digest as an e-mail: HTML and plain text. Pure (no database, no network), so the
// tests can render it.
//
// Built the way e-mail clients still need it: 600px wide, table layout, every style inline,
// explicit bgcolor attributes (Outlook and the dark-mode rewriters respect those), system fonts,
// no web fonts, no tracking pixel, no redirecting links. The site's look carries over: true
// black, white text at a few strengths, the room tinted by the hero's picture, and one red thing,
// the CTA pill. Arabic and Derja are dir="rtl" on every table; titles and names inside sentences
// are isolated (FSI...PDI) so a Latin title in an Arabic sentence, or the reverse, keeps its place.
import { dateLocale, htmlLang, isArabicScript, type Locale } from '@/src/lib/i18n/locales'
import type { Translate } from '@/src/lib/i18n/translate'
import type { DigestSection, DigestTile } from '@/src/lib/digest/providers'

export type DigestHero = {
  title: string
  href: string
  /** Landscape picture (TMDB path or https URL); the poster stands in when there is none. */
  backdrop: string | null
  poster: string | null
  /** The line above the title: why this one ('Out now', 'Tonight’s pick: ...'). */
  kicker: string
  text?: string
  cta: string
  /** The picture's ambient colour, 'r g b'. */
  color: string | null
}

/** A section as the e-mail shows it; `accent` ('r g b') draws it as a tinted band, `href` adds 'See all'. */
export type EmailSection = DigestSection & { accent?: string | null; href?: string }

export type DigestEmailInput = {
  locale: Locale
  t: Translate
  /** The site, without a trailing slash. */
  appUrl: string
  /** The profile's name. */
  name: string
  /** The edition's Friday (YYYY-MM-DD). */
  edition: string
  subject: string
  preheader: string
  hero: DigestHero | null
  sections: EmailSection[]
  unsubscribeUrl: string
  settingsUrl: string
}

export type RenderedDigest = { subject: string; preheader: string; html: string; text: string }

// ---- Colours (white at the site's strengths, flattened on black) --------------------------------
const BLACK = '#000000'
const SURFACE = '#0b0b0b'
const HAIRLINE = '#242424'
const WHITE = '#ffffff'
const SECONDARY = '#b3b3b3' // white/70
const TERTIARY = '#8c8c8c' // white/55, never fainter
const RED = '#e50f05'
const FONT = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans Arabic', Tahoma, sans-serif`

const WIDTH = 600
const GUTTER = 24
const INNER = WIDTH - GUTTER * 2 // 552
const COLUMNS = 3
const GAP = 12
const POSTER_W = Math.floor((INNER - GAP * (COLUMNS - 1)) / COLUMNS) // 176

const FSI = '⁨'
const PDI = '⁩'
/** Isolates a value inside a sentence (bidi-safe in both directions). */
export const isolate = (value: string | number) => `${FSI}${value}${PDI}`

export function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

/** French typography: a no-break space before a colon, a narrow one before ; ! ? » and after «. */
export function frenchSpacing(text: string) {
  return text
    .replace(/[   ]:/g, ' :')
    .replace(/[   ]([;!?»])/g, ' $1')
    .replace(/«[   ]/g, '« ')
}

const shorten = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text)

function rgb(color: string | null | undefined): [number, number, number] | null {
  const parts = color?.trim().split(/[\s,]+/).map(Number)
  return parts && parts.length === 3 && parts.every((n) => Number.isFinite(n) && n >= 0 && n <= 255) ? parts as [number, number, number] : null
}

/** `color` mixed into `base` at `amount` (0..1), as #rrggbb. */
function mix(color: [number, number, number], base: [number, number, number], amount: number) {
  return `#${color.map((value, i) => Math.round(base[i] + (value - base[i]) * amount).toString(16).padStart(2, '0')).join('')}`
}

const IMAGE_BASE = 'https://image.tmdb.org/t/p'

/** An image URL: TMDB paths at `size`, https URLs as they are, anything else dropped. */
export function imageUrl(picture: string | null | undefined, size: 'w154' | 'w342' | 'w780'): string | null {
  if (!picture) return null
  if (picture.startsWith('/') && !picture.startsWith('//')) return `${IMAGE_BASE}/${size}${picture}`
  return /^https:\/\//i.test(picture) ? picture : null
}

/** An absolute link: site paths under appUrl, https URLs as they are. */
export function absolute(appUrl: string, href: string) {
  if (href.startsWith('/') && !href.startsWith('//')) return `${appUrl}${href}`
  return /^https:\/\//i.test(href) ? href : appUrl
}

// ---- HTML ----------------------------------------------------------------------------------------

type Ctx = { rtl: boolean; dir: 'rtl' | 'ltr'; start: 'left' | 'right'; end: 'left' | 'right'; appUrl: string; fr: boolean }

/**
 * A layout table: no spacing, the reading direction set on it (some clients don't inherit it).
 * `style` is appended to the base style (one style attribute: a second one would be ignored).
 */
const table = (ctx: Ctx, inner: string, attrs = '', style = '') =>
  `<table role="presentation" dir="${ctx.dir}" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0;mso-table-rspace:0${style ? `;${style}` : ''}"${attrs ? ` ${attrs}` : ''}>${inner}</table>`

const text = (ctx: Ctx, value: string) => escapeHtml(ctx.fr ? frenchSpacing(value) : value)

const spacer = (height: number) => `<tr><td height="${height}" style="height:${height}px;line-height:${height}px;font-size:0">&nbsp;</td></tr>`

function poster(ctx: Ctx, tile: DigestTile, width: number, height: number, size: 'w154' | 'w342', radius: number) {
  const src = imageUrl(tile.poster, size)
  const href = escapeHtml(absolute(ctx.appUrl, tile.href))
  const box = `display:block;width:100%;max-width:${width}px;height:auto;border:0;outline:none;text-decoration:none;border-radius:${radius}px`
  if (src) {
    return `<a href="${href}" style="text-decoration:none;display:block"><img src="${escapeHtml(src)}" width="${width}" height="${height}" alt="${escapeHtml(tile.title)}" style="${box};background-color:${SURFACE}"></a>`
  }
  // No picture: the title on a quiet card the poster's size.
  return `<a href="${href}" style="text-decoration:none;display:block">${table(ctx, `<tr><td height="${height}" bgcolor="${SURFACE}" align="center" valign="middle" style="height:${height}px;border-radius:${radius}px;background-color:${SURFACE};padding:8px;font-family:${FONT};font-size:13px;line-height:18px;color:${SECONDARY}" dir="auto">${escapeHtml(shorten(tile.title, 40))}</td></tr>`)}</a>`
}

function sectionTitle(ctx: Ctx, title: string, href?: string, seeAll?: string) {
  const heading = `<td align="${ctx.start}" style="font-family:${FONT};font-size:19px;line-height:25px;font-weight:700;color:${WHITE};text-align:${ctx.start}" dir="${ctx.dir}">${text(ctx, title)}</td>`
  const link = href && seeAll
    ? `<td align="${ctx.end}" valign="bottom" style="font-family:${FONT};font-size:13px;line-height:25px;white-space:nowrap;text-align:${ctx.end}"><a href="${escapeHtml(absolute(ctx.appUrl, href))}" style="color:${SECONDARY};text-decoration:underline">${text(ctx, seeAll)}</a></td>`
    : ''
  return table(ctx, `<tr>${heading}${link}</tr>`)
}

function postersGrid(ctx: Ctx, tiles: DigestTile[]) {
  const cells: string[] = []
  for (let i = 0; i < COLUMNS; i++) {
    const tile = tiles[i]
    const gap = i < COLUMNS - 1 ? `<td width="${GAP}" style="width:${GAP}px;font-size:0;line-height:0">&nbsp;</td>` : ''
    if (!tile) {
      cells.push(`<td width="${POSTER_W}" style="width:${POSTER_W}px">&nbsp;</td>${gap}`)
      continue
    }
    const href = escapeHtml(absolute(ctx.appUrl, tile.href))
    const caption = `<a href="${href}" style="color:${WHITE};text-decoration:none;font-weight:600">${escapeHtml(shorten(tile.title, 38))}</a>`
    const line = tile.line ? `<div style="font-size:13px;line-height:18px;color:${TERTIARY};padding-top:2px">${text(ctx, shorten(tile.line, 40))}</div>` : ''
    cells.push(
      `<td width="${POSTER_W}" valign="top" style="width:${POSTER_W}px;vertical-align:top">`
      + poster(ctx, tile, POSTER_W, Math.round(POSTER_W * 1.5), 'w342', 10)
      + `<div dir="auto" style="font-family:${FONT};font-size:14px;line-height:19px;padding-top:8px;text-align:${ctx.start}">${caption}${line}</div>`
      + `</td>${gap}`,
    )
  }
  return table(ctx, `<tr>${cells.join('')}</tr>`)
}

function rowsList(ctx: Ctx, rows: DigestTile[]) {
  return rows.map((row, index) => {
    const href = escapeHtml(absolute(ctx.appUrl, row.href))
    const thumb = `<td width="64" valign="top" style="width:64px;vertical-align:top">${poster(ctx, row, 56, 84, 'w154', 8)}</td>`
    const body = `<td valign="middle" style="vertical-align:middle;font-family:${FONT};text-align:${ctx.start}">`
      + `<a href="${href}" dir="auto" style="display:block;color:${WHITE};text-decoration:none;font-size:16px;line-height:22px;font-weight:600">${escapeHtml(shorten(row.title, 70))}</a>`
      + (row.line ? `<div style="font-size:14px;line-height:20px;color:${SECONDARY};padding-top:2px">${text(ctx, shorten(row.line, 80))}</div>` : '')
      + '</td>'
    return table(ctx, `<tr>${thumb}<td width="14" style="width:14px;font-size:0">&nbsp;</td>${body}</tr>`) + (index < rows.length - 1 ? table(ctx, spacer(12)) : '')
  }).join('')
}

function noteBlock(ctx: Ctx, section: Extract<DigestSection, { type: 'note' }>, more: string) {
  const link = section.href ? ` <a href="${escapeHtml(absolute(ctx.appUrl, section.href))}" style="color:${WHITE};text-decoration:underline">${text(ctx, more)}</a>` : ''
  return table(ctx, `<tr><td bgcolor="${SURFACE}" style="background-color:${SURFACE};border-radius:16px;padding:16px 18px;font-family:${FONT};font-size:15px;line-height:22px;color:${SECONDARY};text-align:${ctx.start}">${text(ctx, section.text)}${link}</td></tr>`)
}

function sectionBlock(ctx: Ctx, section: EmailSection, t: Translate) {
  if (section.type === 'note') return noteBlock(ctx, section, t('digest.email.seeAll'))
  const body = section.type === 'rows' ? rowsList(ctx, section.rows.slice(0, 3)) : postersGrid(ctx, section.tiles.slice(0, COLUMNS))
  const inner = sectionTitle(ctx, section.title, section.href, t('digest.email.seeAll')) + table(ctx, spacer(14)) + body
  const accent = rgb(section.accent)
  if (!accent) return inner
  // A band lit by the moment's colour.
  const tint = mix(accent, [0, 0, 0], 0.16)
  const edge = mix(accent, [0, 0, 0], 0.32)
  return table(ctx, `<tr><td bgcolor="${tint}" style="background-color:${tint};border:1px solid ${edge};border-radius:22px;padding:20px 18px">${inner}</td></tr>`)
}

function heroBlock(ctx: Ctx, hero: DigestHero) {
  const color = rgb(hero.color)
  const tint = color ? mix(color, [10, 10, 10], 0.2) : SURFACE
  const edge = color ? mix(color, [10, 10, 10], 0.38) : HAIRLINE
  const kickerColor = color ? mix(color, [255, 255, 255], 0.55) : SECONDARY
  const href = escapeHtml(absolute(ctx.appUrl, hero.href))
  const wide = imageUrl(hero.backdrop, 'w780')
  const picture = wide
    ? `<tr><td style="padding:0"><a href="${href}" style="display:block;text-decoration:none"><img src="${escapeHtml(wide)}" width="${INNER}" height="${Math.round(INNER * 9 / 16)}" alt="${escapeHtml(hero.title)}" style="display:block;width:100%;max-width:${INNER}px;height:auto;border:0;border-radius:21px 21px 0 0;background-color:${tint}"></a></td></tr>`
    : ''
  // A pill as wide as its label (no width on this table), the only red in the e-mail.
  const cta = `<table role="presentation" dir="${ctx.dir}" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;mso-table-lspace:0;mso-table-rspace:0">`
    + `<tr><td bgcolor="${RED}" style="background-color:${RED};border-radius:999px;mso-padding-alt:12px 26px"><a href="${href}" style="display:inline-block;padding:12px 26px;font-family:${FONT};font-size:15px;line-height:20px;font-weight:700;color:${WHITE};text-decoration:none;border-radius:999px">${text(ctx, hero.cta)}</a></td></tr></table>`
  const body = `<tr><td style="padding:22px 22px 24px;font-family:${FONT};text-align:${ctx.start}">`
    + `<div style="font-size:14px;line-height:20px;font-weight:600;color:${kickerColor}">${text(ctx, shorten(hero.kicker, 120))}</div>`
    + `<a href="${href}" dir="auto" style="display:block;padding-top:6px;color:${WHITE};text-decoration:none;font-size:27px;line-height:32px;font-weight:800">${escapeHtml(shorten(hero.title, 80))}</a>`
    + (hero.text ? `<div dir="auto" style="padding-top:10px;font-size:15px;line-height:23px;color:${SECONDARY}">${escapeHtml(shorten(hero.text, 220))}</div>` : '')
    + `<div style="padding-top:20px">${cta}</div>`
    + '</td></tr>'
  return table(ctx, `${picture}${body}`, `bgcolor="${tint}"`, `border-collapse:separate;background-color:${tint};border:1px solid ${edge};border-radius:22px`)
}

/** 'Friday 9 October' style date of the edition, in the e-mail's language. */
function editionDate(edition: string, locale: Locale) {
  return new Date(`${edition}T12:00:00Z`).toLocaleDateString(dateLocale(locale) ?? 'en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' })
}

export function renderDigestEmail(input: DigestEmailInput): RenderedDigest {
  const { t, locale } = input
  const rtl = isArabicScript(locale)
  const ctx: Ctx = { rtl, dir: rtl ? 'rtl' : 'ltr', start: rtl ? 'right' : 'left', end: rtl ? 'left' : 'right', appUrl: input.appUrl, fr: String(locale) === 'fr' }
  const lang = htmlLang(locale)
  const date = editionDate(input.edition, locale)
  const subject = ctx.fr ? frenchSpacing(input.subject) : input.subject
  const preheader = ctx.fr ? frenchSpacing(input.preheader) : input.preheader

  const header = table(ctx, `<tr>`
    + `<td align="${ctx.start}" valign="middle" style="text-align:${ctx.start}"><a href="${escapeHtml(input.appUrl)}" style="text-decoration:none"><img src="${escapeHtml(input.appUrl)}/email/wordmark.png" width="152" height="20" alt="TunisiaFlicks" style="display:block;width:152px;height:20px;border:0"></a></td>`
    + `<td align="${ctx.end}" valign="middle" style="font-family:${FONT};font-size:13px;line-height:18px;color:${TERTIARY};text-align:${ctx.end};white-space:nowrap">${text(ctx, t('digest.email.week', { date: isolate(date) }))}</td>`
    + `</tr>`)
  const intro = table(ctx, `<tr><td style="font-family:${FONT};text-align:${ctx.start}">`
    + `<div style="font-size:30px;line-height:35px;font-weight:800;color:${WHITE}">${text(ctx, t('digest.email.title'))}</div>`
    + `<div style="padding-top:6px;font-size:15px;line-height:22px;color:${SECONDARY}">${text(ctx, t('digest.email.for', { name: isolate(input.name) }))}</div>`
    + `</td></tr>`)

  const blocks: string[] = [header, table(ctx, spacer(28)), intro, table(ctx, spacer(24))]
  if (input.hero) blocks.push(heroBlock(ctx, input.hero), table(ctx, spacer(36)))
  for (const section of input.sections) blocks.push(sectionBlock(ctx, section, t), table(ctx, spacer(36)))

  const footerLinks = `<a href="${escapeHtml(input.settingsUrl)}" style="color:${SECONDARY};text-decoration:underline">${text(ctx, t('digest.footer.settings'))}</a>`
    + `<span style="color:${TERTIARY}">&nbsp;&nbsp;&nbsp;</span>`
    + `<a href="${escapeHtml(input.unsubscribeUrl)}" style="color:${SECONDARY};text-decoration:underline">${text(ctx, t('digest.footer.unsubscribe'))}</a>`
  blocks.push(table(ctx, `<tr><td style="border-top:1px solid ${HAIRLINE};padding-top:22px;font-family:${FONT};font-size:13px;line-height:20px;color:${TERTIARY};text-align:${ctx.start}">`
    + `<p style="margin:0 0 8px">${text(ctx, t('digest.footer.why', { name: isolate(input.name) }))}</p>`
    + `<p style="margin:0 0 14px">${text(ctx, t('digest.footer.noPixels'))}</p>`
    + `<p style="margin:0">${footerLinks}</p>`
    + `</td></tr>`))

  // The preheader: the line inboxes show after the subject; padded so the body doesn't leak into it.
  const preheaderHtml = `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${BLACK};opacity:0">${text(ctx, preheader)}${'&#8199;&#847;'.repeat(40)}</div>`

  const html = `<!doctype html>
<html lang="${lang}" dir="${ctx.dir}" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>${escapeHtml(subject)}</title>
</head>
<body dir="${ctx.dir}" bgcolor="${BLACK}" style="margin:0;padding:0;background-color:${BLACK};color:${WHITE};-webkit-text-size-adjust:100%">
${preheaderHtml}
<table role="presentation" dir="${ctx.dir}" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${BLACK}" style="background-color:${BLACK};border-collapse:collapse">
<tr><td align="center" style="padding:28px 0 40px">
<table role="presentation" dir="${ctx.dir}" width="${WIDTH}" cellpadding="0" cellspacing="0" border="0" bgcolor="${BLACK}" style="width:100%;max-width:${WIDTH}px;background-color:${BLACK};border-collapse:collapse">
<tr><td style="padding:0 ${GUTTER}px">
${blocks.join('\n')}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`

  return { subject, preheader, html, text: renderText(input, ctx, date) }
}

function renderText(input: DigestEmailInput, ctx: Ctx, date: string) {
  const { t } = input
  const plain = (value: string) => (ctx.fr ? frenchSpacing(value) : value)
  const lines: string[] = [plain(t('digest.email.title')), plain(t('digest.email.for', { name: isolate(input.name) })), plain(t('digest.email.week', { date: isolate(date) })), '']
  const link = (href: string) => absolute(input.appUrl, href)
  if (input.hero) {
    lines.push(`${input.hero.title}`, plain(input.hero.kicker), link(input.hero.href), '')
  }
  for (const section of input.sections) {
    if (section.type === 'note') {
      lines.push(plain(section.text), ...(section.href ? [link(section.href)] : []), '')
      continue
    }
    lines.push(plain(section.title), '-'.repeat(Math.min(40, section.title.length)))
    const tiles = section.type === 'rows' ? section.rows.slice(0, 3) : section.tiles.slice(0, COLUMNS)
    for (const tile of tiles) {
      lines.push(`- ${tile.title}${tile.line ? `: ${plain(tile.line)}` : ''}`, `  ${link(tile.href)}`)
    }
    lines.push('')
  }
  lines.push('--', plain(t('digest.footer.why', { name: isolate(input.name) })), plain(t('digest.footer.noPixels')), '',
    `${plain(t('digest.footer.settings'))}: ${input.settingsUrl}`, `${plain(t('digest.footer.unsubscribe'))}: ${input.unsubscribeUrl}`)
  return lines.join('\n')
}
