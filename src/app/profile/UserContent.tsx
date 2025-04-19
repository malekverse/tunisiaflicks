"use client";

import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/src/components/ui/tabs';
import { Card, CardContent } from '@/src/components/ui/card';
import { getFavorites, getSavedItems, getWatchHistory } from '@/src/lib/user-content';
import { ContentItem, WatchHistoryItem } from '@/src/lib/models/UserContent';
import Image from 'next/image';
import Link from 'next/link';
import { FaHeart, FaBookmark, FaHistory, FaTrash } from 'react-icons/fa';
import { Button } from '@/src/components/ui/button';
import { removeFromFavorites, removeFromSaved } from '@/src/lib/user-content';
import { toast } from '@/src/hooks/use-toast';

export default function UserContent() {
  const [activeTab, setActiveTab] = useState('favorites');
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
          title: 'Error',
          description: `Failed to load your ${activeTab}`,
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserContent();
  }, [activeTab]);

  const handleRemoveFromFavorites = async (id: string, title: string) => {
    try {
      await removeFromFavorites(id);
      setFavorites(favorites.filter(item => item.id !== id));
      toast({
        title: 'Removed from favorites',
        description: `${title} has been removed from your favorites`,
      });
    } catch (error) {
      console.error('Failed to remove from favorites:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove from favorites',
        variant: 'destructive',
      });
    }
  };

  const handleRemoveFromSaved = async (id: string, title: string) => {
    try {
      await removeFromSaved(id);
      setSavedItems(savedItems.filter(item => item.id !== id));
      toast({
        title: 'Removed from saved',
        description: `${title} has been removed from your saved list`,
      });
    } catch (error) {
      console.error('Failed to remove from saved:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove from saved',
        variant: 'destructive',
      });
    }
  };

  const renderContentItem = (item: ContentItem, listType: string) => {
    const date = new Date(item.added_at).toLocaleDateString();
    const watchedDate = item.hasOwnProperty('watched_at') 
      ? new Date((item as WatchHistoryItem).watched_at).toLocaleDateString() 
      : null;
    
    return (
      <Card key={item.id} className="mb-4 overflow-hidden bg-gray-900 border-gray-800">
        <CardContent className="p-0">
          <div className="flex flex-col md:flex-row">
            <div className="relative w-full md:w-1/4 h-48 md:h-auto">
              <Link href={`/${item.media_type}/${item.id}`}>
                <Image 
                  src={item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : '/404.png'}
                  alt={item.title}
                  fill
                  className="object-cover"
                />
              </Link>
            </div>
            <div className="p-4 flex-1 flex flex-col justify-between">
              <div>
                <Link href={`/${item.media_type}/${item.id}`} className="hover:underline">
                  <h3 className="text-xl font-bold mb-2">{item.title}</h3>
                </Link>
                <p className="text-gray-400 text-sm mb-2">
                  {item.media_type === 'movie' ? 'Movie' : 'TV Show'}
                </p>
                {watchedDate && (
                  <p className="text-gray-400 text-sm mb-2">
                    Watched on: {watchedDate}
                    {(item as WatchHistoryItem).progress && (
                      <span className="ml-2">
                        ({(item as WatchHistoryItem).progress}% completed)
                      </span>
                    )}
                  </p>
                )}
                {!watchedDate && (
                  <p className="text-gray-400 text-sm mb-2">
                    Added on: {date}
                  </p>
                )}
              </div>
              <div className="flex justify-end mt-4">
                {listType === 'favorites' && (
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    onClick={() => handleRemoveFromFavorites(item.id, item.title)}
                  >
                    <FaTrash className="mr-2" /> Remove
                  </Button>
                )}
                {listType === 'saved' && (
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    onClick={() => handleRemoveFromSaved(item.id, item.title)}
                  >
                    <FaTrash className="mr-2" /> Remove
                  </Button>
                )}
                {listType === 'history' && (
                  <Link href={`/${item.media_type}/${item.id}`}>
                    <Button variant="default" size="sm">
                      Watch Again
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="mt-8">
      <h2 className="text-2xl font-bold mb-6">My Content</h2>
      
      <Tabs defaultValue="favorites" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 mb-8">
          <TabsTrigger value="favorites" className="flex items-center">
            <FaHeart className="mr-2" /> Favorites
          </TabsTrigger>
          <TabsTrigger value="saved" className="flex items-center">
            <FaBookmark className="mr-2" /> Saved
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center">
            <FaHistory className="mr-2" /> Watch History
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="favorites">
          {isLoading ? (
            <div className="flex justify-center items-center h-40">
              <p>Loading favorites...</p>
            </div>
          ) : favorites.length > 0 ? (
            favorites.map(item => renderContentItem(item, 'favorites'))
          ) : (
            <div className="text-center py-10 bg-gray-900 rounded-lg">
              <FaHeart className="mx-auto text-4xl text-gray-600 mb-4" />
              <h3 className="text-xl font-medium mb-2">No favorites yet</h3>
              <p className="text-gray-400">
                Add movies and TV shows to your favorites by clicking the heart icon
              </p>
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="saved">
          {isLoading ? (
            <div className="flex justify-center items-center h-40">
              <p>Loading saved items...</p>
            </div>
          ) : savedItems.length > 0 ? (
            savedItems.map(item => renderContentItem(item, 'saved'))
          ) : (
            <div className="text-center py-10 bg-gray-900 rounded-lg">
              <FaBookmark className="mx-auto text-4xl text-gray-600 mb-4" />
              <h3 className="text-xl font-medium mb-2">No saved items</h3>
              <p className="text-gray-400">
                Save movies and TV shows for later by clicking the bookmark icon
              </p>
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="history">
          {isLoading ? (
            <div className="flex justify-center items-center h-40">
              <p>Loading watch history...</p>
            </div>
          ) : watchHistory.length > 0 ? (
            watchHistory.map(item => renderContentItem(item, 'history'))
          ) : (
            <div className="text-center py-10 bg-gray-900 rounded-lg">
              <FaHistory className="mx-auto text-4xl text-gray-600 mb-4" />
              <h3 className="text-xl font-medium mb-2">No watch history</h3>
              <p className="text-gray-400">
                Your watch history will appear here after you watch movies or TV shows
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}