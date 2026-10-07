"use client";

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { FaBell, FaTrash } from 'react-icons/fa';
import { Card, CardContent } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { toast } from '@/src/hooks/use-toast';
import { useFollowStore } from '@/src/hooks/use-follow';
import { useI18n } from '@/src/components/I18nProvider';
import type { Translate } from '@/src/lib/i18n';
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

/** "Following" section of the profile: titles with release / new-episode alerts turned on. */
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

  const handleUnfollow = async (item: FollowItem) => {
    try {
      await setFollowing(item.media_type, item.id, false);
      setItems((current) => current.filter((other) => !(other.id === item.id && other.media_type === item.media_type)));
      toast({ title: t('alerts.offTitle'), description: t('alerts.offDesc', { title: item.title }) });
    } catch (error) {
      console.error('Failed to unfollow:', error);
      toast({ title: t('common.error'), description: t('alerts.unfollowFailed'), variant: 'destructive' });
    }
  };

  return (
    <section id="following" className="mt-8 scroll-mt-20">
      <h2 className="text-2xl font-bold mb-2">{t('alerts.following')}</h2>
      <p className="text-gray-400 text-sm mb-6">{t('alerts.sectionDesc')}</p>

      {isLoading ? (
        <div className="flex justify-center items-center h-40">
          <p>{t('common.loading')}</p>
        </div>
      ) : items.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <Card key={`${item.media_type}-${item.id}`} className="overflow-hidden bg-gray-900 border-gray-800">
              <CardContent className="p-0 flex">
                <Link href={`/${item.media_type}/${item.id}`} className="relative w-20 shrink-0 aspect-[2/3]">
                  <Image
                    src={item.poster_path ? `https://image.tmdb.org/t/p/w185${item.poster_path}` : '/404.png'}
                    alt={item.title}
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                </Link>
                <div className="p-3 flex-1 min-w-0 flex flex-col justify-between">
                  <div>
                    <Link href={`/${item.media_type}/${item.id}`} className="hover:underline">
                      <h3 className="font-bold leading-tight line-clamp-2">{item.title}</h3>
                    </Link>
                    <p className="text-gray-400 text-xs mt-1">{t(item.media_type === 'movie' ? 'common.movie' : 'common.tvShow')}</p>
                    <p className="text-gray-300 text-sm mt-1">{status(item, t, dateLocale)}</p>
                  </div>
                  <div className="flex justify-end mt-2">
                    <Button variant="destructive" size="sm" onClick={() => handleUnfollow(item)}>
                      <FaTrash className="me-2" /> {t('alerts.unfollow')}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-10 bg-gray-900 rounded-lg">
          <FaBell className="mx-auto text-4xl text-gray-600 mb-4" />
          <h3 className="text-xl font-medium mb-2">{t('alerts.emptyTitle')}</h3>
          <p className="text-gray-400">{t('alerts.emptyDesc')}</p>
        </div>
      )}
    </section>
  );
}
