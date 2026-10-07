// app/api/user/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { ObjectId } from 'mongodb';
import { authOptions } from '@/src/lib/auth';
import clientPromise from '@/src/lib/mongodb';

export const dynamic = 'force-dynamic';

// Returns the public profile of the *signed-in* user only. It never takes a user id from the
// request and never returns the full document (which contains the password hash).
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await clientPromise;
    const user = await client
      .db()
      .collection('users')
      .findOne({ _id: new ObjectId(session.user.id) }, { projection: { name: 1, image: 1 } });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json(
      { user: { name: user.name ?? null, image: user.image ?? null } },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (error) {
    console.error('Error fetching user data:', error);
    return NextResponse.json({ error: 'Failed to fetch user data' }, { status: 500 });
  }
}
