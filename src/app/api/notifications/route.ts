// In-app release / new-episode notifications (the navbar bell). Always scoped to the signed-in user.
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/src/lib/auth';
import { alertCollections } from '@/src/lib/follows';
import type { NotificationItem } from '@/src/lib/models/Follow';

export const dynamic = 'force-dynamic';

async function getUserId() {
  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
}

// GET: the latest notifications and how many are unread
export async function GET() {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { notifications } = await alertCollections();
    const [docs, unread] = await Promise.all([
      notifications.find({ userId }).sort({ created_at: -1 }).limit(20).toArray(),
      notifications.countDocuments({ userId, read: false }),
    ]);

    const items: NotificationItem[] = docs.map((doc) => ({
      id: doc._id.toString(),
      media_type: doc.media_type,
      tmdbId: doc.tmdbId,
      title: doc.title,
      poster_path: doc.poster_path ?? null,
      kind: doc.kind,
      episode: doc.episode ?? null,
      created_at: new Date(doc.created_at).toISOString(),
      read: doc.read,
    }));

    return NextResponse.json({ items, unread });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
  }
}

// PATCH: mark every notification as read
export async function PATCH() {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { notifications } = await alertCollections();
    await notifications.updateMany({ userId, read: false }, { $set: { read: true } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error marking notifications as read:', error);
    return NextResponse.json({ error: 'Failed to update notifications' }, { status: 500 });
  }
}
