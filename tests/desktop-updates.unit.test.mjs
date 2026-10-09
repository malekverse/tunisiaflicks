// The desktop app's update feed: which files of a desktop-v… release the installed apps' updater
// gets through /download/desktop-update/ (src/lib/app-releases.ts).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DESKTOP_ASSET, DESKTOP_UPDATE_FILES, pickDesktopRelease } from '@/src/lib/app-releases'

const BLOCKMAP = `${DESKTOP_ASSET}.blockmap`

const asset = (tag, name, extra = {}) => ({
  name,
  size: 1000,
  state: 'uploaded',
  browser_download_url: `https://github.com/malekverse/tunisiaflicks/releases/download/${tag}/${name}`,
  ...extra,
})

const release = (tag, names) => ({
  tag_name: tag,
  draft: false,
  prerelease: false,
  published_at: '2026-10-10T10:00:00Z',
  html_url: `https://github.com/malekverse/tunisiaflicks/releases/tag/${tag}`,
  body: '',
  assets: names.map((name) => (typeof name === 'string' ? asset(tag, name) : name)),
})

test('the updater reads latest.yml and the blockmap, besides the installer', () => {
  assert.deepEqual([...DESKTOP_UPDATE_FILES], ['latest.yml', BLOCKMAP])
})

test('a release with the updater\'s files offers them, from the same release as the installer', () => {
  const picked = pickDesktopRelease([
    release('desktop-v1.1.0', [DESKTOP_ASSET, BLOCKMAP, 'latest.yml', 'SHA256SUMS']),
    release('desktop-v1.0.0', [DESKTOP_ASSET]),
  ])
  assert.equal(picked.version, '1.1.0')
  assert.match(picked.updateFiles['latest.yml'], /\/desktop-v1\.1\.0\/latest\.yml$/)
  assert.match(picked.updateFiles[BLOCKMAP], /\/desktop-v1\.1\.0\/TunisiaFlicks-Setup\.exe\.blockmap$/)
  assert.equal(picked.updateFiles.SHA256SUMS, undefined, 'only the updater\'s files')
})

test('a release without them (1.0.0) still offers its installer, with nothing for the updater', () => {
  const picked = pickDesktopRelease([release('desktop-v1.0.0', [DESKTOP_ASSET, 'SHA256SUMS'])])
  assert.equal(picked.version, '1.0.0')
  assert.deepEqual(picked.updateFiles, {})
})

test('an update file hosted elsewhere, or still uploading, is left out', () => {
  const elsewhere = asset('desktop-v1.1.0', 'latest.yml', { browser_download_url: 'https://evil.example/latest.yml' })
  const uploading = asset('desktop-v1.1.0', BLOCKMAP, { state: 'starter' })
  const picked = pickDesktopRelease([release('desktop-v1.1.0', [DESKTOP_ASSET, elsewhere, uploading])])
  assert.deepEqual(picked.updateFiles, {})
})
