"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { AnimatePresence, m } from 'framer-motion';
import { Bookmark, ChevronRight, Heart, History, X, type LucideIcon } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/src/components/ui/tabs';
import { Skeleton } from '@/src/components/ui/skeleton';
import { getFavorites, getSavedItems, getWatchHistory } from '@/src/lib/user-content';
import { ContentItem, WatchHistoryItem } from '@/src/lib/models/UserContent';
import TmdbImage from '@/src/components/TmdbImage';
import SettingsSection from '@/src/components/profile/SettingsSection';
import { CardAction } from '@/src/components/library/controls';
import { removeFromFavorites, removeFromSaved } from '@/src/lib/user-content';
import { toast } from '@/src/hooks/use-toast';
import { useI18n } from '@/src/components/I18nProvider';
import { spring, tween } from '@/src/lib/motion';
import type { TKey } from '@/src/lib/i18n';

type Tab = 'favorites' | 'saved' | 'history';

const LOAD_FAILED: Record<string, TKey> = {
  favorites: 'lists.loadFavoritesFailed',
  saved: 'lists.loadSavedFailed',
  history: 'lists.loadHistoryFailed',
};

// The newest few of each list; the full pages have everything (and filters).
const PREVIEW = 12;

const TABS: { value: Tab, label: TKey, icon: LucideIcon, href: string, empty: TKey, hint: TKey, loading: TKey }[] = [
  { value: 'favorites', label: 'profile.tabFavorites', icon: Heart, href: '/favorites', empty: 'lists.noFavorites', hint: 'lists.noFavoritesHint', loading: 'lists.loadingFavorites' },
  { value: 'saved', label: 'profile.tabSaved', icon: Bookmark, href: '/saved', empty: 'lists.noSaved', hint: 'lists.noSavedHint', loading: 'lists.loadingSaved' },
  { value: 'history', label: 'profile.tabHistory', icon: History, href: '/history', empty: 'lists.noHistory', hint: 'lists.noHistoryHint', loading: 'lists.loadingHistory' },
];

/** Settings > Your library (#library): a peek at favorites, saved titles and history. */
export default function UserContent() {
  const { t, dateLocale } = useI18n();
  const [activeTab, setActiveTab] = useState<Tab>('favorites');
  const [favorites, setFavorites] = useState<ContentItem[]>([]);
  const [savedItems, setSavedItems] = useState<ContentItem[]>([]);
  const [watchHistory, setWatchHistory] = useState<WatchHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUserContent = async () => {
      setIsLoading(true);
      try {
        if (activeTab === 'favorites') {
          const items = await getFavorites();
          setFavorites(items);
        } else if (activeTab === 'saved') {
          const items = await getSavedItems();
          setSavedItems(items);
        } else if (activeTab === 'history') {
          const items = await getWatchHistory();
          setWatchHistory(items);
        }
      } catch (error) {
        console.error(`Error fetching ${activeTab}:`, error);
        toast({
          title: t('common.error'),
          description: t(LOAD_FAILED[activeTab]),
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserContent();
  }, [activeTab, t]);

  // Removing is instant; the title comes back if the server says no.
  const handleRemoveFromFavorites = async (id: string, title: string) => {
    const before = favorites;
    setFavorites(favorites.filter(item => item.id !== id));
    try {
      await removeFromFavorites(id);
      toast({
        title: t('toast.removedFavorites'),
        description: t('toast.removedFavoritesDesc', { title }),
      });
    } catch (error) {
      console.error('Failed to remove from favorites:', error);
      setFavorites(before);
      toast({
        title: t('common.error'),
        description: t('lists.removeFavoritesFailed'),
        variant: 'destructive',
      });
    }
  };

  const handleRemoveFromSaved = async (id: string, title: string) => {
    const before = savedItems;
    setSavedItems(savedItems.filter(item => item.id !== id));
    try {
      await removeFromSaved(id);
      toast({
        title: t('toast.removedSaved'),
        description: t('toast.removedSavedDesc', { title }),
      });
    } catch (error) {
      console.error('Failed to remove from saved:', error);
      setSavedItems(before);
      toast({
        title: t('common.error'),
        description: t('lists.removeSavedFailed'),
        variant: 'destructive',
      });
    }
  };

  const renderContentItem = (item: ContentItem, listType: Tab) => {
    const date = new Date(item.added_at).toLocaleDateString(dateLocale);
    const watchedDate = item.hasOwnProperty('watched_at')
      ? new Date((item as WatchHistoryItem).watched_at).toLocaleDateString(dateLocale)
      : null;
    const progress = (item as WatchHistoryItem).progress;
    const href = `/${item.media_type}/${item.id}`;
    const caption = watchedDate
      ? `${t('lists.watchedOn', { date: watchedDate })}${progress ? ` ${t('lists.percentCompleted', { progress })}` : ''}`
      : t('lists.addedOn', { date });

    return (
      <m.li
        key={`${item.media_type}-${item.id}`}
        layout="position"
        transition={spring.ui}
        exit={{ opacity: 0, scale: 0.92, transition: tween.fast }}
        className="group/item relative w-[104px] shrink-0 sm:w-[118px]"
      >
        <Link href={href} title={caption} className="group/poster block outline-none">
          <span className="relative block aspect-[2/3] overflow-hidden rounded-poster bg-white/[0.05] ring-1 ring-inset ring-white/[0.07] transition-transform duration-300 ease-out group-hover/poster:-translate-y-1 group-active/poster:scale-[0.97] group-focus-visible/poster:ring-2 group-focus-visible/poster:ring-red-500">
            <TmdbImage kind="poster" path={item.poster_path} alt={item.title} fill sizes="118px" className="object-cover" />
            {listType === 'history' && progress && progress < 100 ? (
              <span aria-hidden className="absolute inset-x-2 bottom-2 h-1 overflow-hidden rounded-full bg-white/25">
                <span className="block h-full rounded-full bg-red-500" style={{ width: `${progress}%` }} />
              </span>
            ) : null}
          </span>
          <span className="mt-2 block truncate px-0.5 text-[13px] font-medium text-white/85"><bdi>{item.title}</bdi></span>
          <span className="block px-0.5 text-[11.5px] text-white/45">{item.media_type === 'movie' ? t('common.movie') : t('common.tvShow')}</span>
        </Link>
        {listType === 'favorites' && (
          <CardAction label={`${t('lists.remove')}: ${item.title}`} tone="danger" onClick={() => handleRemoveFromFavorites(item.id, item.title)} className="absolute end-0 top-0">
            <X aria-hidden className="h-4 w-4" strokeWidth={2.4} />
          </CardAction>
        )}
        {listType === 'saved' && (
          <CardAction label={`${t('lists.remove')}: ${item.title}`} tone="danger" onClick={() => handleRemoveFromSaved(item.id, item.title)} className="absolute end-0 top-0">
            <X aria-hidden className="h-4 w-4" strokeWidth={2.4} />
          </CardAction>
        )}
      </m.li>
    );
  };

  const lists: Record<Tab, ContentItem[]> = { favorites, saved: savedItems, history: watchHistory };
  const current = TABS.find((tab) => tab.value === activeTab)!;

  return (
    <SettingsSection
      id="library"
      title={t('nav.library')}
      description={t('settings.libraryDesc')}
      action={(
        <Link href={current.href} className="group/see -my-2 inline-flex items-center gap-0.5 rounded-full py-2 ps-3 text-[13px] font-medium text-white/55 transition-colors hover:text-white">
          {t('common.seeAll')}
          <ChevronRight aria-hidden className="h-4 w-4 transition-transform duration-200 ease-out group-hover/see:translate-x-0.5 rtl:rotate-180 rtl:group-hover/see:-translate-x-0.5" />
        </Link>
      )}
    >
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as Tab)}>
        <div className="no-scrollbar -mx-5 overflow-x-auto overflow-y-hidden px-5 sm:mx-0 sm:px-0">
          <TabsList>
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger key={tab.value} value={tab.value} className="gap-2">
                  <Icon aria-hidden className="h-4 w-4" /> {t(tab.label)}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        {TABS.map((tab) => {
          const items = lists[tab.value];
          const Icon = tab.icon;
          return (
            <TabsContent key={tab.value} value={tab.value} className="mt-5">
              {isLoading ? (
                <div aria-busy className="flex gap-3 overflow-hidden">
                  <span className="sr-only">{t(tab.loading)}</span>
                  {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="aspect-[2/3] w-[104px] shrink-0 rounded-poster sm:w-[118px]" />)}
                </div>
              ) : items.length > 0 ? (
                <ul className="no-scrollbar relative -mx-5 flex gap-3 overflow-x-auto overflow-y-hidden overscroll-x-contain px-5 pb-1 sm:-mx-7 sm:px-7">
                  <AnimatePresence mode="popLayout" initial={false}>
                    {items.slice(0, PREVIEW).map(item => renderContentItem(item, tab.value))}
                  </AnimatePresence>
                </ul>
              ) : (
                <div className="flex items-center gap-4 rounded-2xl bg-white/[0.03] p-5 ring-1 ring-inset ring-white/[0.05]">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/[0.06] text-white/55"><Icon aria-hidden className="h-5 w-5" /></span>
                  <div>
                    <p className="text-[15px] font-semibold text-white">{t(tab.empty)}</p>
                    <p className="mt-0.5 text-[13px] text-white/55">{t(tab.hint)}</p>
                  </div>
                </div>
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </SettingsSection>
  );
}
