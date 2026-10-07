// Daily release / new-episode alerts, triggered by Vercel Cron (see vercel.json).
// Vercel sends "Authorization: Bearer $CRON_SECRET" when the CRON_SECRET env var is set.
import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { runReleaseAlerts } from '@/src/lib/release-alerts';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // never run unprotected
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(request.headers.get('authorization') ?? '');
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Leave headroom under maxDuration to finish the email in flight and answer.
    const stats = await runReleaseAlerts({ deadline: Date.now() + 45_000 });
    console.log('Release alerts run:', stats);
    return NextResponse.json({ success: true, ...stats });
  } catch (error) {
    console.error('Release alerts run failed:', error);
    return NextResponse.json({ error: 'Release alerts run failed' }, { status: 500 });
  }
}
