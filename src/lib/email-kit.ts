// The account e-mails' layout (confirming an address, resetting a password, release alerts): the
// same look as the site and the weekly digest. True black, the white wordmark, one card lit faintly
// by the logo's red with the red "A" on it, a big title, white text at the site's strengths, and the
// red pill (the only red that isn't the logo). Pure (no database, no network), so the tests render it.
//
// Built the way e-mail clients still need it (see lib/digest/template): 600px, table layout, inline
// styles, bgcolor attributes, system fonts, no tracking. Arabic and Derja run right to left; names
// and titles inside sentences are isolated so mixed scripts keep their place.
import { absolute, escapeHtml, frenchSpacing, imageUrl, isolate } from '@/src/lib/digest/template'
import { dateLocale, htmlLang, isArabicScript, type Locale } from '@/src/lib/i18n/locales'
import type { Translate } from '@/src/lib/i18n/translate'
import { BLACK, BRAND_RGB, FONT, RED, SECONDARY, SURFACE, TERTIARY, WHITE, mix } from '@/src/lib/email-palette'

const WIDTH = 600
const GUTTER = 24
/** The red "A" on the card (public/email/mark.png, made by scripts/email-assets.mjs at twice this). */
const MARK = { width: 44, height: 39 }
/** The card: black lit by the logo's red, the way the site's pages glow. */
const CARD = mix(BRAND_RGB, [10, 10, 10], 0.035)
const CARD_EDGE = mix(BRAND_RGB, [24, 24, 24], 0.1)
const KICKER = mix(BRAND_RGB, [255, 255, 255], 0.62)
/** A title's "what's new" line: white/85, flattened on the card. */
const LINE = '#d9d9d9'

export type MailCtx = { locale: Locale, t: Translate, appUrl: string, rtl: boolean, dir: 'rtl' | 'ltr', start: 'left' | 'right', end: 'left' | 'right', fr: boolean }

export function mailContext(locale: Locale, t: Translate, appUrl: string): MailCtx {
  const rtl = isArabicScript(locale)
  return { locale, t, appUrl: appUrl.replace(/\/+$/, ''), rtl, dir: rtl ? 'rtl' : 'ltr', start: rtl ? 'right' : 'left', end: rtl ? 'left' : 'right', fr: String(locale) === 'fr' }
}

/** Text for the e-mail: escaped, with French spacing in French. */
export const say = (ctx: MailCtx, value: string) => escapeHtml(ctx.fr ? frenchSpacing(value) : value)
/** The same for the plain-text part. */
export const plain = (ctx: MailCtx, value: string) => (ctx.fr ? frenchSpacing(value) : value)

/** '13 October 2026' in the e-mail's language (null for no or a bad date). */
export function mailDate(ctx: MailCtx, date?: string | null): string | null {
  if (!date || !/^\d{4}-\d{2}-\d{2}/.test(date)) return null
  return new Date(`${date.slice(0, 10)}T12:00:00Z`).toLocaleDateString(dateLocale(ctx.locale) ?? 'en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
}

/** A layout table (no spacing, the reading direction on it: some clients don't inherit it). */
export const table = (ctx: MailCtx, inner: string, attrs = '', style = '') =>
  `<table role="presentation" dir="${ctx.dir}" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0;mso-table-rspace:0${style ? `;${style}` : ''}"${attrs ? ` ${attrs}` : ''}>${inner}</table>`

export const spacer = (height: number) => `<tr><td height="${height}" style="height:${height}px;line-height:${height}px;font-size:0">&nbsp;</td></tr>`

/** The red pill, as wide as its label. `quiet`: white on a dark pill instead (secondary actions). */
export function pill(ctx: MailCtx, label: string, href: string, { quiet = false, small = false } = {}) {
  const bg = quiet ? '#1f1f1f' : RED
  const pad = small ? '8px 16px' : '13px 28px'
  const size = small ? '13px' : '15px'
  return `<table role="presentation" dir="${ctx.dir}" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;mso-table-lspace:0;mso-table-rspace:0">`
    + `<tr><td bgcolor="${bg}" style="background-color:${bg};border-radius:999px;mso-padding-alt:${pad}">`
    + `<a href="${escapeHtml(absolute(ctx.appUrl, href))}" style="display:inline-block;padding:${pad};font-family:${FONT};font-size:${size};line-height:20px;font-weight:700;color:${WHITE};text-decoration:none;border-radius:999px">${say(ctx, label)}</a>`
    + '</td></tr></table>'
}

// ---- titles (release alerts) ---------------------------------------------------------------------

export type MailTitle = {
  title: string
  href: string
  /** TMDB poster path or https URL. */
  poster?: string | null
  /** What's new, e.g. 'New episode · S02E05 · The Return'. */
  line: string
  /** When, e.g. 'Aired 12 October 2026'. */
  when?: string | null
}

function posterCell(ctx: MailCtx, item: MailTitle, width: number, height: number) {
  const href = escapeHtml(absolute(ctx.appUrl, item.href))
  const src = imageUrl(item.poster, 'w342')
  if (src) {
    return `<a href="${href}" style="display:block;text-decoration:none"><img src="${escapeHtml(src)}" width="${width}" height="${height}" alt="${escapeHtml(item.title)}" style="display:block;width:${width}px;height:${height}px;border:0;border-radius:10px;background-color:${SURFACE}"></a>`
  }
  // No poster: a quiet card with the title, the poster's size.
  return `<a href="${href}" style="display:block;text-decoration:none">${table(ctx, `<tr><td width="${width}" height="${height}" bgcolor="#161616" align="center" valign="middle" style="width:${width}px;height:${height}px;border-radius:10px;background-color:#161616;padding:6px;font-family:${FONT};font-size:12px;line-height:16px;color:${SECONDARY}" dir="auto">${escapeHtml(item.title.slice(0, 40))}</td></tr>`, '', `width:${width}px`)}</a>`
}

/** Titles as rows: the poster, the title, what's new and when, and a small 'Watch' pill (left out
 *  when `watch` is null: one title, whose red button below says it already). */
export function titleRows(ctx: MailCtx, items: MailTitle[], watch: string | null) {
  return items.map((item, index) => {
    const href = escapeHtml(absolute(ctx.appUrl, item.href))
    const body = `<td valign="middle" style="vertical-align:middle;font-family:${FONT};text-align:${ctx.start}">`
      + `<a href="${href}" dir="auto" style="display:block;color:${WHITE};text-decoration:none;font-size:18px;line-height:24px;font-weight:700">${escapeHtml(item.title)}</a>`
      + `<div style="padding-top:4px;font-size:14px;line-height:20px;font-weight:600;color:${LINE}">${say(ctx, item.line)}</div>`
      + (item.when ? `<div style="padding-top:2px;font-size:13px;line-height:18px;color:${TERTIARY}">${say(ctx, item.when)}</div>` : '')
      + (watch ? `<div style="padding-top:12px">${pill(ctx, watch, item.href, { quiet: true, small: true })}</div>` : '')
      + '</td>'
    const row = table(ctx, `<tr><td width="76" valign="top" style="width:76px;vertical-align:top">${posterCell(ctx, item, 76, 114)}</td><td width="16" style="width:16px;font-size:0">&nbsp;</td>${body}</tr>`)
    const rule = index < items.length - 1 ? table(ctx, `${spacer(16)}<tr><td style="border-top:1px solid ${CARD_EDGE};font-size:0;line-height:0">&nbsp;</td></tr>${spacer(16)}`) : ''
    return row + rule
  }).join('')
}

// ---- the whole e-mail ----------------------------------------------------------------------------

export type AccountEmail = {
  ctx: MailCtx
  subject: string
  /** The line inboxes show after the subject. */
  preheader: string
  /** The small line above the title. */
  kicker: string
  title: string
  paragraphs: string[]
  /** Extra HTML inside the card, after the paragraphs (e.g. titleRows). */
  body?: string
  /** Its plain-text version. */
  bodyText?: string[]
  cta?: { label: string, href: string }
  /** Show the CTA's address under it too (links people may have to paste: confirm, reset). */
  showLink?: boolean
  /** Small print in the card, under the CTA. */
  notes?: string[]
  footer: { why: string, links: { label: string, href: string }[] }
}

export type RenderedMail = { subject: string, html: string, text: string }

export function renderAccountEmail(mail: AccountEmail): RenderedMail {
  const { ctx } = mail
  const subject = plain(ctx, mail.subject)
  const ctaHref = mail.cta ? absolute(ctx.appUrl, mail.cta.href) : null

  const header = table(ctx, '<tr>'
    + `<td align="${ctx.start}" valign="middle" style="padding:0 6px;text-align:${ctx.start}"><a href="${escapeHtml(ctx.appUrl)}" style="text-decoration:none"><img src="${escapeHtml(ctx.appUrl)}/email/wordmark.png" width="152" height="20" alt="TunisiaFlicks" style="display:block;width:152px;height:20px;border:0"></a></td>`
    + '</tr>')

  const card: string[] = [
    `<img src="${escapeHtml(ctx.appUrl)}/email/mark.png" width="${MARK.width}" height="${MARK.height}" alt="" style="display:block;width:${MARK.width}px;height:${MARK.height}px;border:0">`,
    `<div style="padding-top:22px;font-size:14px;line-height:20px;font-weight:600;color:${KICKER}">${say(ctx, mail.kicker)}</div>`,
    `<div style="padding-top:6px;font-size:30px;line-height:36px;font-weight:800;color:${WHITE}">${say(ctx, mail.title)}</div>`,
    ...mail.paragraphs.map((paragraph) => `<div style="padding-top:14px;font-size:16px;line-height:25px;color:${SECONDARY}">${say(ctx, paragraph)}</div>`),
  ]
  if (mail.body) card.push(`<div style="padding-top:24px">${mail.body}</div>`)
  if (mail.cta) card.push(`<div style="padding-top:28px">${pill(ctx, mail.cta.label, mail.cta.href)}</div>`)
  if (mail.showLink && ctaHref) {
    card.push(`<div style="padding-top:22px;font-size:13px;line-height:19px;color:${TERTIARY}">${say(ctx, ctx.t('mail.linkFallback'))}</div>`
      + `<div dir="ltr" style="padding-top:4px;font-size:13px;line-height:19px;word-break:break-all;text-align:${ctx.start}"><a href="${escapeHtml(ctaHref)}" style="color:${SECONDARY};text-decoration:underline">${escapeHtml(ctaHref)}</a></div>`)
  }
  if (mail.notes?.length) {
    card.push(`<div style="margin-top:24px;padding-top:18px;border-top:1px solid ${CARD_EDGE}">`
      + mail.notes.map((note, i) => `<div style="${i ? 'padding-top:6px;' : ''}font-size:13px;line-height:19px;color:${TERTIARY}">${say(ctx, note)}</div>`).join('')
      + '</div>')
  }
  const cardHtml = table(ctx, `<tr><td bgcolor="${CARD}" style="background-color:${CARD};border:1px solid ${CARD_EDGE};border-radius:24px;padding:34px 30px 32px;font-family:${FONT};text-align:${ctx.start}">${card.join('')}</td></tr>`, `bgcolor="${CARD}"`, 'border-collapse:separate')

  const year = new Date().getUTCFullYear()
  const links = mail.footer.links
    .map((link) => `<a href="${escapeHtml(absolute(ctx.appUrl, link.href))}" style="color:${SECONDARY};text-decoration:underline">${say(ctx, link.label)}</a>`)
    .join(`<span style="color:${TERTIARY}">&nbsp;&nbsp;·&nbsp;&nbsp;</span>`)
  const footer = table(ctx, `<tr><td style="padding:0 6px;font-family:${FONT};font-size:13px;line-height:20px;color:${TERTIARY};text-align:${ctx.start}">`
    + `<p style="margin:0 0 10px">${say(ctx, mail.footer.why)}</p>`
    + `<p style="margin:0 0 10px">${links}</p>`
    + `<p style="margin:0">${say(ctx, ctx.t('mail.footer.rights', { year }))}</p>`
    + '</td></tr>')

  const preheader = `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${BLACK};opacity:0">${say(ctx, mail.preheader)}${'&#8199;&#847;'.repeat(40)}</div>`

  const html = `<!doctype html>
<html lang="${htmlLang(ctx.locale)}" dir="${ctx.dir}" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>${escapeHtml(subject)}</title>
</head>
<body dir="${ctx.dir}" bgcolor="${BLACK}" style="margin:0;padding:0;background-color:${BLACK};color:${WHITE};-webkit-text-size-adjust:100%">
${preheader}
<table role="presentation" dir="${ctx.dir}" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${BLACK}" style="background-color:${BLACK};border-collapse:collapse">
<tr><td align="center" style="padding:28px 0 40px">
<table role="presentation" dir="${ctx.dir}" width="${WIDTH}" cellpadding="0" cellspacing="0" border="0" bgcolor="${BLACK}" style="width:100%;max-width:${WIDTH}px;background-color:${BLACK};border-collapse:collapse">
<tr><td style="padding:0 ${GUTTER}px">
${header}
${table(ctx, spacer(26))}
${cardHtml}
${table(ctx, spacer(28))}
${footer}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`

  const text = [
    plain(ctx, mail.title),
    '',
    ...mail.paragraphs.map((paragraph) => plain(ctx, paragraph)),
    ...(mail.bodyText?.length ? ['', ...mail.bodyText] : []),
    ...(mail.cta && ctaHref ? ['', `${plain(ctx, mail.cta.label)}: ${ctaHref}`] : []),
    ...(mail.notes?.length ? ['', ...mail.notes.map((note) => plain(ctx, note))] : []),
    '',
    '--',
    plain(ctx, mail.footer.why),
    ...mail.footer.links.map((link) => `${plain(ctx, link.label)}: ${absolute(ctx.appUrl, link.href)}`),
  ].join('\n')

  return { subject, html, text }
}

export { isolate }
