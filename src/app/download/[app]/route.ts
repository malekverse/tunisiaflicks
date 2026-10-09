// /download/android and /download/tv: short, stable addresses on the site for the newest APKs
// (easy to type in a TV's Downloader app). They redirect to the file on GitHub; with no release
// yet, to /app.
import { NextResponse } from 'next/server'
import { getAppReleases, isAppId } from '@/src/lib/app-releases'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: { params: { app: string } }) {
  // 'android-tv' reads naturally too.
  const id = params.app === 'android-tv' ? 'tv' : params.app
  if (!isAppId(id)) return new NextResponse('Not found', { status: 404 })
  const file = (await getAppReleases())?.apps[id]
  const target = file ? file.url : new URL(`/app#${id}`, request.url).toString()
  return NextResponse.redirect(target, { status: 302, headers: { 'Cache-Control': 'no-store' } })
}
