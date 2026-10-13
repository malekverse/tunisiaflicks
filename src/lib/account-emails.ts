// The account e-mails' content, in the viewer's language, on the shared layout (lib/email-kit).
// Pure: lib/email sends them, the tests render them.
import { createTranslator } from '@/src/lib/i18n'
import { isLocale, type Locale } from '@/src/lib/i18n/locales'
import { escapeHtml } from '@/src/lib/digest/template'
import { FONT, SECONDARY, TERTIARY, WHITE } from '@/src/lib/email-palette'
import { isolate, mailContext, mailDate, plain, renderAccountEmail, table, titleRows, type MailTitle, type RenderedMail } from '@/src/lib/email-kit'

const localeOf = (locale: unknown): Locale => (isLocale(locale) ? locale : 'en')
/** Isolates a title or date inside a right-to-left sentence; left-to-right text needs nothing (and
 *  subject lines stay free of invisible marks some inboxes show as boxes). */
const iso = (rtl: boolean, value: string) => (rtl ? isolate(value) : value)

const accountFooter = (t: ReturnType<typeof createTranslator>) => ({
  why: t('mail.footer.why'),
  links: [{ label: t('mail.footer.help'), href: '/contact' }, { label: t('mail.footer.settings'), href: '/profile#notifications' }],
})

/** "Confirm your e-mail" (sign-up, or "send it again"). */
export function verificationEmail({ locale, appUrl, token }: { locale?: unknown, appUrl: string, token: string }): RenderedMail {
  const t = createTranslator(localeOf(locale))
  const ctx = mailContext(localeOf(locale), t, appUrl)
  return renderAccountEmail({
    ctx,
    subject: t('mail.verify.subject'),
    preheader: t('mail.verify.preheader'),
    kicker: t('mail.verify.kicker'),
    title: t('mail.verify.title'),
    paragraphs: [t('mail.verify.text')],
    cta: { label: t('mail.verify.cta'), href: `/auth/verify-email?token=${encodeURIComponent(token)}` },
    showLink: true,
    notes: [t('mail.verify.expiry'), t('mail.verify.ignore')],
    footer: accountFooter(t),
  })
}

/** "Choose a new password" (forgot password). */
export function passwordResetEmail({ locale, appUrl, token }: { locale?: unknown, appUrl: string, token: string }): RenderedMail {
  const t = createTranslator(localeOf(locale))
  const ctx = mailContext(localeOf(locale), t, appUrl)
  return renderAccountEmail({
    ctx,
    subject: t('mail.reset.subject'),
    preheader: t('mail.reset.preheader'),
    kicker: t('mail.reset.kicker'),
    title: t('mail.reset.title'),
    paragraphs: [t('mail.reset.text')],
    cta: { label: t('mail.reset.cta'), href: `/auth/reset-password?token=${encodeURIComponent(token)}` },
    showLink: true,
    notes: [t('mail.reset.expiry'), t('mail.reset.ignore')],
    footer: accountFooter(t),
  })
}

/** What happened to a followed title: a film came out, or a new episode aired. */
export type ReleaseEvent =
  | { kind: 'movie', date?: string | null }
  | { kind: 'episode', code?: string | null, name?: string | null, date?: string | null }

export type ReleaseAlert = {
  media_type: 'movie' | 'tv'
  tmdbId: string
  title: string
  poster_path?: string | null
  event: ReleaseEvent
}

/** One e-mail with every followed title that has something new since the last run. */
export function releaseAlertsEmail({ locale, appUrl, alerts }: { locale?: unknown, appUrl: string, alerts: ReleaseAlert[] }): RenderedMail {
  const t = createTranslator(localeOf(locale))
  const ctx = mailContext(localeOf(locale), t, appUrl)
  const single = alerts.length === 1
  const first = alerts[0]
  const subject = single
    ? t(first.event.kind === 'movie' ? 'mail.alerts.subjectMovie' : 'mail.alerts.subjectEpisode', { title: iso(ctx.rtl, first.title) })
    : t('mail.alerts.subjectMany', { count: alerts.length })

  const items: MailTitle[] = alerts.map((alert) => {
    const event = alert.event
    const date = mailDate(ctx, event.date)
    const line = event.kind === 'movie'
      ? t('mail.alerts.outNow')
      : [t('mail.alerts.newEpisode'), event.code, event.name].filter(Boolean).join(' · ')
    return {
      title: alert.title,
      href: `/${alert.media_type}/${encodeURIComponent(alert.tmdbId)}`,
      poster: alert.poster_path,
      line,
      when: date ? t(event.kind === 'movie' ? 'mail.alerts.released' : 'mail.alerts.aired', { date: iso(ctx.rtl, date) }) : null,
    }
  })

  return renderAccountEmail({
    ctx,
    subject,
    preheader: t('mail.alerts.preheader'),
    kicker: t('mail.alerts.kicker'),
    title: single ? t('mail.alerts.titleOne') : t('mail.alerts.titleMany', { count: alerts.length }),
    paragraphs: [single ? t('mail.alerts.introOne') : t('mail.alerts.introMany')],
    body: titleRows(ctx, items, single ? null : t('mail.alerts.watch')),
    bodyText: items.map((item) => `- ${item.title}: ${plain(ctx, item.line)}${item.when ? ` (${plain(ctx, item.when)})` : ''}\n  ${appUrl.replace(/\/+$/, '')}${item.href}`),
    cta: single ? { label: t('mail.alerts.watch'), href: items[0].href } : { label: t('mail.alerts.open'), href: '/' },
    footer: { why: t('mail.alerts.why'), links: [{ label: t('mail.alerts.manage'), href: '/profile#following' }, { label: t('mail.footer.settings'), href: '/profile#notifications' }] },
  })
}

export type ContactMessage = {
  kind: 'contact' | 'dmca'
  name: string
  email: string
  topic?: string
  message: string
  work?: string
  urls?: string
  signature?: string
}

/** A contact-form or DMCA message, for the site owner (always English). */
export function contactEmail({ appUrl, msg }: { appUrl: string, msg: ContactMessage }): RenderedMail {
  const t = createTranslator('en')
  const ctx = mailContext('en', t, appUrl)
  const isDmca = msg.kind === 'dmca'
  const rows: [string, string | undefined][] = [
    ['From', `${msg.name} <${msg.email}>`],
    ['Topic', msg.topic],
    ['Copyrighted work', msg.work],
    ['Reported URLs', msg.urls],
    ['Signature', msg.signature],
  ]
  const present = rows.filter((row): row is [string, string] => !!row[1])
  const details = table(ctx, present.map(([label, value]) =>
    `<tr><td valign="top" style="padding:6px 14px 6px 0;font-family:${FONT};font-size:13px;line-height:19px;color:${TERTIARY};white-space:nowrap;vertical-align:top">${label}</td>`
    + `<td style="padding:6px 0;font-family:${FONT};font-size:14px;line-height:20px;color:${WHITE};white-space:pre-wrap;word-break:break-word">${escapeHtml(value)}</td></tr>`).join(''))
  const message = table(ctx, `<tr><td bgcolor="#141414" style="background-color:#141414;border-radius:16px;padding:18px 20px;font-family:${FONT};font-size:15px;line-height:23px;color:${SECONDARY};white-space:pre-wrap;word-break:break-word" dir="auto">${escapeHtml(msg.message)}</td></tr>`, '', 'border-collapse:separate')
  const rendered = renderAccountEmail({
    ctx,
    subject: isDmca ? `[DMCA] Copyright notice from ${msg.name}` : `[Contact${msg.topic ? `: ${msg.topic}` : ''}] Message from ${msg.name}`,
    preheader: msg.message.slice(0, 120),
    kicker: isDmca ? 'Copyright notice' : 'Contact form',
    title: isDmca ? 'Copyright (DMCA) notice' : 'New message',
    paragraphs: ['Reply to this e-mail to answer them.'],
    body: `${details}<div style="height:16px;line-height:16px;font-size:0">&nbsp;</div>${message}`,
    footer: { why: 'Sent from the TunisiaFlicks contact page.', links: [{ label: 'Open TunisiaFlicks', href: '/' }] },
  })
  return { ...rendered, text: `${present.map(([label, value]) => `${label}: ${value}`).join('\n')}\n\n${msg.message}` }
}
