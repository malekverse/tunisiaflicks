"use client"
// The shelf (/me#badges, /u/[handle]): the badges earned, as medallions with their names, a dot on
// a level not opened yet, the weekly streak, and for the owner the three closest next levels.
// Opening a badge shows it up close (BadgeDialog) and clears its dot. Others see the earned public
// badges and the streak number only: nothing to open, no progress, no dates.
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CalendarCheck, ChevronRight, MedalIcon, RotateCw } from 'lucide-react'
import { Button } from '@/src/components/ui/button'
import { TOUCH } from '@/src/components/badges/touch'
import { useI18n } from '@/src/components/I18nProvider'
import { richT } from '@/src/lib/i18n/rich'
import type { TKey } from '@/src/lib/i18n'
import { TIER_RGB, badgeDef, tierOf } from '@/src/lib/badges/catalogue'
import type { BadgeCard, BadgesView } from '@/src/lib/badges/present'
import { haptic } from '@/src/lib/motion'
import { cn } from '@/src/lib/utils'
import BadgeArt from './BadgeArt'
import BadgeDialog, { BadgeProgress } from './BadgeDialog'

const SECTION = 'scroll-mt-[calc(var(--topbar)+env(safe-area-inset-top,0px)+20px)] rounded-[22px] bg-white/[0.04] p-5 ring-1 ring-white/[0.07] sm:p-6'

function Title({ children }: { children?: React.ReactNode }) {
  const { t } = useI18n()
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
      <h2 id="badges-title" className="font-display text-[21px] font-bold leading-tight text-white sm:text-[24px]">{t('badges.title')}</h2>
      {children}
    </div>
  )
}

function StreakChip({ streak }: { streak: NonNullable<BadgesView['streak']> }) {
  const { t } = useI18n()
  const current = streak.current >= 2
  const n = current ? streak.current : streak.best
  return (
    <p className="inline-flex h-9 items-center gap-2 rounded-full bg-white/[0.06] pe-3.5 ps-3 text-[13px] font-medium text-white/80 ring-1 ring-inset ring-white/[0.08]">
      <CalendarCheck aria-hidden className="h-4 w-4 text-white/60" strokeWidth={2} />
      <span className="sr-only">{t('badges.streak.label')}. </span>
      <span className="tabular-nums">{richT(t, current ? 'badges.streak.current' : 'badges.streak.best', { n })}</span>
    </p>
  )
}

const tierColor = (card: BadgeCard) => (card.tier ? `rgb(${TIER_RGB[card.tier]})` : undefined)

function TileFace({ card, name }: { card: BadgeCard; name: string }) {
  const { t } = useI18n()
  const multi = !!badgeDef(card.id).thresholds
  return (
    <>
      <span className="relative">
        <BadgeArt id={card.id} level={card.level} size={64} />
        {card.unseen && (
          <span className="absolute end-0.5 top-0.5 h-3 w-3 rounded-full bg-red-500 ring-[3px] ring-[#0d0d0f]">
            <span className="sr-only">{t('badges.unseen')}</span>
          </span>
        )}
      </span>
      <span dir="auto" className="mt-2.5 line-clamp-2 text-[13px] font-medium leading-tight text-white/85">{name}</span>
      {multi && card.tier && (
        <span className="mt-1 text-[12px] font-medium" style={{ color: tierColor(card) }}>{t(`badges.tier.${card.tier}` as TKey)}</span>
      )}
    </>
  )
}

export default function BadgeShelf({ data, error }: { data: BadgesView | null; error?: boolean }) {
  const { t } = useI18n()
  const router = useRouter()
  // Badges opened here, so their dot goes at once (the server knows on the next load).
  const [opened, setOpened] = useState<ReadonlySet<string>>(new Set())
  const [open, setOpen] = useState<BadgeCard | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [celebrate, setCelebrate] = useState(false)

  if (error || !data) {
    return (
      <section id="badges" aria-labelledby="badges-title" className={SECTION}>
        <Title />
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[14px] text-white/60">{t('badges.error.title')}</p>
          <Button type="button" size="sm" variant="secondary" className={TOUCH} onClick={() => router.refresh()}>
            <RotateCw aria-hidden className="h-3.5 w-3.5" />{t('badges.error.retry')}
          </Button>
        </div>
      </section>
    )
  }

  const owner = data.view === 'owner'
  const earned = data.earned.map((card) => (card.unseen && opened.has(card.id) ? { ...card, unseen: false } : card))
  const name = (card: BadgeCard) => t(`badges.name.${card.id}` as TKey)

  if (data.disabled) {
    if (!owner) return null
    return (
      <section id="badges" aria-labelledby="badges-title" className={SECTION}>
        <Title />
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3.5">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/[0.06] text-white/50">
              <MedalIcon aria-hidden className="h-5 w-5" strokeWidth={1.8} />
            </span>
            <div>
              <p className="text-[15px] font-medium text-white">{t('badges.off.title')}</p>
              <p className="mt-0.5 text-[13.5px] text-white/60">{t('badges.off.text')}</p>
            </div>
          </div>
          {!data.kids && (
            <Button asChild size="sm" variant="secondary" className={`${TOUCH} self-start sm:self-auto`}>
              <Link href="/profile#privacy">{t('badges.off.action')}<ChevronRight aria-hidden className="h-4 w-4 rtl:rotate-180" /></Link>
            </Button>
          )}
        </div>
      </section>
    )
  }

  // Someone else's page with nothing they may see: no section at all.
  if (!owner && earned.length === 0 && !data.streak) return null

  const openCard = (picked: BadgeCard) => {
    // An 'Up next' row of a badge already earned opens the earned one (with its dates).
    const card = earned.find((c) => c.id === picked.id) ?? picked
    const fresh = !!card.unseen && card.level > 0
    setCelebrate(fresh)
    setOpen(card)
    setDialogOpen(true)
    if (fresh) {
      haptic(12)
      setOpened((ids) => new Set([...ids, card.id]))
      fetch('/api/badges/seen', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: card.id }) })
        .catch(() => undefined)
    }
  }

  return (
    <section id="badges" aria-labelledby="badges-title" className={SECTION}>
      <Title>{data.streak && <StreakChip streak={data.streak} />}</Title>

      {earned.length > 0 ? (
        <ul aria-label={t('badges.shelfLabel')} className="-mx-1.5 mt-4 grid grid-cols-[repeat(auto-fill,minmax(92px,1fr))] gap-x-1 gap-y-2 sm:grid-cols-[repeat(auto-fill,minmax(108px,1fr))]">
          {earned.map((card) => (
            <li key={card.id} className="flex">
              {owner ? (
                <button
                  type="button"
                  onClick={() => openCard(card)}
                  aria-label={[
                    badgeDef(card.id).thresholds && card.tier ? t('badges.artLabel', { name: name(card), tier: t(`badges.tier.${card.tier}` as TKey) }) : name(card),
                    card.unseen ? t('badges.unseen') : null,
                  ].filter(Boolean).join('. ')}
                  className="pressable flex w-full select-none flex-col items-center rounded-2xl px-1.5 pb-3 pt-3 text-center outline-none transition-colors duration-150 [-webkit-tap-highlight-color:transparent] hover:bg-white/[0.05] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-500"
                >
                  <TileFace card={card} name={name(card)} />
                </button>
              ) : (
                <div className="flex w-full flex-col items-center px-1.5 pb-3 pt-3 text-center">
                  <TileFace card={card} name={name(card)} />
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : owner ? (
        <div className="mt-4 flex flex-col gap-4 rounded-2xl bg-white/[0.03] p-4 ring-1 ring-inset ring-white/[0.05] sm:flex-row sm:items-center sm:gap-5 sm:p-5">
          <div className="flex items-center gap-4">
            <BadgeArt id="openingNight" level={0} size={64} />
            <div className="min-w-0">
              <p className="text-balance font-display text-[19px] font-bold leading-tight text-white">{t('badges.empty.title')}</p>
              <p className="mt-1 text-[14px] leading-snug text-white/60">{t('badges.empty.text')}</p>
            </div>
          </div>
          <Button asChild size="sm" variant="secondary" className={`${TOUCH} shrink-0 self-start sm:ms-auto sm:self-auto`}>
            <Link href="/">{t('badges.empty.action')}</Link>
          </Button>
        </div>
      ) : null}

      {owner && earned.length > 0 && data.upNext.length > 0 && (
        <div className="mt-5 border-t border-white/[0.07] pt-5">
          <h3 className="text-[15px] font-semibold text-white">{t('badges.upNext')}</h3>
          <ul className="-mx-2 mt-2">
            {data.upNext.map((card) => {
              const nextTier = card.next ? tierOf(card.next.level) : null
              const fraction = card.next ? Math.min(1, (card.value ?? 0) / card.next.target) : 0
              return (
                <li key={card.id}>
                  <button
                    type="button"
                    onClick={() => openCard(card)}
                    className="pressable flex w-full select-none items-center gap-3.5 rounded-2xl px-2 py-2.5 text-start outline-none transition-colors duration-150 [-webkit-tap-highlight-color:transparent] hover:bg-white/[0.05] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-500"
                  >
                    <BadgeArt id={card.id} level={0} size={44} progress={fraction} arcTier={nextTier} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-3">
                        <span dir="auto" className="truncate text-[15px] font-medium text-white">{name(card)}</span>
                        <span className="shrink-0 text-[13px] tabular-nums text-white/60">
                          {card.next && richT(t, 'badges.progress', { value: Math.min(card.value ?? 0, card.next.target), target: card.next.target })}
                        </span>
                      </span>
                      <BadgeProgress card={card} name={name(card)} className="mt-2" />
                      {nextTier && (
                        <span className="mt-1.5 block text-[12.5px] text-white/55">{t('badges.nextTier', { tier: t(`badges.tier.${nextTier}` as TKey) })}</span>
                      )}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {owner && (
        <BadgeDialog
          card={open}
          open={dialogOpen}
          onOpenChange={(value) => setDialogOpen(value)}
          celebrate={celebrate}
        />
      )}
    </section>
  )
}
