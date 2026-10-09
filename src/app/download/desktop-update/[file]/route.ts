// /download/desktop-update/<file>: the update feed of the installed desktop app (desktop/updater.js,
// electron-updater's generic provider). latest.yml, the installer and its blockmap redirect to the
// newest desktop-v… release on GitHub (src/lib/app-releases.ts). The updater resolves the
// installer's name in latest.yml against this folder, so all three live here. Anything else, or a
// release without the file (1.0.0 has no latest.yml), is a 404: the app reports "couldn't check".
import { NextResponse } from 'next/server'
import { DESKTOP_ASSET, DESKTOP_UPDATE_FILES, getDesktopRelease } from '@/src/lib/app-releases'

export const dynamic = 'force-dynamic'

const noStore = { 'Cache-Control': 'no-store' }

export async function GET(_request: Request, { params }: { params: { file: string } }) {
  const name = params.file
  if (name !== DESKTOP_ASSET && !(DESKTOP_UPDATE_FILES as readonly string[]).includes(name)) {
    return new NextResponse('Not found', { status: 404, headers: noStore })
  }
  const release = await getDesktopRelease()
  const target = name === DESKTOP_ASSET ? release?.file.url : release?.updateFiles[name]
  if (!target) return new NextResponse('Not found', { status: 404, headers: noStore })
  return NextResponse.redirect(target, { status: 302, headers: noStore })
}
