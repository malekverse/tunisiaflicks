// API route for user content interactions (favorites, saved, watch history)
import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/src/lib/mongodb';
import { ContentItem, WatchHistoryItem } from '@/src/lib/models/UserContent';
import { requireActiveProfile } from '@/src/lib/profiles';
import { cleanText } from '@/src/lib/lists-db';
import { forgetTitle, recordPlay } from '@/src/lib/badges/activity';
import { safeTimeZone } from '@/src/lib/badges/time';

// Every list belongs to one profile of the signed-in user: the active profile from the profile
// cookie, checked against the session user's own profiles (see lib/profiles.ts).

const isEpisodeNumber = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 999

type ParsedItem = { id: string, title: string, poster_path: string | null, media_type: 'movie' | 'tv' | 'anime', season?: number, episode?: number, progress?: number }

type MediaType = ParsedItem['media_type']
const isMediaType = (value: unknown): value is MediaType => value === 'movie' || value === 'tv' || value === 'anime'
/** An anime's cover: AniList's image server only (a TMDB title's poster is a path, like "/abc.jpg"). */
const ANILIST_COVER = /^https:\/\/s4\.anilist\.co\/file\/anilistcdn\/[A-Za-z0-9/._-]+$/

/**
 * The entries an add replaces or a remove takes out: the same id and the same kind (an anime and
 * a movie can share an id number). Older entries saved without a kind still match by id.
 */
const sameEntry = (ids: (string | number)[], mediaType: MediaType) =>
  ({ id: { $in: ids }, $or: [{ media_type: mediaType }, { media_type: { $exists: false } }] })

/**
 * The item as the client sent it, checked field by field (these titles are shown back on other
 * pages, and later to other people): null when anything is malformed. The same rules as lists
 * (toListItem in lib/lists-db.ts); scripts/clean-user-content.mjs applies them to older data.
 */
function parseItem(raw: any): ParsedItem | null {
  if (!raw || typeof raw !== 'object') return null
  const id = typeof raw.id === 'number' ? String(raw.id) : raw.id
  if (typeof id !== 'string' || !/^[0-9]{1,9}$/.test(id)) return null
  if (!isMediaType(raw.media_type)) return null
  const title = cleanText(raw.title, 200)
  if (!title) return null
  const poster = raw.poster_path ?? null
  const posterPattern = raw.media_type === 'anime' ? ANILIST_COVER : /^[/][A-Za-z0-9._-]+$/
  if (poster !== null && (typeof poster !== 'string' || !posterPattern.test(poster))) return null
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
    // An anime's progress lives on the device (components/anime): it only goes to favorites and saved.
    if (!item || (item.media_type === 'anime' && type === 'history')) {
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
        $pull: { items: sameEntry([item.id, Number(item.id)], item.media_type) } as any
      },
      { upsert: true }
    );

    // Add the item to the array (now that we've removed any duplicate)
    await userContentCollection.updateOne(
      { userId: userId, profileId: profileId, type: type },
      { $push: { items: { $each: [contentItem], $position: 0 } } } // Add to beginning of array
    );

    // Badges: the day of this play goes into the profile's private log (skipped when the profile
    // turned badges off). The browser's time zone only places the play on a day; it isn't kept.
    if (type === 'history' && item.media_type !== 'anime') {
      try {
        await recordPlay({ userId, profileId }, { ...item, media_type: item.media_type }, { timeZone: safeTimeZone(body?.item?.tz), kids: owner.profile.kids });
      } catch (error) {
        console.error('Recording the play for badges failed:', error);
      }
    }

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
    // Its kind, so an anime and a movie with the same id number aren't both removed (older
    // clients don't send it: then every entry with that id goes, as before).
    const mediaType = searchParams.get('mediaType');

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
      { $pull: { items: isMediaType(mediaType) ? sameEntry(ids, mediaType) : { id: { $in: ids } } } as any }
    );

    // Badges: a title taken out of the history leaves the daily log too.
    if (type === 'history') {
      try {
        await forgetTitle({ userId, profileId }, itemId);
      } catch (error) {
        console.error('Forgetting the title for badges failed:', error);
      }
    }

    if (result.modifiedCount === 0) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: `Item removed from ${type}` });
  } catch (error) {
    console.error('Error removing item from user content:', error);
    return NextResponse.json({ error: 'Failed to remove item' }, { status: 500 });
  }
}