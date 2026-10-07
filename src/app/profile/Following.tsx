"use client";

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { FaBell, FaTrash } from 'react-icons/fa';
import { Card, CardContent } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { toast } from '@/src/hooks/use-toast';
import { useFollowStore } from '@/src/hooks/use-follow';
import { episodeCode, type FollowItem } from '@/src/lib/models/Follow';

const formatDate = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

function status(item: FollowItem) {
  if (item.media_type === 'movie') {
    if (item.released) return 'Out now';
    return item.release_date ? `Releases ${formatDate(item.release_date)} · we'll email you` : "Release date TBA · we'll email you";
  }
  return item.last_episode
    ? `Latest: ${episodeCode(item.last_episode)} · we'll email you about new episodes`
    : "We'll email you when it airs";
}

/** "Following" section of the profile: titles with release / new-episode alerts turned on. */
export default function Following() {
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
        if (!cancelled) toast({ title: 'Error', description: 'Failed to load the titles you follow', variant: 'destructive' });
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleUnfollow = async (item: FollowItem) => {
    try {
      await setFollowing(item.media_type, item.id, false);
      setItems((current) => current.filter((other) => !(other.id === item.id && other.media_type === item.media_type)));
      toast({ title: 'Alerts off', description: `You won't get alerts for ${item.title} anymore` });
    } catch (error) {
      console.error('Failed to unfollow:', error);
      toast({ title: 'Error', description: 'Failed to turn off alerts', variant: 'destructive' });
    }
  };

  return (
    <section id="following" className="mt-8 scroll-mt-20">
      <h2 className="text-2xl font-bold mb-2">Following</h2>
      <p className="text-gray-400 text-sm mb-6">
        We email you when an upcoming movie is released or a show you follow airs a new episode.
      </p>

      {isLoading ? (
        <div className="flex justify-center items-center h-40">
          <p>Loading...</p>
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
                    <p className="text-gray-400 text-xs mt-1">{item.media_type === 'movie' ? 'Movie' : 'TV Show'}</p>
                    <p className="text-gray-300 text-sm mt-1">{status(item)}</p>
                  </div>
                  <div className="flex justify-end mt-2">
                    <Button variant="destructive" size="sm" onClick={() => handleUnfollow(item)}>
                      <FaTrash className="mr-2" /> Unfollow
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
          <h3 className="text-xl font-medium mb-2">Not following anything yet</h3>
          <p className="text-gray-400">
            Tap <span className="font-semibold">Notify me</span> on an upcoming movie or <span className="font-semibold">Follow</span> on a TV show
          </p>
        </div>
      )}
    </section>
  );
}
