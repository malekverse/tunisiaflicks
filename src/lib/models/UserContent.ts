// User content interactions model for favorites, saved items, and watch history

export interface ContentItem {
  id: string;          // TMDB ID of the movie or TV show
  title: string;       // Title of the movie or TV show
  poster_path?: string; // Poster image path
  media_type: 'movie' | 'tv'; // Type of content (movie or TV show)
  added_at: Date;      // When the item was added to the list
}

export interface UserFavorites {
  userId: string;      // Reference to the user
  items: ContentItem[];
}

export interface UserSaved {
  userId: string;      // Reference to the user
  items: ContentItem[];
}

export interface WatchHistoryItem extends ContentItem {
  watched_at: Date;   // When the content was watched
  progress?: number;  // Optional: percentage watched (0-100)
}

export interface UserWatchHistory {
  userId: string;      // Reference to the user
  items: WatchHistoryItem[];
}