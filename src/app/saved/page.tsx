"use client";

import { useState, useEffect } from 'react';
import { getSavedItems, removeFromSaved } from '@/src/lib/user-content';
import { ContentItem } from '@/src/lib/models/UserContent';
import Image from 'next/image';
import Link from 'next/link';
import { FaBookmark, FaTrash, FaFilter } from 'react-icons/fa';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent } from '@/src/components/ui/card';
import { toast } from '@/src/hooks/use-toast';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';

export default function SavedItemsPage() {
  const { data: session, status } = useSession();
  const [savedItems, setSavedItems] = useState<ContentItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<ContentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [mediaTypeFilter, setMediaTypeFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<string>('newest');

  // Redirect if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/login');
    }
  }, [status]);

  useEffect(() => {
    const fetchSavedItems = async () => {
      if (status === 'authenticated') {
        setIsLoading(true);
        try {
          const items = await getSavedItems();
          setSavedItems(items);
          setFilteredItems(items);
        } catch (error) {
          console.error('Error fetching saved items:', error);
          toast({
            title: 'Error',
            description: 'Failed to load your saved items',
            variant: 'destructive',
          });
        } finally {
          setIsLoading(false);
        }
      }
    };

    fetchSavedItems();
  }, [status]);

  // Apply filters and sorting
  useEffect(() => {
    let result = [...savedItems];
    
    // Apply media type filter
    if (mediaTypeFilter !== 'all') {
      result = result.filter(item => item.media_type === mediaTypeFilter);
    }
    
    // Apply sorting
    result.sort((a, b) => {
      const dateA = new Date(a.added_at).getTime();
      const dateB = new Date(b.added_at).getTime();
      
      return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    });
    
    setFilteredItems(result);
  }, [savedItems, mediaTypeFilter, sortOrder]);

  const handleRemoveFromSaved = async (id: string, title: string) => {
    try {
      await removeFromSaved(id);
      setSavedItems(savedItems.filter(item => item.id !== id));
      toast({
        title: 'Removed from saved items',
        description: `${title} has been removed from your saved items`,
      });
    } catch (error) {
      console.error('Failed to remove from saved items:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove from saved items',
        variant: 'destructive',
      });
    }
  };

  if (status === 'loading') {
    return (
      <div className="container mx-auto py-10 px-4">
        <h1 className="text-3xl font-bold mb-6">My Saved Items</h1>
        <div className="flex justify-center items-center h-40">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10 px-4">
      <h1 className="text-3xl font-bold mb-6">My Saved Items</h1>
      
      {!isLoading && (
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="w-full md:w-1/3 lg:w-1/4">
            <Select
              value={mediaTypeFilter}
              onValueChange={setMediaTypeFilter}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="movie">Movies</SelectItem>
                <SelectItem value="tv">TV Shows</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="w-full md:w-1/3 lg:w-1/4">
            <Select
              value={sortOrder}
              onValueChange={setSortOrder}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
      
      {isLoading ? (
        <div className="flex justify-center items-center h-40">
          <p>Loading saved items...</p>
        </div>
      ) : filteredItems.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map(item => (
            <Card key={item.id} className="overflow-hidden bg-gray-900 border-gray-800 h-full flex flex-col">
              <div className="relative pt-[150%]">
                <Link href={`/${item.media_type}/${item.id}`}>
                  <Image 
                    src={item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : '/404.png'}
                    alt={item.title}
                    fill
                    className="object-cover"
                  />
                </Link>
              </div>
              <CardContent className="p-4 flex-1 flex flex-col">
                <Link href={`/${item.media_type}/${item.id}`} className="hover:underline">
                  <h3 className="text-xl font-bold mb-2">{item.title}</h3>
                </Link>
                <p className="text-gray-400 text-sm mb-2">
                  {item.media_type === 'movie' ? 'Movie' : 'TV Show'}
                </p>
                <p className="text-gray-400 text-sm mb-2">
                  Saved on: {new Date(item.added_at).toLocaleDateString()}
                </p>
                <div className="mt-auto pt-4">
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    className="w-full"
                    onClick={() => handleRemoveFromSaved(item.id, item.title)}
                  >
                    <FaTrash className="mr-2" /> Remove from Saved
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-10 bg-gray-900 rounded-lg">
          <FaBookmark className="mx-auto text-4xl text-gray-600 mb-4" />
          <h3 className="text-xl font-medium mb-2">No saved items yet</h3>
          <p className="text-gray-400">
            Save movies and TV shows for later by clicking the bookmark icon
          </p>
        </div>
      )}
    </div>
  );
}