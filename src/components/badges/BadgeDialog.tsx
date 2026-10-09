"use client"
// One badge, up close: the 160px medallion, what it measures, its four levels, how far the next
// one is, and when it was earned. The first time a new level is opened the medallion pops in with
// a glow of its metal (just a fade with less motion); after that it simply sits there.
import { Lock } from 'lucide-react'
import { m, useReducedMotion } from 'framer-motion'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/src/components/ui/dialog'
import { useI18n } from '@/src/components/I18nProvider'
import { formatDate } from '@/src/lib/i18n/format'
import { richT } from '@/src/lib/i18n/rich'
import type { TKey } from '@/src/lib/i18n'
import { TIERS, TIER_RGB, badgeDef, tierOf } from '@/src/lib/badges/catalogue'
import type { BadgeCard } from '@/src/lib/badges/present'
import { spring } from '@/src/lib/motion'
import { cn } from '@/src/lib/utils'
import BadgeArt from './BadgeArt'

const metal = (tier: string | null | undefined, alpha = 1) => (tier ? `rgb(${TIER_RGB[tier as keyof typeof TIER_RGB]} / ${alpha})` : undefined)

export function BadgeProgress({ card, name, className }: { card: BadgeCard; name: string; className?: string }) {
  const { t } = useI18n()
  const next = card.next
  if (!next) return null
  const value = Math.min(card.value ?? 0, next.target)
  const percent = Math.round((value / next.target) * 100)
  const nextTier = tierOf(next.level)
  return (
    <div className={className}>
      <div
        role="progressbar"
        aria-label={`${name}: ${t('badges.nextTier', { tier: nextTier ? t(`badges.tier.${nextTier}` as TKey) : '' })}`}
        aria-valuemin={0}
        aria-valuemax={next.target}
        aria-valuenow={value}
        aria-valuetext={t('badges.progress', { value, target: next.target })}
        className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]"
      >
        <span className="block h-full rounded-full" style={{ width: `${Math.max(percent, value > 0 ? 4 : 0)}%`, background: metal(nextTier) }} />
      </div>
    </div>
  )
}

export default function BadgeDialog({ card, open, onOpenChange, celebrate }: {
  card: BadgeCard | null
  open: boolean
  onOpenChange: (open: boolean) => void
  /** First view of a new level: the pop and the glow. */
  celebrate: boolean
}) {
  const { t, locale } = useI18n()
  const reduce = useReducedMotion()
  if (!card) return null
  const def = badgeDef(card.id)
  const name = t(`badges.name.${card.id}` as TKey)
  const tier = card.tier
  const earned = card.level > 0
  const nextTier = card.next ? tierOf(card.next.level) : null
  const date = (iso?: string) => (iso ? formatDate(iso, locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Tunis' }) : '')
  const progressFraction = card.next ? Math.min(1, (card.value ?? 0) / card.next.target) : 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-[400px] gap-0 overflow-y-auto px-6 pb-7 pt-9 text-center sm:px-8">
        <div className="relative mx-auto grid h-[160px] w-[160px] place-items-center">
          {earned && celebrate && (
            <m.span
              aria-hidden
              className="absolute inset-0 rounded-full"
              style={{ boxShadow: `0 0 56px 10px ${metal(tier, 0.42)}` }}
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0.35] }}
              transition={{ duration: 1.4, times: [0, 0.35, 1], ease: 'easeOut' }}
            />
          )}
          {earned && !celebrate && (
            <span aria-hidden className="absolute inset-2 rounded-full" style={{ boxShadow: `0 0 44px 4px ${metal(tier, 0.16)}` }} />
          )}
          <m.span
            className="relative"
            initial={celebrate && earned ? (reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }) : false}
            animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1 }}
            transition={reduce ? { duration: 0.3 } : spring.pop}
          >
            <BadgeArt id={card.id} level={earned ? card.level : 0} size={160} progress={earned ? undefined : progressFraction} arcTier={nextTier} />
          </m.span>
        </div>

        <DialogTitle dir="auto" className="mt-6 font-display text-[28px] font-extrabold leading-[1.05] tracking-normal text-white">{name}</DialogTitle>
        {earned && def.thresholds && tier && (
          <p className="mt-1.5 text-[15px] font-semibold" style={{ color: metal(tier) }}>{t(`badges.tier.${tier}` as TKey)}</p>
        )}
        <DialogDescription className="mx-auto mt-3 max-w-[32ch] text-[15px] leading-relaxed text-white/70">
          {t(`badges.desc.${card.id}` as TKey)}
        </DialogDescription>

        {def.thresholds && (
          <ol aria-label={t('badges.levels')} className="mx-auto mt-6 grid max-w-[280px] grid-cols-4 gap-2">
            {TIERS.map((step, index) => {
              const reached = card.level >= index + 1
              const tierName = t(`badges.tier.${step}` as TKey)
              return (
                <li key={step} className="flex flex-col items-center gap-1.5">
                  <span
                    aria-hidden
                    className={cn('h-3 w-3 rounded-full', !reached && 'ring-1 ring-inset ring-white/20')}
                    style={reached ? { background: metal(step), boxShadow: `0 0 10px ${metal(step, 0.45)}` } : undefined}
                  />
                  <span className={cn('text-[13px] tabular-nums', reached ? 'text-white/85' : 'text-white/50')}>
                    <span className="sr-only">{t(reached ? 'badges.levelReached' : 'badges.levelLocked', { tier: tierName })}: </span>
                    <bdi>{def.thresholds![index]}</bdi>
                  </span>
                </li>
              )
            })}
          </ol>
        )}

        {card.next ? (
          <div className="mx-auto mt-6 max-w-[300px] text-start">
            <div className="flex items-baseline justify-between gap-3 text-[13px]">
              <span className="text-white/60">{nextTier ? t('badges.nextTier', { tier: t(`badges.tier.${nextTier}` as TKey) }) : null}</span>
              <span className="tabular-nums text-white/70">{richT(t, 'badges.progress', { value: Math.min(card.value ?? 0, card.next.target), target: card.next.target })}</span>
            </div>
            <BadgeProgress card={card} name={name} className="mt-2" />
          </div>
        ) : earned && def.thresholds ? (
          <p className="mx-auto mt-6 max-w-[30ch] text-[13px] text-white/55">{t('badges.maxed')}</p>
        ) : null}

        {earned && card.at && (
          <div className="mt-6 space-y-1 text-[13px] text-white/55">
            <p>{richT(t, 'badges.earnedOn', { date: date(card.at) })}</p>
            {def.thresholds && card.level > 1 && card.levelAt && tier && (
              <p>{richT(t, 'badges.tierSince', { tier: t(`badges.tier.${tier}` as TKey), date: date(card.levelAt) })}</p>
            )}
          </div>
        )}

        {card.onlyYou && (
          <p className="mx-auto mt-5 inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1.5 text-[12.5px] text-white/60">
            <Lock aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            {t('badges.onlyYou')}
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
