// /.well-known/assetlinks.json: proves to Android that the Google Play app (a Trusted Web Activity,
// android/twa/) belongs to this site, so it opens full screen with no browser bar.
//
// Built from the environment, 404 until both are set:
// - ANDROID_TWA_PACKAGE: the app's package name (com.tunisiaflicks.app)
// - ANDROID_TWA_SHA256: the signing certificate's SHA-256 fingerprints, comma-separated (the Play
//   App Signing key from the Play Console, plus the upload key while testing). See docs/play-store.md.
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const PACKAGE = /^[a-zA-Z][\w]*(\.[a-zA-Z][\w]*)+$/
const FINGERPRINT = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/

/** 'ab:cd…' or 'ABCD…' (64 hex digits) as 'AB:CD:…', or null when it isn't a SHA-256. */
function fingerprint(value: string): string | null {
  const hex = value.replace(/[^a-fA-F0-9]/g, '').toUpperCase()
  if (hex.length !== 64) return null
  const formatted = hex.match(/.{2}/g)!.join(':')
  return FINGERPRINT.test(formatted) ? formatted : null
}

export function GET() {
  const packageName = process.env.ANDROID_TWA_PACKAGE?.trim() ?? ''
  const fingerprints = (process.env.ANDROID_TWA_SHA256 ?? '')
    .split(',')
    .map((value) => fingerprint(value.trim()))
    .filter((value): value is string => value !== null)

  if (!PACKAGE.test(packageName) || fingerprints.length === 0) {
    return new NextResponse('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } })
  }

  return NextResponse.json(
    [
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: { namespace: 'android_app', package_name: packageName, sha256_cert_fingerprints: fingerprints },
      },
    ],
    { headers: { 'Cache-Control': 'public, max-age=3600' } },
  )
}
