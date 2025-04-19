// Client-side utility for managing user content interactions
import { ContentItem, WatchHistoryItem } from './models/UserContent';

// Add an item to favorites
export async function addToFavorites(item: ContentItem) {
  return addToUserContent('favorites', item);
}

// Remove an item from favorites
export async function removeFromFavorites(itemId: string) {
  return removeFromUserContent('favorites', itemId);
}

// Get user's favorites
export async function getFavorites() {
  return getUserContent('favorites');
}

// Add an item to saved list
export async function saveForLater(item: ContentItem) {
  return addToUserContent('saved', item);
}

// Remove an item from saved list
export async function removeFromSaved(itemId: string) {
  return removeFromUserContent('saved', itemId);
}

// Get user's saved items
export async function getSavedItems() {
  return getUserContent('saved');
}

// Add an item to watch history
export async function addToWatchHistory(item: ContentItem, progress?: number) {
  const historyItem = {
    ...item,
    progress: progress || 100, // Default to 100% if not specified
  };
  return addToUserContent('history', historyItem);
}

// Get user's watch history
export async function getWatchHistory() {
  return getUserContent('history');
}

// Generic function to add an item to a user content list
async function addToUserContent(type: 'favorites' | 'saved' | 'history', item: ContentItem) {
  try {
    const response = await fetch('/api/user-content', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ type, item }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to add item');
    }

    return await response.json();
  } catch (error) {
    console.error(`Error adding item to ${type}:`, error);
    throw error;
  }
}

// Generic function to remove an item from a user content list
async function removeFromUserContent(type: 'favorites' | 'saved' | 'history', itemId: string) {
  try {
    const response = await fetch(`/api/user-content?type=${type}&itemId=${itemId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `Failed to remove item from ${type}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`Error removing item from ${type}:`, error);
    throw error;
  }
}

// Generic function to get user content list
async function getUserContent(type: 'favorites' | 'saved' | 'history') {
  try {
    const response = await fetch(`/api/user-content?type=${type}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `Failed to fetch ${type}`);
    }

    const data = await response.json();
    return data.items || [];
  } catch (error) {
    console.error(`Error fetching ${type}:`, error);
    return [];
  }
}

// Check if an item is in a specific list
export async function isInUserList(type: 'favorites' | 'saved' | 'history', itemId: string): Promise<boolean> {
  try {
    const items = await getUserContent(type);
    return items.some((item: ContentItem) => item.id === itemId);
  } catch (error) {
    console.error(`Error checking if item is in ${type}:`, error);
    return false;
  }
}