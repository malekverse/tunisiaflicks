"use client";

import { useState, useEffect } from 'react';
import { getWatchHistory } from '@/src/lib/user-content';
import { WatchHistoryItem } from '@/src/lib/models/UserContent';
import Image from 'next/image';
import Link from 'next/link';
import { FaHistory, FaFilter, FaPlay } from 'react-icons/fa';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent } from '@/src/components/ui/card';
import { toast } from '@/src/hooks/use-toast';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { Progress } from '@/src/components/ui/progress';

export default function WatchHistoryPage() {
  const { data: session, status } = useSession();
  const [watchHistory, setWatchHistory] = useState<WatchHistoryItem[]>([]);
  const [filteredHistory, setFilteredHistory] = useState<WatchHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [mediaTypeFilter, setMediaTypeFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<string>('newest');
  const [progressFilter, setProgressFilter] = useState<string>('all');

  // Redirect if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/login');
    }
  }, [status]);

  useEffect(() => {
    const fetchWatchHistory = async () => {
      if (status === 'authenticated') {
        setIsLoading(true);
        try {
          const items = await getWatchHistory();
          setWatchHistory(items);
          setFilteredHistory(items);
        } catch (error) {
          console.error('Error fetching watch history:', error);
          toast({
            title: 'Error',
            description: 'Failed to load your watch history',
            variant: 'destructive',
          });
        } finally {
          setIsLoading(false);
        }
      }
    };

    fetchWatchHistory();
  }, [status]);

  // Apply filters and sorting
  useEffect(() => {
    let result = [...watchHistory];
    
    // Apply media type filter
    if (mediaTypeFilter !== 'all') {
      result = result.filter(item => item.media_type === mediaTypeFilter);
    }
    
    // Apply progress filter
    if (progressFilter !== 'all') {
      if (progressFilter === 'completed') {
        result = result.filter(item => item.progress === 100);
      } else if (progressFilter === 'in-progress') {
        result = result.filter(item => item.progress && item.progress < 100);
      }
    }
    
    // Apply sorting
    result.sort((a, b) => {
      const dateA = new Date(a.watched_at).getTime();
      const dateB = new Date(b.watched_at).getTime();
      
      return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    });
    
    setFilteredHistory(result);
  }, [watchHistory, mediaTypeFilter, sortOrder, progressFilter]);

  if (status === 'loading') {
    return (
      <div className="container mx-auto py-10 px-4">
        <h1 className="text-3xl font-bold mb-6">My Watch History</h1>
        <div className="flex justify-center items-center h-40">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10 px-4">
      <h1 className="text-3xl font-bold mb-6">My Watch History</h1>
      
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
              value={progressFilter}
              onValueChange={setProgressFilter}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Filter by progress" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="in-progress">In Progress</SelectItem>
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
                <SelectItem value="newest">Recently Watched</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
      
      {isLoading ? (
        <div className="flex justify-center items-center h-40">
          <p>Loading watch history...</p>
        </div>
      ) : filteredHistory.length > 0 ? (
        <div className="grid grid-cols-1 gap-6">
          {filteredHistory.map(item => (
            <Card key={item.id} className="overflow-hidden bg-gray-900 border-gray-800">
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
                <CardContent className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <Link href={`/${item.media_type}/${item.id}`} className="hover:underline">
                      <h3 className="text-xl font-bold mb-2">{item.title}</h3>
                    </Link>
                    <p className="text-gray-400 text-sm mb-2">
                      {item.media_type === 'movie' ? 'Movie' : 'TV Show'}
                    </p>
                    <p className="text-gray-400 text-sm mb-2">
                      Watched on: {new Date(item.watched_at).toLocaleDateString()} at {new Date(item.watched_at).toLocaleTimeString()}
                    </p>
                    <div className="mt-2">
                      <div className="flex justify-between mb-1">
                        <span className="text-sm text-gray-400">Progress</span>
                        <span className="text-sm text-gray-400">{item.progress || 0}%</span>
                      </div>
                      <Progress value={item.progress || 0} className="h-2" />
                    </div>
                  </div>
                  <div className="flex justify-end mt-4">
                    <Link href={`/${item.media_type}/${item.id}`}>
                      <Button variant="default" size="sm">
                        <FaPlay className="mr-2" /> Watch Again
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-10 bg-gray-900 rounded-lg">
          <FaHistory className="mx-auto text-4xl text-gray-600 mb-4" />
          <h3 className="text-xl font-medium mb-2">No watch history yet</h3>
          <p className="text-gray-400">
            Your watch history will appear here after you watch movies or TV shows
          </p>
        </div>
      )}
    </div>
  );
}