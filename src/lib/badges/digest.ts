// The weekly e-mail's badge line: 'New badges this week: Marathon (Silver), World cinema (Bronze).'
// Only levels reached during the week the e-mail covers; never streaks (an inbox is no place for
// pressure), never anything on a profile with badges turned off. Registered by integration in
// src/lib/digest/providers.ts.
import 'server-only'
import type { DigestProvider } from '@/src/lib/digest/providers'
import { htmlLang } from '@/src/lib/i18n/locales'
import { BADGES } from './catalogue'
import { badgeLabel } from './announce'
import { applicableIds, loadProfileInfo } from './compute'
import { badgesDb } from './db'

const MAX_LISTED = 4

export const badgesDigestProvider: DigestProvider = {
  id: 'badges',
  async build(ctx) {
    const { badges } = await badgesDb()
    const doc = await badges.findOne({ _id: ctx.profileId, userId: ctx.userId }, { projection: { earned: 1, disabled: 1 } })
    if (!doc || doc.disabled) return null
    const info = await loadProfileInfo({ userId: ctx.userId, profileId: ctx.profileId })
    if (!info) return null
    const allowed = applicableIds(info.kids)
    const since = ctx.since.getTime()
    const until = ctx.until.getTime()
    const fresh = BADGES
      .filter((badge) => badge.id !== 'streakWeeks' && allowed.has(badge.id))
      .map((badge) => ({ badge, earned: doc.earned?.[badge.id] }))
      .filter(({ earned }) => {
        const at = earned?.levelAt ? new Date(earned.levelAt).getTime() : NaN
        return !!earned && earned.level > 0 && at >= since && at < until
      })
      .sort((a, b) => new Date(b.earned!.levelAt).getTime() - new Date(a.earned!.levelAt).getTime())
      .slice(0, MAX_LISTED)
    if (fresh.length === 0) return null
    const list = new Intl.ListFormat(htmlLang(ctx.locale), { style: 'long', type: 'conjunction' })
      .format(fresh.map(({ badge, earned }) => badgeLabel(ctx.t, badge.id, earned!.level)))
    return { type: 'note', id: 'badges', text: ctx.t('badges.digest.note', { list }), href: '/me#badges' }
  },
}
