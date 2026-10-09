// One profile's digest, from the shared snapshot to the rendered e-mail and its headers. Used by
// the weekly run, the settings preview and "Send it to me".
import { createTranslator, type Locale } from '@/src/lib/i18n'
import { emailConfigured, requireEmailEnv, reserveDailySlot, reserveMail } from '@/src/lib/email'
import type { Profile } from '@/src/lib/models/Profile'
import { tunisDate } from '@/src/lib/hijri'
import { digestCollections } from '@/src/lib/digest/db'
import { buildPersonal, buildSharedSnapshot } from '@/src/lib/digest/content'
import { composeDigest, type ComposedDigest, type SharedSnapshot } from '@/src/lib/digest/compose'
import { providerSections } from '@/src/lib/digest/providers'
import { DIGEST_PROVIDERS } from '@/src/lib/digest/registry'
import { editionFor, editionWeek, isOpen, nextEdition, type Edition } from '@/src/lib/digest/schedule'
import { renderDigestEmail, type RenderedDigest } from '@/src/lib/digest/template'
import { emailTokensConfigured, oneClickUrl, unsubscribePageUrl, unsubscribeToken } from '@/src/lib/digest/token'

const positiveInt = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

/** At most this many digests a day (DIGEST_DAILY_LIMIT, default 250), inside the shared mail budget. */
export const digestDailyLimit = () => positiveInt(process.env.DIGEST_DAILY_LIMIT, 250)

/** Mail works, links can be signed, and the digest isn't switched off (DIGEST_ENABLED=false). */
export const digestConfigured = () => emailTokensConfigured() && emailConfigured() && process.env.DIGEST_ENABLED !== 'false'

/** The site's address, without a trailing slash. */
export const siteUrl = () => (process.env.NEXT_PUBLIC_APP_URL || 'https://tunisiaflicks.vercel.app').replace(/\/+$/, '')

/** One slot of the digest's daily allowance and one of the shared bulk budget; false when either is spent. */
export async function reserveDigestSend(): Promise<boolean> {
  if (!(await reserveDailySlot('digest', digestDailyLimit()))) return false
  return reserveMail('bulk')
}

/** The headers that let inboxes offer "Unsubscribe" (one click, RFC 8058) and file it as a newsletter. */
export function digestHeaders(appUrl: string, token: string): Record<string, string> {
  const host = (() => {
    try {
      return new URL(appUrl).hostname
    } catch {
      return 'tunisiaflicks.app'
    }
  })()
  return {
    'List-Unsubscribe': `<${oneClickUrl(appUrl, token)}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    'List-Id': `TunisiaFlicks weekly digest <weekly-digest.${host}>`,
    Precedence: 'bulk',
    'Auto-Submitted': 'auto-generated',
    'X-Auto-Response-Suppress': 'OOF, AutoReply',
  }
}

export type DigestMessage = { to: string; subject: string; text: string; html: string; headers: Record<string, string> }

export type BuiltDigest = { composed: ComposedDigest; rendered: RenderedDigest; message: DigestMessage | null }

/** A profile's digest for `edition`, on top of `shared`. `message` is null without a signed unsubscribe link. */
export async function buildDigest({ userId, profile, email, locale, edition, week, shared }: {
  userId: string
  profile: Profile
  email: string
  locale: Locale
  edition: Edition
  /** The week it covers (defaults to the edition's). */
  week?: { since: Date; until: Date }
  shared: SharedSnapshot
}): Promise<BuiltDigest> {
  const t = createTranslator(locale)
  const { since, until } = week ?? editionWeek(edition)
  const [personal, extra] = await Promise.all([
    buildPersonal({ userId, profile, locale, t, since, until, seed: edition.id }),
    providerSections({ userId, profileId: profile.id, locale, since, until, t }, DIGEST_PROVIDERS),
  ])
  const composed = composeDigest({ t, name: profile.name, shared, personal, extra })
  const appUrl = siteUrl()
  const token = unsubscribeToken(profile.id)
  const settingsUrl = `${appUrl}/profile#email`
  const rendered = renderDigestEmail({
    locale,
    t,
    appUrl,
    name: profile.name,
    edition: edition.id,
    subject: composed.subject,
    preheader: composed.preheader,
    hero: composed.hero,
    sections: composed.sections,
    unsubscribeUrl: token ? unsubscribePageUrl(appUrl, token) : settingsUrl,
    settingsUrl,
  })
  const message = token
    ? { to: email, subject: rendered.subject, text: rendered.text, html: rendered.html, headers: digestHeaders(appUrl, token) }
    : null
  return { composed, rendered, message }
}

// ---- The shared snapshot ---------------------------------------------------------------------

/**
 * The edition's snapshot for a language: stored on the edition the first time someone needs it
 * (the run builds them up front; a language turned on later is built on demand).
 */
export async function editionSnapshot(edition: Edition, locale: Locale): Promise<SharedSnapshot> {
  const { editions } = await digestCollections()
  const doc = await editions.findOne({ _id: edition.id }, { projection: { [`shared.${locale}`]: 1 } })
  const stored = doc?.shared?.[locale]
  if (stored) return stored
  const built = await buildSharedSnapshot(locale, createTranslator(locale), { ...editionWeek(edition), day: edition.id })
  await editions.updateOne({ _id: edition.id, [`shared.${locale}`]: { $exists: false } }, { $set: { [`shared.${locale}`]: { ...built, built_at: new Date() } } })
  return built
}

const previewCache = new Map<string, { at: number; snapshot: Promise<SharedSnapshot> }>()
const PREVIEW_TTL_MS = 30 * 60 * 1000

/**
 * What a digest would hold if it went out now: this week's edition while it's open, otherwise
 * the next one built from the last seven days (cached half an hour per language).
 */
export async function previewMaterial(locale: Locale, now: Date = new Date()): Promise<{ edition: Edition; week: { since: Date; until: Date }; shared: SharedSnapshot }> {
  const current = editionFor(now)
  if (isOpen(current, now)) return { edition: current, week: editionWeek(current), shared: await editionSnapshot(current, locale) }
  const upcoming = nextEdition(now)
  const week = { since: new Date(now.getTime() - 7 * 86400000), until: now }
  const day = tunisDate(now)
  const key = `${day}:${locale}`
  let cached = previewCache.get(key)
  if (!cached || Date.now() - cached.at > PREVIEW_TTL_MS) {
    cached = { at: Date.now(), snapshot: buildSharedSnapshot(locale, createTranslator(locale), { ...week, day }) }
    previewCache.set(key, cached)
    cached.snapshot.catch(() => previewCache.delete(key))
  }
  return { edition: upcoming, week, shared: await cached.snapshot }
}

/** From address and the like, checked before a send (throws when mail isn't set up). */
export const mailFrom = () => requireEmailEnv().from
