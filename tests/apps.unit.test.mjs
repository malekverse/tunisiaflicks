// The apps: reading the GitHub releases (src/lib/app-releases.ts) and telling devices apart
// (src/lib/device-platform.ts).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DESKTOP_ASSET, formatCertificate, pickDesktopRelease, pickRelease, readNotes } from '@/src/lib/app-releases'
import { detectPlatform, isMacSafari, isSmartTvBrowser } from '@/src/lib/device-platform'

const SHA_A = 'a'.repeat(64)
const SHA_T = 'b'.repeat(64)
const CERT = 'C'.repeat(2) + ':' + Array.from({ length: 31 }, () => 'D4').join(':')

const notes = [
  'TunisiaFlicks for Android phones and for Android TV / TV boxes, version 1.2.0.',
  '',
  `- tunisiaflicks-android.apk SHA-256: \`${SHA_A}\``,
  `- tunisiaflicks-tv.apk SHA-256: \`${SHA_T.toUpperCase()}\``,
  `- Signing certificate SHA-256: \`${CERT}\``,
].join('\n')

const asset = (name, size = 2_000_000) => ({ name, size, state: 'uploaded', browser_download_url: `https://github.com/malekverse/tunisiaflicks/releases/download/android-v1.2.0/${name}` })

const release = (tag, extra = {}) => ({
  tag_name: tag,
  draft: false,
  prerelease: false,
  published_at: '2026-10-09T10:00:00Z',
  html_url: `https://github.com/malekverse/tunisiaflicks/releases/tag/${tag}`,
  body: notes,
  assets: [asset('tunisiaflicks-android.apk'), asset('tunisiaflicks-tv.apk', 1_500_000), asset('SHA256SUMS', 200)],
  ...extra,
})

test('the release notes give each file its checksum, and the certificate', () => {
  const read = readNotes(notes)
  assert.equal(read.files['tunisiaflicks-android.apk'], SHA_A)
  assert.equal(read.files['tunisiaflicks-tv.apk'], SHA_T, 'lower-cased')
  assert.equal(read.cert, CERT)
  assert.deepEqual(readNotes('nothing here'), { files: {}, cert: null })
})

test('certificates are written AB:CD:… whatever their spelling', () => {
  assert.equal(formatCertificate('ab'.repeat(32)), Array.from({ length: 32 }, () => 'AB').join(':'))
  assert.equal(formatCertificate('not a fingerprint'), null)
})

test('the newest android-v release wins; drafts, pre-releases and other tags are skipped', () => {
  const picked = pickRelease([
    release('desktop-v9.0.0'),
    release('android-v2.0.0', { draft: true }),
    release('android-v1.9.0', { prerelease: true }),
    release('android-v1.2.0'),
    release('android-v1.1.0'),
  ])
  assert.equal(picked.version, '1.2.0')
  assert.equal(picked.apps.android.sha256, SHA_A)
  assert.equal(picked.apps.android.size, 2_000_000)
  assert.equal(picked.apps.tv.sha256, SHA_T)
  assert.equal(picked.certSha256, CERT)
  assert.match(picked.releaseUrl, /^https:\/\/github\.com\//)
})

test('a release offers only the files it has; one without APKs, or with odd links, is passed over', () => {
  const tvOnly = pickRelease([release('android-v1.0.0', { assets: [asset('tunisiaflicks-tv.apk')] })])
  assert.equal(tvOnly.apps.android, undefined)
  assert.ok(tvOnly.apps.tv)
  assert.equal(pickRelease([release('android-v1.0.0', { assets: [asset('SHA256SUMS')] })]), null)
  const elsewhere = { ...asset('tunisiaflicks-android.apk'), browser_download_url: 'https://evil.example/app.apk' }
  assert.equal(pickRelease([release('android-v1.0.0', { assets: [elsewhere] })]), null)
  assert.equal(pickRelease(null), null)
  assert.equal(pickRelease({ message: 'API rate limit exceeded' }), null)
})

const SHA_W = 'c'.repeat(64)
const desktopRelease = (tag, extra = {}) => release(tag, {
  body: `TunisiaFlicks for Windows.\n\n- ${DESKTOP_ASSET} SHA-256: \`${SHA_W}\``,
  assets: [asset(DESKTOP_ASSET, 90_000_000), asset('SHA256SUMS', 100)],
  ...extra,
})

test('the newest desktop-v release with its installer wins; Android releases, drafts and pre-releases are skipped', () => {
  const picked = pickDesktopRelease([
    release('android-v3.0.0'),
    desktopRelease('desktop-v2.0.0', { draft: true }),
    desktopRelease('desktop-v1.9.0', { prerelease: true }),
    desktopRelease('desktop-v1.2.0'),
    desktopRelease('desktop-v1.1.0'),
  ])
  assert.equal(picked.version, '1.2.0')
  assert.equal(picked.file.sha256, SHA_W)
  assert.equal(picked.file.size, 90_000_000)
  assert.match(picked.file.url, /^https:\/\/github\.com\/.+\/TunisiaFlicks-Setup\.exe$/)
  assert.match(picked.releaseUrl, /^https:\/\/github\.com\//)
  // And the Android lookup never picks a desktop release.
  assert.equal(pickRelease([desktopRelease('desktop-v1.2.0')]), null)
})

test('a desktop release without its installer, or with an odd link, is passed over', () => {
  assert.equal(pickDesktopRelease([desktopRelease('desktop-v1.0.0', { assets: [asset('SHA256SUMS')] })]), null)
  const elsewhere = { ...asset(DESKTOP_ASSET), browser_download_url: 'https://evil.example/setup.exe' }
  assert.equal(pickDesktopRelease([desktopRelease('desktop-v1.0.0', { assets: [elsewhere] })]), null)
  const fallback = pickDesktopRelease([desktopRelease('desktop-v1.1.0', { assets: [] }), desktopRelease('desktop-v1.0.0')])
  assert.equal(fallback.version, '1.0.0')
  assert.equal(pickDesktopRelease(null), null)
  assert.equal(pickDesktopRelease({ message: 'API rate limit exceeded' }), null)
})

const UA = {
  pixel: 'Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36',
  googleTv: 'Mozilla/5.0 (Linux; Android 12; Chromecast) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
  fireTv: 'Mozilla/5.0 (Linux; Android 9; AFTMM Build/PS7633) AppleWebKit/537.36 (KHTML, like Gecko) Silk/120 like Chrome/120.0 Safari/537.36',
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
  ipadDesktop: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15',
  windows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0',
  macChrome: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
  linux: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
  chromebook: 'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
  samsungTv: 'Mozilla/5.0 (SMART-TV; LINUX; Tizen 7.0) AppleWebKit/537.36 (KHTML, like Gecko) 94.0.4606.31/7.0 TV Safari/537.36',
  lgTv: 'Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.128 Safari/537.36 WebAppManager',
}

test('devices are told apart by their user agent', () => {
  assert.equal(detectPlatform({ userAgent: UA.pixel }), 'android')
  assert.equal(detectPlatform({ userAgent: UA.googleTv }), 'android-tv')
  assert.equal(detectPlatform({ userAgent: UA.fireTv }), 'android-tv')
  assert.equal(detectPlatform({ userAgent: UA.pixel, likelyTv: true }), 'android-tv', 'a box that looks like a phone, but acts like a TV')
  assert.equal(detectPlatform({ userAgent: UA.iphone }), 'ios')
  assert.equal(detectPlatform({ userAgent: UA.ipadDesktop, maxTouchPoints: 5 }), 'ios', 'an iPad asking for the desktop site')
  assert.equal(detectPlatform({ userAgent: UA.ipadDesktop, maxTouchPoints: 0 }), 'mac')
  assert.equal(detectPlatform({ userAgent: UA.windows }), 'windows')
  assert.equal(detectPlatform({ userAgent: UA.macChrome }), 'mac')
  assert.equal(detectPlatform({ userAgent: UA.linux }), 'linux')
  assert.equal(detectPlatform({ userAgent: UA.chromebook }), 'chromeos')
  assert.equal(detectPlatform({ userAgent: UA.samsungTv }), 'smart-tv', 'a Samsung TV says Linux too, but it is no computer')
  assert.equal(detectPlatform({ userAgent: UA.lgTv }), 'smart-tv')
  assert.equal(detectPlatform({ userAgent: '' }), 'other')
})

test('Samsung and LG TV browsers are smart TVs; Android TVs and computers are not', () => {
  assert.equal(isSmartTvBrowser(UA.samsungTv), true)
  assert.equal(isSmartTvBrowser(UA.lgTv), true)
  assert.equal(isSmartTvBrowser(UA.googleTv), false, 'an Android TV gets the app instead')
  assert.equal(isSmartTvBrowser(UA.linux), false)
})

test('Safari on a Mac is Safari, Chrome on a Mac is not', () => {
  assert.equal(isMacSafari(UA.ipadDesktop), true)
  assert.equal(isMacSafari(UA.macChrome), false)
  assert.equal(isMacSafari(UA.windows), false)
})
