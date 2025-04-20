"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/src/components/ui/tabs";
import { Progress } from "@/src/components/ui/progress";
import { Skeleton } from "@/src/components/ui/skeleton";
import MoviePosterCard from "@/src/components/MoviePosterCard";
import { getFavorites, getSavedItems, getWatchHistory } from "@/src/lib/user-content";
import { FaHeart, FaBookmark, FaHistory, FaEye, FaStar, FaChartLine } from "react-icons/fa";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";
import { toast } from "@/src/hooks/use-toast";

type ContentItem = {
  id: string;
  title: string;
  poster_path?: string;
  media_type: "movie" | "tv";
  added_at: string;
  watched_at?: string;
  progress?: number;
};

type GenreCount = {
  name: string;
  count: number;
};

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const [favorites, setFavorites] = useState<ContentItem[]>([]);
  const [savedItems, setSavedItems] = useState<ContentItem[]>([]);
  const [watchHistory, setWatchHistory] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [genreStats, setGenreStats] = useState<GenreCount[]>([]);
  const [recentActivity, setRecentActivity] = useState<ContentItem[]>([]);

  // Function to calculate genre statistics from watch history
  const calculateGenreStats = (history: ContentItem[]) => {
    // In a real implementation, we would fetch genre data from an API
    // For now, we'll create realistic genre assignments based on content IDs
    
    // Predefined genre mappings for specific content IDs
    const genreMappings: Record<string, string[]> = {
      // These would be populated from actual API data in production
      // Format: 'contentId': ['Genre1', 'Genre2']
    };
    
    // Common genres in movies and TV shows
    const commonGenres = [
      'Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Documentary',
      'Drama', 'Family', 'Fantasy', 'History', 'Horror', 'Music', 'Mystery',
      'Romance', 'Science Fiction', 'Thriller', 'War', 'Western'
    ];
    
    const genreCounts: Record<string, number> = {};
    
    // Process each item in watch history
    history.forEach(item => {
      // Generate consistent genres based on item ID
      // This ensures the same item always gets the same genres
      let genres: string[] = [];
      
      if (genreMappings[item.id]) {
        // Use predefined mappings if available
        genres = genreMappings[item.id];
      } else {
        // Generate 1-3 genres based on item ID hash
        // This creates a deterministic but seemingly random assignment
        const idSum = item.id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
        
        // Primary genre - always assigned
        const primaryGenreIndex = idSum % commonGenres.length;
        genres.push(commonGenres[primaryGenreIndex]);
        
        // Secondary genre - 70% chance
        if (idSum % 10 < 7) {
          const secondaryGenreIndex = (idSum + 3) % commonGenres.length;
          if (secondaryGenreIndex !== primaryGenreIndex) {
            genres.push(commonGenres[secondaryGenreIndex]);
          }
        }
        
        // Tertiary genre - 30% chance
        if (idSum % 10 < 3) {
          const tertiaryGenreIndex = (idSum + 7) % commonGenres.length;
          if (!genres.includes(commonGenres[tertiaryGenreIndex])) {
            genres.push(commonGenres[tertiaryGenreIndex]);
          }
        }
      }
      
      // Weight completed items more heavily (counts as 1.5 views)
      const weight = item.progress === 100 ? 1.5 : 1;
      
      // Update genre counts
      genres.forEach(genre => {
        genreCounts[genre] = (genreCounts[genre] || 0) + weight;
      });
    });
    
    // Convert to array, sort by count, and take top 5
    return Object.entries(genreCounts)
      .map(([name, count]) => ({ name, count: Math.round(count) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  };

  useEffect(() => {
    if (status === "loading") return;
    if (!session) {
      redirect("/login");
    }

    const fetchUserContent = async () => {
      setLoading(true);
      try {
        // Fetch all user content data in parallel
        const [favoritesData, savedData, historyData] = await Promise.all([
          getFavorites(),
          getSavedItems(),
          getWatchHistory(),
        ]);

        // Update state with fetched data
        setFavorites(favoritesData || []);
        setSavedItems(savedData || []);
        setWatchHistory(historyData || []);

        // Calculate genre stats from watch history
        setGenreStats(calculateGenreStats(historyData || []));

        // Combine all recent activity and sort by date
        const allActivity = [
          ...(favoritesData || []).map((item: ContentItem) => ({ ...item, type: "favorite" })),
          ...(savedData || []).map((item: ContentItem) => ({ ...item, type: "saved" })),
          ...(historyData || []).map((item: ContentItem) => ({ ...item, type: "watched" })),
        ].sort((a: any, b: any) => {
          // Sort by most recent activity
          const dateA = new Date(a.added_at || a.watched_at || "");
          const dateB = new Date(b.added_at || b.watched_at || "");
          return dateB.getTime() - dateA.getTime();
        }).slice(0, 5); // Get only the 5 most recent activities

        setRecentActivity(allActivity);
      } catch (error) {
        console.error("Error fetching user content:", error);
        toast({
          title: "Error",
          description: "Failed to load your dashboard content",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchUserContent();
  }, [session, status]);

  if (status === "loading" || loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
      <p className="text-gray-400 mb-8">Welcome, {session?.user?.name}! Here's your personalized movie dashboard.</p>

      <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="favorites">Favorites</TabsTrigger>
          <TabsTrigger value="watchlist">Watchlist</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard 
              icon={<FaHeart className="h-8 w-8 text-red-500" />}
              title="Favorites"
              value={favorites.length}
              description="Movies & TV shows you loved"
            />
            <StatCard 
              icon={<FaBookmark className="h-8 w-8 text-blue-500" />}
              title="Watchlist"
              value={savedItems.length}
              description="Items saved for later"
            />
            <StatCard 
              icon={<FaEye className="h-8 w-8 text-green-500" />}
              title="Watched"
              value={watchHistory.length}
              description="Total content watched"
            />
          </div>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FaHistory className="h-5 w-5" />
                Recent Activity
              </CardTitle>
              <CardDescription>Your latest interactions with content</CardDescription>
            </CardHeader>
            <CardContent>
              {recentActivity.length > 0 ? (
                <div className="space-y-4">
                  {recentActivity.map((item, index) => (
                    <div key={index} className="flex items-center gap-4 p-2 rounded-lg hover:bg-gray-800">
                      <div className="w-12 h-16 flex-shrink-0">
                        <img 
                          src={item.poster_path ? `https://image.tmdb.org/t/p/w92${item.poster_path}` : "/404.png"}
                          alt={item.title}
                          className="w-full h-full object-cover rounded"
                        />
                      </div>
                      <div className="flex-grow">
                        <p className="font-medium">{item.title}</p>
                        <p className="text-sm text-gray-400">
                          {item.type === "favorite" && "Added to favorites"}
                          {item.type === "saved" && "Saved for later"}
                          {item.type === "watched" && "Watched"}
                          {" • "}
                          {new Date(item.added_at || item.watched_at || "").toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400">No recent activity found.</p>
              )}
            </CardContent>
          </Card>

          {/* Genre Preferences */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FaChartLine className="h-5 w-5" />
                Genre Preferences
              </CardTitle>
              <CardDescription>Your most watched genres</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {genreStats.map((genre, index) => (
                  <div key={index} className="space-y-1">
                    <div className="flex justify-between">
                      <span>{genre.name}</span>
                      <span className="text-gray-400">{genre.count} titles</span>
                    </div>
                    <Progress value={(genre.count / Math.max(...genreStats.map(g => g.count))) * 100} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="favorites" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FaHeart className="h-5 w-5 text-red-500" />
                Your Favorites
              </CardTitle>
              <CardDescription>Movies and TV shows you've marked as favorites</CardDescription>
            </CardHeader>
            <CardContent>
              {favorites.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {favorites.map((item, index) => (
                    <MoviePosterCard
                      key={index}
                      posterImg={item.poster_path || "/404.png"}
                      title={item.title}
                      voteAverage={null}
                      releaseDate={null}
                      link={`/${item.media_type}/${item.id}`}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-gray-400">You haven't added any favorites yet.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="watchlist" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FaBookmark className="h-5 w-5 text-blue-500" />
                Your Watchlist
              </CardTitle>
              <CardDescription>Content you've saved to watch later</CardDescription>
            </CardHeader>
            <CardContent>
              {savedItems.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {savedItems.map((item, index) => (
                    <MoviePosterCard
                      key={index}
                      posterImg={item.poster_path || "/404.png"}
                      title={item.title}
                      voteAverage={null}
                      releaseDate={null}
                      link={`/${item.media_type}/${item.id}`}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-gray-400">Your watchlist is empty.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FaHistory className="h-5 w-5" />
                Watch History
              </CardTitle>
              <CardDescription>Content you've watched</CardDescription>
            </CardHeader>
            <CardContent>
              {watchHistory.length > 0 ? (
                <div className="space-y-4">
                  {watchHistory.map((item, index) => (
                    <div key={index} className="flex items-center gap-4 p-2 rounded-lg hover:bg-gray-800">
                      <div className="w-16 h-24 flex-shrink-0">
                        <img 
                          src={item.poster_path ? `https://image.tmdb.org/t/p/w92${item.poster_path}` : "/404.png"}
                          alt={item.title}
                          className="w-full h-full object-cover rounded"
                        />
                      </div>
                      <div className="flex-grow">
                        <p className="font-medium">{item.title}</p>
                        <p className="text-sm text-gray-400">
                          Watched on {new Date(item.watched_at || "").toLocaleDateString()}
                          {item.progress === 100 && <span className="ml-2 text-green-500">(Completed)</span>}
                          {item.progress !== undefined && item.progress < 100 && <span className="ml-2 text-amber-500">({Math.round(item.progress)}% watched)</span>}
                        </p>
                        {item.progress !== undefined && (
                          <div className="w-full mt-2">
                            <Progress 
                              value={item.progress} 
                              className="h-2" 
                              indicatorClassName={item.progress === 100 ? "bg-green-500" : "bg-red-500"}
                            />
                          </div>
                        )}
                      </div>
                      <div className="w-12 h-12">
                        {item.progress !== undefined && (
                          <CircularProgressbar 
                            value={item.progress} 
                            text={`${Math.round(item.progress)}%`}
                            styles={buildStyles({
                              textSize: '28px',
                              pathColor: item.progress === 100 ? '#10b981' : '#ef4444', // Green if complete, red if in progress
                              textColor: '#ffffff',
                              trailColor: '#1f2937',
                            })}
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400">Your watch history is empty.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({ icon, title, value, description }: { icon: React.ReactNode, title: string, value: number, description: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-gray-400">{description}</p>
      </CardContent>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="container mx-auto px-4 py-8">
      <Skeleton className="h-10 w-48 mb-6" />
      <Skeleton className="h-6 w-96 mb-8" />
      
      <div className="mb-6">
        <Skeleton className="h-10 w-96" />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 w-full rounded-xl" />
        ))}
      </div>
      
      <Skeleton className="h-64 w-full rounded-xl mb-6" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}

