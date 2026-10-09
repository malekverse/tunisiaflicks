// /download/android, /download/tv and /download/desktop: short, stable addresses on the site for the
// newest APKs and the Windows installer (easy to type in a TV's Downloader app). They redirect to
// the file on GitHub; with no release yet, to the page that presents the app.
import { NextResponse } from 'next/server'
import { getAppReleases, getDesktopRelease, isAppId } from '@/src/lib/app-releases'

export const dynamic = 'force-dynamic'

const noStore = { 'Cache-Control': 'no-store' }

export async function GET(request: Request, { params }: { params: { app: string } }) {
  // 'android-tv' and 'windows' read naturally too.
  if (params.app === 'desktop' || params.app === 'windows') {
    const file = (await getDesktopRelease())?.file
    return NextResponse.redirect(file ? file.url : new URL('/desktop', request.url).toString(), { status: 302, headers: noStore })
  }
  const id = params.app === 'android-tv' ? 'tv' : params.app
  if (!isAppId(id)) return new NextResponse('Not found', { status: 404 })
  const file = (await getAppReleases())?.apps[id]
  const target = file ? file.url : new URL(`/app#${id}`, request.url).toString()
  return NextResponse.redirect(target, { status: 302, headers: noStore })
}
