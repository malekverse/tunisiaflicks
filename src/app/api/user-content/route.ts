// API route for user content interactions (favorites, saved, watch history)
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/src/lib/auth';
import clientPromise from '@/src/lib/mongodb';
import { ObjectId } from 'mongodb';
import { ContentItem, WatchHistoryItem } from '@/src/lib/models/UserContent';

// Helper function to get user ID from session
async function getUserId() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return null;
  }
  return session.user.id;
}

// GET handler for retrieving user content lists
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { type, item } = await request.json();

    if (!type || !['favorites', 'saved', 'history'].includes(type)) {
      return NextResponse.json({ error: 'Invalid list type' }, { status: 400 });
    }

    if (!item || !item.id || !item.title || !item.media_type) {
      return NextResponse.json({ error: 'Invalid item data' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db();
    const userContentCollection = db.collection('userContent');

    // Prepare the content item
    const contentItem: ContentItem = {
      id: item.id,
      title: item.title,
      poster_path: item.poster_path,
      media_type: item.media_type,
      added_at: new Date()
    };

    // Add watched_at for history items
    if (type === 'history') {
      (contentItem as WatchHistoryItem).watched_at = new Date();
      if (item.progress) {
        (contentItem as WatchHistoryItem).progress = item.progress;
      }
    }

    // Update or insert the item in the user's content list
    const result = await userContentCollection.updateOne(
      { userId: userId, type: type },
      {
        $setOnInsert: { userId: userId, type: type },
        $pull: { items: { id: item.id } } // Remove if exists to avoid duplicates
      },
      { upsert: true }
    );

    // Add the item to the array (now that we've removed any duplicate)
    await userContentCollection.updateOne(
      { userId: userId, type: type },
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
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    // Remove the item from the user's content list
    const result = await userContentCollection.updateOne(
      { userId: userId, type: type },
      { $pull: { items: { id: itemId } } }
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