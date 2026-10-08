import { PosterSlider } from '@/src/components/Sliders'
import { getLocale, getT } from '@/src/lib/i18n/server'
import { activeMoments, anniversaries, momentItems, sequelRow } from '@/src/lib/moments'
import type { TKey } from '@/src/lib/i18n'

/**
 * The home page's seasonal rows: whatever the calendar says is on today (Halloween, Eid, summer...),
 * at most two. Ramadan has its own banner and hub, so it isn't repeated here.
 */
export async function SeasonRows({ kids }: { kids: boolean }) {
  const locale = getLocale()
  const t = getT()
  const moments = activeMoments(kids).filter((moment) => moment.id !== 'ramadan').slice(0, 2)
  const rows = await Promise.all(moments.map((moment) => momentItems(moment.id, locale, kids)))
  return (
    <>
      {moments.map((moment, index) => (
        <PosterSlider
          key={moment.id}
          title={t(`moment.${moment.id}.title` as TKey)}
          subtitle={t(`moment.${moment.id}.blurb` as TKey)}
          href={moment.href}
          items={rows[index].slice(0, 20)}
          kind="mixed"
        />
      ))}
    </>
  )
}

/** Films turning 10, 20, 30... this week; the subtitle names one whose birthday is today. */
export async function AnniversaryRow({ kids }: { kids: boolean }) {
  const locale = getLocale()
  const t = getT()
  const found = await anniversaries(locale, kids)
  if (found.length < 4) return null
  const today = found.find((entry) => entry.onTheDay)
  return (
    <PosterSlider
      title={t('moment.anniversaries.title')}
      subtitle={today ? t('moment.anniversaries.today', { title: today.item.title, years: today.years }) : t('moment.anniversaries.blurb')}
      items={found.map((entry) => entry.item)}
    />
  )
}

/** The earlier films of the sequels opening around now. */
export async function SequelRow({ kids }: { kids: boolean }) {
  const t = getT()
  const { items, titles } = await sequelRow(getLocale(), kids)
  if (items.length < 3) return null
  return (
    <PosterSlider
      title={t('moment.sequels.title')}
      subtitle={titles.length === 1 ? t('moment.sequels.blurb', { title: titles[0] }) : t('moment.sequels.blurbMany')}
      items={items}
    />
  )
}
