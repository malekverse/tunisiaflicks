// API route for user content interactions (favorites, saved, watch history)
import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/src/lib/mongodb';
import { ContentItem, WatchHistoryItem } from '@/src/lib/models/UserContent';
import { requireActiveProfile } from '@/src/lib/profiles';
import { cleanText } from '@/src/lib/lists-db';

// Every list belongs to one profile of the signed-in user: the active profile from the profile
// cookie, checked against the session user's own profiles (see lib/profiles.ts).

const isEpisodeNumber = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 999

type ParsedItem = { id: string, title: string, poster_path: string | null, media_type: 'movie' | 'tv', season?: number, episode?: number, progress?: number }

/**
 * The item as the client sent it, checked field by field (these titles are shown back on other
 * pages, and later to other people): null when anything is malformed. The same rules as lists
 * (toListItem in lib/lists-db.ts); scripts/clean-user-content.mjs applies them to older data.
 */
function parseItem(raw: any): ParsedItem | null {
  if (!raw || typeof raw !== 'object') return null
  const id = typeof raw.id === 'number' ? String(raw.id) : raw.id
  if (typeof id !== 'string' || !/^[0-9]{1,9}$/.test(id)) return null
  if (raw.media_type !== 'movie' && raw.media_type !== 'tv') return null
  const title = cleanText(raw.title, 200)
  if (!title) return null
  const poster = raw.poster_path ?? null
  if (poster !== null && (typeof poster !== 'string' || !/^[/][A-Za-z0-9._-]+$/.test(poster))) return null
  const item: ParsedItem = { id, title, poster_path: poster, media_type: raw.media_type }
  if (raw.season !== undefined || raw.episode !== undefined) {
    if (!isEpisodeNumber(raw.season) || !isEpisodeNumber(raw.episode)) return null
    item.season = raw.season
    item.episode = raw.episode
  }
  // Optional and only informative: kept when it's a sensible percentage.
  if (typeof raw.progress === 'number' && Number.isFinite(raw.progress) && raw.progress >= 0 && raw.progress <= 100) {
    item.progress = raw.progress
  }
  return item
}

// GET handler for retrieving user content lists
export async function GET(request: NextRequest) {
  try {
    const owner = await requireActiveProfile();
    if ('error' in owner) return owner.error;
    const userId = owner.userId;
    const profileId = owner.profile.id;

    const searchParams = request.nextUrl.searchParams;
    const listType = searchParams.get('type'); // 'favorites', 'saved', or 'history'

    if (!listType || !['favorites', 'saved', 'history'].includes(listType)) {
      return NextResponse.json({ error: 'Invalid list type' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db();
    const userContentCollection = db.collection('userContent');

    // Find the user's content list
    const userContent = await userContentCollection.findOne({
      userId: userId,
      profileId: profileId,
      type: listType
    });

    if (!userContent) {
      // If no list exists yet, return an empty list
      return NextResponse.json({ items: [] });
    }

    return NextResponse.json({ items: userContent.items || [] });
  } catch (error) {
    console.error(`Error fetching user ${request.nextUrl.searchParams.get('type')}:`, error);
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
  }
}

// POST handler for adding items to user content lists
export async function POST(request: NextRequest) {
  try {
    const owner = await requireActiveProfile();
    if ('error' in owner) return owner.error;
    const userId = owner.userId;
    const profileId = owner.profile.id;

    const body = await request.json().catch(() => null);
    const type = body?.type;

    if (!type || !['favorites', 'saved', 'history'].includes(type)) {
      return NextResponse.json({ error: 'Invalid list type' }, { status: 400 });
    }

    const item = parseItem(body?.item);
    if (!item) {
      return NextResponse.json({ error: 'Invalid item data' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db();
    const userContentCollection = db.collection('userContent');

    // Prepare the content item
    const contentItem: ContentItem = {
      id: item.id,
      title: item.title,
      // Stored as before (absent rather than null when there is no poster).
      poster_path: item.poster_path ?? undefined,
      media_type: item.media_type,
      added_at: new Date()
    };

    // Add watched_at for history items
    if (type === 'history') {
      (contentItem as WatchHistoryItem).watched_at = new Date();
      if (item.progress) {
        (contentItem as WatchHistoryItem).progress = item.progress;
      }
      // TV: remember the episode so "Continue Watching" can resume it.
      if (item.season !== undefined && item.episode !== undefined) {
        contentItem.season = item.season;
        contentItem.episode = item.episode;
      }
    }

    // Update or insert the item in the user's content list
    await userContentCollection.updateOne(
      { userId: userId, profileId: profileId, type: type },
      {
        $setOnInsert: { userId: userId, profileId: profileId, type: type },
        // Remove if exists to avoid duplicates (older entries may hold the id as a number).
        $pull: { items: { id: { $in: [item.id, Number(item.id)] } } } as any
      },
      { upsert: true }
    );

    // Add the item to the array (now that we've removed any duplicate)
    await userContentCollection.updateOne(
      { userId: userId, profileId: profileId, type: type },
      { $push: { items: { $each: [contentItem], $position: 0 } } } // Add to beginning of array
    );

    return NextResponse.json({ success: true, message: `Item added to ${type}` });
  } catch (error) {
    console.error('Error adding item to user content:', error);
    return NextResponse.json({ error: 'Failed to add item' }, { status: 500 });
  }
}

// DELETE handler for removing items from user content lists
export async function DELETE(request: NextRequest) {
  try {
    const owner = await requireActiveProfile();
    if ('error' in owner) return owner.error;
    const userId = owner.userId;
    const profileId = owner.profile.id;

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type'); // 'favorites', 'saved', or 'history'
    const itemId = searchParams.get('itemId'); // ID of the item to remove

    if (!type || !['favorites', 'saved', 'history'].includes(type)) {
      return NextResponse.json({ error: 'Invalid list type' }, { status: 400 });
    }

    if (!itemId) {
      return NextResponse.json({ error: 'Item ID is required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db();
    const userContentCollection = db.collection('userContent');

    // Remove the item from the user's content list (older entries may hold the id as a number).
    const ids: (string | number)[] = /^[0-9]{1,9}$/.test(itemId) ? [itemId, Number(itemId)] : [itemId];
    const result = await userContentCollection.updateOne(
      { userId: userId, profileId: profileId, type: type },
      { $pull: { items: { id: { $in: ids } } } as any }
    );

    if (result.modifiedCount === 0) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: `Item removed from ${type}` });
  } catch (error) {
    console.error('Error removing item from user content:', error);
    return NextResponse.json({ error: 'Failed to remove item' }, { status: 500 });
  }
}