"use client";

import { useState, useEffect } from 'react';
import { getFavorites, removeFromFavorites } from '@/src/lib/user-content';
import { ContentItem } from '@/src/lib/models/UserContent';
import Image from 'next/image';
import Link from 'next/link';
import { FaHeart, FaTrash } from 'react-icons/fa';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent } from '@/src/components/ui/card';
import { toast } from '@/src/hooks/use-toast';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';

export default function FavoritesPage() {
  const { data: session, status } = useSession();
  const [favorites, setFavorites] = useState<ContentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Redirect if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/login');
    }
  }, [status]);

  useEffect(() => {
    const fetchFavorites = async () => {
      if (status === 'authenticated') {
        setIsLoading(true);
        try {
          const items = await getFavorites();
          setFavorites(items);
        } catch (error) {
          console.error('Error fetching favorites:', error);
          toast({
            title: 'Error',
            description: 'Failed to load your favorites',
            variant: 'destructive',
          });
        } finally {
          setIsLoading(false);
        }
      }
    };

    fetchFavorites();
  }, [status]);

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

  if (status === 'loading') {
    return (
      <div className="container mx-auto py-10 px-4">
        <h1 className="text-3xl font-bold mb-6">My Favorites</h1>
        <div className="flex justify-center items-center h-40">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10 px-4">
      <h1 className="text-3xl font-bold mb-6">My Favorites</h1>
      
      {isLoading ? (
        <div className="flex justify-center items-center h-40">
          <p>Loading favorites...</p>
        </div>
      ) : favorites.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {favorites.map(item => (
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
                  Added on: {new Date(item.added_at).toLocaleDateString()}
                </p>
                <div className="mt-auto pt-4">
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    className="w-full"
                    onClick={() => handleRemoveFromFavorites(item.id, item.title)}
                  >
                    <FaTrash className="mr-2" /> Remove from Favorites
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-10 bg-gray-900 rounded-lg">
          <FaHeart className="mx-auto text-4xl text-gray-600 mb-4" />
          <h3 className="text-xl font-medium mb-2">No favorites yet</h3>
          <p className="text-gray-400">
            Add movies and TV shows to your favorites by clicking the heart icon
          </p>
        </div>
      )}
    </div>
  );
}