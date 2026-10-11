# The apps

TunisiaFlicks is offered on every screen from the site itself (no app store), on `/app` and through a
small offer that appears on the right device at the right moment:

| Device | What they get | Where it comes from |
|---|---|---|
| Android phones and tablets | A native app (APK), React Native | `mobile/`, `/download/android` |
| Android TV, Google TV, TV boxes | The same app built for TV: remote focus, the TV launcher | `mobile/` (EXPO_TV=1), `/download/tv` |
| Windows | The desktop app: the site in its own window, with its own ad-free player first in the source bar and every pop-up blocked | `desktop/`, `/desktop`, `/download/desktop` |
| iPhone and iPad | The site on the Home Screen (Apple only allows the App Store for apps) | Safari's Share > Add to Home Screen |
| Mac, Linux, ChromeOS (and Windows) | The site installed from Chrome or Edge (its own window and icon) | the browser's install prompt; Safari: File > Add to Dock |
| Other smart TVs | TV mode in the TV's browser | `/?tv=1` |

Both Android apps are one React Native app (`mobile/`) built twice. They read the site's app API
(`/api/app/v1`, below), so lists, titles and the stream sources change with the site; the screens
themselves need a new version.

## How the site finds the apps (nothing to configure)

The site reads the newest **`android-v…` release** of this repository on GitHub
(`src/lib/app-releases.ts`, cached for 10 minutes): its two APKs, their sizes, and the checksums and signing
certificate listed in the release notes. From that:

- `/download/android` and `/download/tv` redirect to the newest files (and to `/app` while there's none);
- `/app` shows the version, size, date and "Check the file";
- the offer appears for Android only once there's a release;
- `/.well-known/assetlinks.json` lists the signing certificate, which lets links to the site's titles open
  straight in the phone app (Android App Links).

Optional settings in Vercel: `APP_RELEASES_REPO` (default `malekverse/tunisiaflicks`), `ANDROID_TWA_PACKAGE`
(default `com.tunisiaflicks.app`), `ANDROID_TWA_SHA256` (extra fingerprints, e.g. a debug key while testing).

## The offer (src/components/apps/AppOffer.tsx)

One card for the device in hand:

- **Android phone:** "Download the app" (with its size), then what to do with the file; "or install it without
  downloading" when Chrome offers that.
- **Android TV in TV mode:** the address to type in the free Downloader app. (TV browsers outside TV mode get
  the TV-mode offer first.)
- **iPhone / iPad:** Add to Home Screen, step by step.
- **Windows:** the desktop app (its page, `/desktop`) once it has a release; until then, as other computers.
- **Computers:** one-click install from Chrome or Edge; Safari on a Mac: File > Add to Dock.

It never nags: only from a second visit or a third page, after the page settles, never on `/app`, sign-in or
download pages, never inside an app (the TV app's user agent, the phone app's `?source=android-app` start
address, or any installed site), and not while the e-mail reminder shows. "Not now" quiets it for 3 weeks
(6 months after three times); downloading or installing, for 4 months. `/app`, the account menu, the phone
menu ("Get the app") and the footer always lead to it.

## One-time setup: the signing key

Android only updates an app with one signed by the **same key**, so this key is forever. Lose it and every
phone and TV has to uninstall the app before installing a new version. Both apps use it.

1. Create it (Android Studio's Java is enough):

   ```sh
   keytool -genkeypair -v -keystore tunisiaflicks.jks -alias tunisiaflicks \
     -keyalg RSA -keysize 4096 -validity 10000
   ```

2. **Back it up** in two places that aren't this computer (a password manager that stores files, and an
   encrypted USB stick), with its passwords.
3. In GitHub: Settings > Secrets and variables > Actions > New repository secret:
   - `ANDROID_KEYSTORE_BASE64`: the file in base64 (`base64 -w0 tunisiaflicks.jks`, or in PowerShell
     `[Convert]::ToBase64String([IO.File]::ReadAllBytes("tunisiaflicks.jks"))`)
   - `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` (`tunisiaflicks`), `ANDROID_KEY_PASSWORD`

## Releasing a version

```sh
git tag android-v1.0.0
git push origin android-v1.0.0
```

`.github/workflows/android-apps.yml` builds both signed APKs and creates a GitHub Release with
`tunisiaflicks-android.apk`, `tunisiaflicks-tv.apk`, `SHA256SUMS`, and the checksums in the notes (the site
reads them: keep their format). Versions are `android-vMAJOR.MINOR.PATCH` (minor and patch up to 99), each
higher than the last. Within minutes the site offers the new version; nothing to change in Vercel.

## The desktop app (desktop/)

The Windows app is the site in an Electron window plus the local torrent player (`player-service/`); see
`desktop/README.md`. The site presents it on `/desktop` (its own page), with a spotlight and a card on
`/app`, and offers it to Windows visitors once it has a release. It reads the newest **`desktop-v…`
release**: its `TunisiaFlicks-Setup.exe`, the size, and the checksum in the notes.

```sh
git tag desktop-v1.0.0
git push origin desktop-v1.0.0
```

`.github/workflows/desktop-app.yml` builds the installer on Windows and creates a GitHub Release with
`TunisiaFlicks-Setup.exe`, `SHA256SUMS` and the checksum in the notes (keep its format), plus `latest.yml`
and `TunisiaFlicks-Setup.exe.blockmap` for the updater. Until a release exists, `/desktop` says the app is
coming and `/download/desktop` leads there.

**Updates.** The installed app updates itself (`desktop/updater.js`, electron-updater): a check 15 seconds
after it starts and every 4 hours, the new version downloads in the background and installs when the app
is closed. Its feed is the site's `/download/desktop-update/` (`latest.yml`, the installer and its
blockmap, redirected to the newest `desktop-v…` release); not electron-updater's GitHub provider, which
reads the repository's "latest" release, and the Android releases take that too. The viewer can turn
automatic updates off and on in Settings > Desktop app (only shown inside the app, also on `/desktop`);
off, nothing downloads or installs unless they press "Check for updates" and then "Restart to update".
Version 1.0.0 has no updater: people on it get updates once they install 1.1.0 or later from `/desktop`.

The installer is unsigned unless the repository has the `WINDOWS_CERT_BASE64` (a .pfx in base64) and
`WINDOWS_CERT_PASSWORD` secrets; unsigned, Windows SmartScreen warns on first run, and `/desktop` tells
people how to get past it ("More info", then "Run anyway").

## The Android apps (mobile/)

One Expo (React Native) app, in the site's design (`docs/DESIGN.md`: true black, the red as the signal
light, the display face for titles), built twice from the same code:

- **Phones and tablets**, `com.tunisiaflicks.app`: a floating tab bar (Home, Discover, Search, My List,
  You), pull to refresh, haptics, links to the site's `/movie/…` and `/tv/…` pages open in the app.
- **Android TV**, `com.tunisiaflicks.tv` (`EXPO_TV=1`, react-native-tvos): the tab bar along the top, a
  full-screen billboard, everything a size up, a white ring and a lift on the focused item.

Both keep the package names and signing key of the earlier apps, so they install as updates.

**Data.** The app reads `/api/app/v1` on the site (`src/lib/app-api`, `src/app/api/app/v1`): `home`,
`title/{movie|tv}/{id}`, `title/tv/{id}/season/{n}`, `search`, `list/{key}`, `genres`, `version`. Public,
cached by Vercel's CDN, rate-limited per address, with `?lang=en|fr|ar|tn` and `?kids=1`; the TMDB key stays
on the server. Language, Kids mode, My List, the watch history and recent searches live on the device.

**The player** (`mobile/src/app/watch.tsx`): the site's sources (`getProviderTemplates`), each in a frame
inside a page of the app's, full screen. An ad that opens a window or redirects the page is blocked and
the app says so; `sandbox` sources play sandboxed ("fewer ads"). The sources are tried best first (the one
that played last time, then the site's order with the ones viewers report broken last, from
`/api/stream-health`), and "This source doesn't work" reports it and moves on. Next episode for shows.
On TV the remote's OK plays and pauses by tapping the middle of the player (`mobile/modules/tv-remote`,
a small native module: the sources' controls sit in nested frames the remote's keys can't reach); up
or Back brings the bar back, and Back again leaves.

**Updates.** You > the update banner appears when `/api/app/v1/version` has a newer release; it opens
`/download/android` (or `tv`), and Android installs it over the old one.

**Languages.** English, French, Arabic and Tunisian (Arabic strings). Android lays a screen out right to
left only at launch, so switching between a left-to-right and a right-to-left language closes the app
after saying so.

## Building them yourself

Needs Node 22, JDK 17+ (Android Studio's `jbr` works) and the Android SDK. On Windows, work from a short path
(e.g. `C:	f`): the native build breaks on paths over 260 characters.

```sh
cd mobile
npm ci
npm run typecheck
npx expo prebuild --platform android --clean            # phones (EXPO_TV=1 for TV)
cd android && ./gradlew assembleRelease                 # android/app/build/outputs/apk/release
```

`TF_API_URL` points a build at another site (an emulator reaches the computer's dev server at
`http://10.0.2.2:3000`). `assembleRelease` without the `TF_KEYSTORE_*` variables signs with Expo's debug key.

## When something goes wrong

- **Links to the site open in the browser, not the app:** `/.well-known/assetlinks.json` doesn't list the
  app's certificate (no release, or the app was signed with another key). Open that address to check.
- **The player stays black on a TV:** the TV's WebView is broken or very old. Update "Android System
  WebView" (Play Store, or the box's system updates), then try another source.
- **An update can't be installed** ("App not installed", conflicting package): it was signed with another key.
  Uninstall the old app first.
