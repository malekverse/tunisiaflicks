"use client"
// Under the player: where the title is legally available in the viewer's country (lib/watch-
// providers), each service's logo and name, linked to TMDB's page of the offers, with JustWatch
// credited as TMDB asks. Nothing at all when the country has no offers.
import React from 'react'
import { BadgeCheck, ExternalLink } from 'lucide-react'
import TmdbImage from '@/src/components/TmdbImage'
import { useI18n } from '@/src/components/I18nProvider'
import { cn } from '@/src/lib/utils'
import type { WatchOffers as Offers, WatchProvider } from '@/src/lib/watch-providers'

function countryName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale === 'tn' ? 'ar' : locale], { type: 'region' }).of(code) ?? code
  } catch {
    return code
  }
}

function Service({ item }: { item: WatchProvider }) {
  return (
    <li className="flex items-center gap-2 rounded-full bg-white/[0.06] py-1 pe-3 ps-1 ring-1 ring-inset ring-white/[0.08]">
      <span className="relative h-7 w-7 shrink-0 overflow-hidden rounded-[8px] bg-white/10">
        {item.logo && <TmdbImage kind="logo" path={item.logo} alt="" fill sizes="28px" shimmer={false} className="object-cover" />}
      </span>
      <span className="text-[13px] font-medium text-white/85">{item.name}</span>
    </li>
  )
}

export default function WatchOffers({ offers, className }: { offers: Offers | null | undefined, className?: string }) {
  const { t, locale } = useI18n()
  if (!offers) return null
  const country = countryName(offers.country, locale)
  return (
    <section aria-labelledby="watch-offers" className={cn('page-x', className)}>
      <div className="mx-auto max-w-[1400px] rounded-[20px] bg-white/[0.035] p-4 ring-1 ring-inset ring-white/[0.07] sm:p-5">
        <h2 id="watch-offers" className="flex items-center gap-2 text-[15px] font-semibold text-white">
          <BadgeCheck aria-hidden className="h-4 w-4 text-emerald-400" />
          {t('offers.title', { country })}
        </h2>
        {offers.stream.length > 0 && (
          <div className="mt-3">
            <p className="mb-2 text-[12.5px] text-white/50">{t('offers.stream')}</p>
            <ul className="flex flex-wrap gap-2">{offers.stream.map((item) => <Service key={item.id} item={item} />)}</ul>
          </div>
        )}
        {offers.rentBuy.length > 0 && (
          <div className="mt-3">
            <p className="mb-2 text-[12.5px] text-white/50">{t('offers.rentBuy')}</p>
            <ul className="flex flex-wrap gap-2">{offers.rentBuy.map((item) => <Service key={item.id} item={item} />)}</ul>
          </div>
        )}
        <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-white/40">
          <span>{t('offers.credit')}</span>
          {offers.link && (
            <a href={offers.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-white/60 underline-offset-4 hover:text-white hover:underline">
              {t('offers.more')}<ExternalLink aria-hidden className="h-3 w-3" />
            </a>
          )}
        </p>
      </div>
    </section>
  )
}
