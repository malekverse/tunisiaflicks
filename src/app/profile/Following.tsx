"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, m } from 'framer-motion';
import { BellOff, BellRing, CalendarClock } from 'lucide-react';
import TmdbImage from '@/src/components/TmdbImage';
import SettingsSection from '@/src/components/profile/SettingsSection';
import { Button } from '@/src/components/ui/button';
import { Skeleton } from '@/src/components/ui/skeleton';
import { toast } from '@/src/hooks/use-toast';
import { useFollowStore } from '@/src/hooks/use-follow';
import { useI18n } from '@/src/components/I18nProvider';
import ReleaseEmailSwitch from '@/src/components/digest/ReleaseEmailSwitch';
import { spring, tween } from '@/src/lib/motion';
import type { Translate } from '@/src/lib/i18n/translate';
import type { FollowItem } from '@/src/lib/models/Follow';

function status(item: FollowItem, t: Translate, dateLocale: string | undefined) {
  if (item.media_type === 'movie') {
    if (item.released) return t('alerts.outNow');
    if (!item.release_date) return t('alerts.releaseTba');
    const date = new Date(`${item.release_date}T00:00:00Z`).toLocaleDateString(dateLocale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
    return t('alerts.releasesOn', { date });
  }
  return item.last_episode
    ? t('alerts.latestEpisode', { episode: t('common.seasonEpisode', { season: item.last_episode.season, episode: item.last_episode.episode }) })
    : t('alerts.whenAirs');
}

const keyOf = (item: FollowItem) => `${item.media_type}-${item.id}`;

/** Settings > Following (#following): titles with release / new-episode alerts turned on. */
export default function Following() {
  const { t, dateLocale } = useI18n();
  const [items, setItems] = useState<FollowItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const setFollowing = useFollowStore((state) => state.setFollowing);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/follows')
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('Failed to load'))))
      .then((data) => {
        if (!cancelled) setItems(data.items || []);
      })
      .catch((error) => {
        console.error('Error fetching follows:', error);
        if (!cancelled) toast({ title: t('common.error'), description: t('alerts.loadFailed'), variant: 'destructive' });
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // Load once; the translator only affects the error toast.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Gone from the list right away; back in its place if the server says no.
  const handleUnfollow = async (item: FollowItem) => {
    const index = items.findIndex((other) => keyOf(other) === keyOf(item));
    setItems((current) => current.filter((other) => keyOf(other) !== keyOf(item)));
    try {
      await setFollowing(item.media_type, item.id, false);
      toast({ title: t('alerts.offTitle'), description: t('alerts.offDesc', { title: item.title }) });
    } catch (error) {
      console.error('Failed to unfollow:', error);
      setItems((current) => {
        if (current.some((other) => keyOf(other) === keyOf(item))) return current;
        const next = current.slice();
        next.splice(Math.max(0, Math.min(index, next.length)), 0, item);
        return next;
      });
      toast({ title: t('common.error'), description: t('alerts.unfollowFailed'), variant: 'destructive' });
    }
  };

  return (
    <SettingsSection
      id="following"
      title={t('alerts.following')}
      description={t('alerts.sectionDesc')}
      action={items.length > 0 ? <span className="text-[13px] tabular-nums text-white/45">{items.length}</span> : undefined}
    >
      {/* "Release alerts by email", for the whole account (disappears when it renders nothing). */}
      <div className="mb-6 empty:hidden"><ReleaseEmailSwitch /></div>
      {isLoading ? (
        <div aria-busy className="grid gap-3 sm:grid-cols-2">
          {[0, 1].map((key) => <Skeleton key={key} className="h-[104px] rounded-2xl" />)}
          <span className="sr-only">{t('common.loading')}</span>
        </div>
      ) : items.length > 0 ? (
        <ul className="relative grid gap-3 sm:grid-cols-2">
          <AnimatePresence mode="popLayout" initial={false}>
            {items.map((item) => (
              <m.li
                key={keyOf(item)}
                layout="position"
                transition={spring.ui}
                exit={{ opacity: 0, scale: 0.96, transition: tween.fast }}
                className="group/row flex items-center gap-3.5 rounded-2xl bg-white/[0.03] p-2.5 pe-2 ring-1 ring-inset ring-white/[0.05] transition-colors hover:bg-white/[0.05]"
              >
                <Link href={`/${item.media_type}/${item.id}`} className="pressable relative block aspect-[2/3] w-[56px] shrink-0 overflow-hidden rounded-lg bg-white/[0.06] outline-none focus-visible:ring-2 focus-visible:ring-red-500">
                  <TmdbImage kind="poster" path={item.poster_path} alt={item.title} fill sizes="56px" className="object-cover" />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link href={`/${item.media_type}/${item.id}`} className="line-clamp-1 text-[15px] font-semibold text-white outline-none hover:underline focus-visible:underline">
                    <bdi>{item.title}</bdi>
                  </Link>
                  <p className="mt-0.5 text-[12.5px] text-white/45">{t(item.media_type === 'movie' ? 'common.movie' : 'common.tvShow')}</p>
                  <p className="mt-1.5 flex items-start gap-1.5 text-[13px] leading-snug text-white/70">
                    <BellRing aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" strokeWidth={2.2} />
                    <span>{status(item, t, dateLocale)}</span>
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleUnfollow(item)}
                  aria-label={`${t('alerts.unfollow')}: ${item.title}`}
                  title={t('alerts.unfollow')}
                  className="h-11 w-11 shrink-0 self-center text-white/55 hover:bg-white/[0.08] hover:text-white"
                >
                  <BellOff aria-hidden className="h-[18px] w-[18px]" />
                </Button>
              </m.li>
            ))}
          </AnimatePresence>
        </ul>
      ) : (
        <div className="flex flex-col items-center rounded-2xl bg-white/[0.03] px-6 py-10 text-center ring-1 ring-inset ring-white/[0.05]">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-white/[0.06] text-white/55">
            <BellRing aria-hidden className="h-5 w-5" />
          </span>
          <p className="mt-4 font-display text-lg font-bold text-white">{t('alerts.emptyTitle')}</p>
          <p className="mt-1 max-w-sm text-[14px] text-white/55">{t('alerts.emptyDesc')}</p>
          <Button asChild variant="secondary" className="mt-5">
            <Link href="/upcoming"><CalendarClock aria-hidden className="h-4 w-4" />{t('nav.comingSoon')}</Link>
          </Button>
        </div>
      )}
    </SettingsSection>
  );
}
