// /.well-known/assetlinks.json: tells Android that the TunisiaFlicks phone app (android/phone, a
// Trusted Web Activity) belongs to this site, so Chrome shows it full screen with no address bar.
//
// Nothing to configure: the signing certificate comes from the newest Android release's notes
// (src/lib/app-releases.ts). Optional overrides:
// - ANDROID_TWA_PACKAGE: the package name (default com.tunisiaflicks.app)
// - ANDROID_TWA_SHA256: more certificate fingerprints, comma-separated (e.g. a debug key while testing)
// 404 until there's at least one fingerprint.
import { NextResponse } from 'next/server'
import { formatCertificate, getAppReleases } from '@/src/lib/app-releases'

export const dynamic = 'force-dynamic'

const PACKAGE = /^[a-zA-Z]\w*(\.[a-zA-Z]\w*)+$/

export async function GET() {
  const packageName = process.env.ANDROID_TWA_PACKAGE?.trim() || 'com.tunisiaflicks.app'
  const fingerprints = new Set(
    (process.env.ANDROID_TWA_SHA256 ?? '')
      .split(',')
      .map((value) => formatCertificate(value.trim()))
      .filter((value): value is string => value !== null),
  )
  const released = (await getAppReleases())?.certSha256
  if (released) fingerprints.add(released)

  if (!PACKAGE.test(packageName) || fingerprints.size === 0) {
    return new NextResponse('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } })
  }

  return NextResponse.json(
    [
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: { namespace: 'android_app', package_name: packageName, sha256_cert_fingerprints: Array.from(fingerprints) },
      },
    ],
    { headers: { 'Cache-Control': 'public, max-age=3600' } },
  )
}
