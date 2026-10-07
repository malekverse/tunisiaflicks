// Visitors' browsers ping this after 18:00 (Tunis) so the daily pick push goes out without a cron
// job. It does nothing (cheaply) once today's run is done; see lib/daily-push.ts.
import { NextResponse } from 'next/server'
import { clientIp, rateLimit } from '@/src/lib/rate-limit'
import { runDailyPickPush } from '@/src/lib/daily-push'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function POST(request: Request) {
  const limit = await rateLimit(`push-daily:ip:${clientIp(request.headers)}`, 6, 60 * 60)
  if (!limit.ok) return NextResponse.json({ status: 'throttled' })
  try {
    return NextResponse.json(await runDailyPickPush())
  } catch (error) {
    console.error('Daily pick push failed:', error)
    return NextResponse.json({ status: 'error' }, { status: 500 })
  }
}
