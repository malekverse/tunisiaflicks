// The Android apps the site offers, found by itself: the newest "android-v…" release of this
// repository on GitHub (published by .github/workflows/android-apps.yml). Nothing to configure:
// push a tag, and within the hour /app, the offers and /download/… serve the new version.
//
// - APP_RELEASES_REPO: owner/name of the repository (default malekverse/tunisiaflicks).
// The GitHub API answer is cached for an hour (60 unauthenticated calls an hour are plenty).

export type AppId = 'android' | 'tv'

export const APP_IDS: readonly AppId[] = ['android', 'tv']

/** The file each app is published as. */
export const APP_ASSETS: Record<AppId, string> = {
  android: 'tunisiaflicks-android.apk',
  tv: 'tunisiaflicks-tv.apk',
}

export type AppFile = {
  /** Where the file downloads from (GitHub's release asset). */
  url: string
  /** In bytes. */
  size: number
  /** 64 lowercase hex digits, from the release notes; null when they don't say. */
  sha256: string | null
}

export type AppReleases = {
  version: string
  publishedAt: string
  /** The release page on GitHub. */
  releaseUrl: string
  /** The signing certificate's SHA-256, as AB:CD:… (the same for every release). */
  certSha256: string | null
  apps: Partial<Record<AppId, AppFile>>
}

type GithubAsset = { name?: unknown; browser_download_url?: unknown; size?: unknown; state?: unknown }
type GithubRelease = { tag_name?: unknown; draft?: unknown; prerelease?: unknown; published_at?: unknown; html_url?: unknown; body?: unknown; assets?: unknown }

const TAG = /^android-v(\d+\.\d+\.\d+)$/
const HTTPS_GITHUB = /^https:\/\/github\.com\//

export const isAppId = (value: unknown): value is AppId => value === 'android' || value === 'tv'

/** 'AB:CD:…' from any spelling of a SHA-256 (with or without colons, any case), or null. */
export function formatCertificate(value: string): string | null {
  const hex = value.replace(/[^a-fA-F0-9]/g, '').toUpperCase()
  return hex.length === 64 ? hex.match(/.{2}/g)!.join(':') : null
}

/**
 * The checksums the workflow writes in the release notes:
 *   - tunisiaflicks-android.apk SHA-256: `…`
 *   - Signing certificate SHA-256: `…`
 */
export function readNotes(body: string): { files: Record<string, string>, cert: string | null } {
  const files: Record<string, string> = {}
  for (const match of body.matchAll(/([\w.-]+\.apk) SHA-256: `([0-9a-fA-F]{64})`/g)) files[match[1]] = match[2].toLowerCase()
  const cert = /Signing certificate SHA-256: `([0-9A-Fa-f:]{64,95})`/.exec(body)
  return { files, cert: cert ? formatCertificate(cert[1]) : null }
}

/** The newest published android-v… release among `releases` (GitHub lists them newest first), as AppReleases. */
export function pickRelease(releases: unknown): AppReleases | null {
  if (!Array.isArray(releases)) return null
  for (const raw of releases as GithubRelease[]) {
    if (!raw || raw.draft || raw.prerelease || typeof raw.tag_name !== 'string') continue
    const tag = TAG.exec(raw.tag_name)
    if (!tag) continue
    const notes = readNotes(typeof raw.body === 'string' ? raw.body : '')
    const apps: Partial<Record<AppId, AppFile>> = {}
    for (const asset of (Array.isArray(raw.assets) ? raw.assets : []) as GithubAsset[]) {
      const id = APP_IDS.find((app) => APP_ASSETS[app] === asset?.name)
      if (!id || asset.state === 'starter') continue
      if (typeof asset.browser_download_url !== 'string' || !HTTPS_GITHUB.test(asset.browser_download_url)) continue
      apps[id] = {
        url: asset.browser_download_url,
        size: typeof asset.size === 'number' ? asset.size : 0,
        sha256: notes.files[APP_ASSETS[id]] ?? null,
      }
    }
    if (Object.keys(apps).length === 0) continue
    return {
      version: tag[1],
      publishedAt: typeof raw.published_at === 'string' ? raw.published_at : '',
      releaseUrl: typeof raw.html_url === 'string' && HTTPS_GITHUB.test(raw.html_url) ? raw.html_url : '',
      certSha256: notes.cert,
      apps,
    }
  }
  return null
}

const REPO = /^[\w.-]+\/[\w.-]+$/

/** The newest Android apps release, or null (none yet, or GitHub unreachable). Never throws. */
export async function getAppReleases(): Promise<AppReleases | null> {
  const repo = process.env.APP_RELEASES_REPO?.trim() || 'malekverse/tunisiaflicks'
  if (!REPO.test(repo)) return null
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 4000)
    const response = await fetch(`https://api.github.com/repos/${repo}/releases?per_page=20`, {
      headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
      signal: controller.signal,
      next: { revalidate: 3600, tags: ['app-releases'] },
    }).finally(() => clearTimeout(timer))
    if (!response.ok) return null
    return pickRelease(await response.json())
  } catch {
    return null
  }
}

/** Which apps can be downloaded right now (for the offers, which only need to know that). */
export async function availableApps(): Promise<Record<AppId, boolean>> {
  const releases = await getAppReleases()
  return { android: !!releases?.apps.android, tv: !!releases?.apps.tv }
}
