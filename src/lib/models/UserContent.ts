// User content interactions model for favorites, saved items, and watch history

export interface ContentItem {
  id: string;          // TMDB ID of the movie or TV show (AniList ID for an anime)
  title: string;       // Title of the movie or TV show
  poster_path?: string; // Poster image path (TMDB), or an anime's cover URL (AniList)
  media_type: 'movie' | 'tv' | 'anime'; // Anime: favorites and saved only (its progress stays on the device)
  added_at: Date;      // When the item was added to the list
  season?: number;     // For TV history: the season last watched (enables "continue watching")
  episode?: number;    // For TV history: the episode last watched
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