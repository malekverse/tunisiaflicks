// Follow / unfollow titles for release and new-episode alerts. Always scoped to the signed-in user.
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/src/lib/auth';
import { TmdbError } from '@/src/lib/tmdb';
import { alertCollections, fetchTitleSnapshot, hasReleased, isFollowMediaType, isTmdbId } from '@/src/lib/follows';
import type { Follow, FollowItem } from '@/src/lib/models/Follow';

export const dynamic = 'force-dynamic';

const MAX_FOLLOWS = 500;

async function getUserId() {
  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
}

function toItem(follow: Follow): FollowItem {
  return {
    media_type: follow.media_type,
    id: follow.tmdbId,
    title: follow.title,
    poster_path: follow.poster_path ?? null,
    release_date: follow.release_date ?? null,
    released: follow.media_type === 'movie' && hasReleased(follow.release_date),
    last_episode: follow.last_episode ?? null,
    created_at: new Date(follow.created_at).toISOString(),
  };
}

// GET: the user's followed titles, newest first
export async function GET() {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { follows } = await alertCollections();
    const items = await follows.find({ userId }).sort({ created_at: -1 }).limit(MAX_FOLLOWS).toArray();
    return NextResponse.json({ items: items.map(toItem) });
  } catch (error) {
    console.error('Error fetching follows:', error);
    return NextResponse.json({ error: 'Failed to fetch follows' }, { status: 500 });
  }
}

// POST { media_type, id }: follow a title. Title, poster and alert markers come from TMDB, not the client.
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const mediaType = body?.media_type;
    const tmdbId = body?.id === undefined || body?.id === null ? undefined : String(body.id);
    if (!isFollowMediaType(mediaType) || !isTmdbId(tmdbId)) {
      return NextResponse.json({ error: 'Invalid title' }, { status: 400 });
    }

    const { follows } = await alertCollections();
    const existing = await follows.findOne({ userId, media_type: mediaType, tmdbId });
    if (existing) {
      return NextResponse.json({ success: true, item: toItem(existing) });
    }
    if (await follows.countDocuments({ userId }) >= MAX_FOLLOWS) {
      return NextResponse.json({ error: `You can follow up to ${MAX_FOLLOWS} titles` }, { status: 400 });
    }

    let snapshot;
    try {
      snapshot = await fetchTitleSnapshot(mediaType, tmdbId);
    } catch (error) {
      if (error instanceof TmdbError && error.status === 404) {
        return NextResponse.json({ error: 'Title not found' }, { status: 404 });
      }
      throw error;
    }

    const now = new Date();
    const follow: Follow = {
      userId,
      media_type: mediaType,
      tmdbId,
      title: snapshot.title,
      poster_path: snapshot.poster_path,
      created_at: now,
      checked_at: now,
      ...(mediaType === 'movie'
        // Already out: nothing left to announce, so mark it as notified straight away.
        ? { release_date: snapshot.release_date, released_notified_at: hasReleased(snapshot.release_date) ? now : null }
        // Only episodes that air after following are announced.
        : { last_episode: snapshot.last_episode ? { season: snapshot.last_episode.season, episode: snapshot.last_episode.episode, air_date: snapshot.last_episode.air_date } : null }),
    };

    // Upsert keyed on the unique index, so a double click can't create two follows.
    await follows.updateOne(
      { userId, media_type: mediaType, tmdbId },
      { $setOnInsert: follow },
      { upsert: true }
    );
    const saved = await follows.findOne({ userId, media_type: mediaType, tmdbId });

    return NextResponse.json({ success: true, item: toItem(saved ?? follow) });
  } catch (error) {
    console.error('Error following title:', error);
    return NextResponse.json({ error: 'Failed to follow' }, { status: 500 });
  }
}

// DELETE ?media_type=movie|tv&id=123: unfollow a title
export async function DELETE(request: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const mediaType = searchParams.get('media_type');
    const tmdbId = searchParams.get('id');
    if (!isFollowMediaType(mediaType) || !isTmdbId(tmdbId)) {
      return NextResponse.json({ error: 'Invalid title' }, { status: 400 });
    }

    const { follows } = await alertCollections();
    const result = await follows.deleteOne({ userId, media_type: mediaType, tmdbId });
    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Not following this title' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error unfollowing title:', error);
    return NextResponse.json({ error: 'Failed to unfollow' }, { status: 500 });
  }
}
