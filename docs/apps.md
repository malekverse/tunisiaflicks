# The apps

TunisiaFlicks is offered on every screen from the site itself (no app store), on `/app` and through a
small offer that appears on the right device at the right moment:

| Device | What they get | Where it comes from |
|---|---|---|
| Android phones and tablets | An app (APK) that shows the site full screen in Chrome, a **Trusted Web Activity** | `android/phone`, `/download/android` |
| Android TV, Google TV, TV boxes | An app (APK) that opens the site in TV mode, in a locked-down WebView | `android/tv`, `/download/tv` |
| iPhone and iPad | The site on the Home Screen (Apple only allows the App Store for apps) | Safari's Share > Add to Home Screen |
| Windows, Mac, Linux, ChromeOS | The site installed from Chrome or Edge (its own window and icon) | the browser's install prompt; Safari: File > Add to Dock |
| Other smart TVs | TV mode in the TV's browser | `/?tv=1` |

Both Android apps show the live site, so a site update reaches every app at once. They only need a new
version when the wrapper itself changes (icon, name, a fix in the TV app).

## How the site finds the apps (nothing to configure)

The site reads the newest **`android-v…` release** of this repository on GitHub
(`src/lib/app-releases.ts`, cached for an hour): its two APKs, their sizes, and the checksums and signing
certificate listed in the release notes. From that:

- `/download/android` and `/download/tv` redirect to the newest files (and to `/app` while there's none);
- `/app` shows the version, size, date and "Check the file";
- the offer appears for Android only once there's a release;
- `/.well-known/assetlinks.json` lists the signing certificate, which is what makes Chrome open the phone app
  full screen with no address bar.

Optional settings in Vercel: `APP_RELEASES_REPO` (default `malekverse/tunisiaflicks`), `ANDROID_TWA_PACKAGE`
(default `com.tunisiaflicks.app`), `ANDROID_TWA_SHA256` (extra fingerprints, e.g. a debug key while testing).

## The offer (src/components/apps/AppOffer.tsx)

One card for the device in hand:

- **Android phone:** "Download the app" (with its size), then what to do with the file; "or install it without
  downloading" when Chrome offers that.
- **Android TV in TV mode:** the address to type in the free Downloader app. (TV browsers outside TV mode get
  the TV-mode offer first.)
- **iPhone / iPad:** Add to Home Screen, step by step.
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
higher than the last. Within the hour the site offers the new version; nothing to change in Vercel.

## The phone app (android/phone)

Google's Trusted Web Activity launcher (`androidbrowserhelper`): Chrome shows the site full screen, so signing
in (Google included), notifications and everything else work as on the site. Starts at
`/?source=android-app` (the site then never offers the app inside the app). Links to the site open in the app.
Splash screen and notification icon from the logo. If the phone has no browser that supports Trusted Web
Activities, it opens a Custom Tab instead. Android 5.0 and newer.

Until `/.well-known/assetlinks.json` lists the app's certificate (from the first release on), Chrome shows a
thin address bar on top: that's the only difference.

## The TV app (android/tv)

One Activity with a WebView on `https://tunisiaflicks.vercel.app/?tv=1`, for TVs and boxes without a good
browser. Everything else (the remote-friendly interface, signing in from a phone at `/activate`) is the site.

- **Stays on the site.** A page can only go to `tunisiaflicks.vercel.app`; any other address is cancelled (with
  an "open it on your phone" message). Players inside frames still load.
- **Locked down.** No new windows, no file or content access, no mixed content, no JavaScript bridge, every
  permission request and every bad certificate refused, Safe Browsing on.
- **Back** asks the page first (`window.tfTvBack()` closes the player menu or a sheet), then goes back, then
  leaves the app (the back callback on Android 13+, the key event before).
- **Full screen video**, an **"Update Android System WebView"** screen below WebView 100, and a
  **"No connection"** screen.
- The site recognizes it by the user agent suffix `TunisiaFlicksTV/<version>` and hides "Exit TV mode".

Android 5.0 and newer; listed in the TV launcher (with its banner) and the phone launcher.

## Building them yourself

Needs JDK 17+ (Android Studio's `jbr` works) and the Android SDK with platform 36.

```sh
cd android
./gradlew assembleDebug      # tv/build/outputs/apk/debug and phone/build/outputs/apk/debug
./gradlew lintDebug
```

`assembleRelease` without the `TF_KEYSTORE_*` variables builds unsigned APKs.

## When something goes wrong

- **The phone app shows an address bar:** `/.well-known/assetlinks.json` doesn't list its certificate yet (no
  release, or the app was signed with another key). Open that address to check.
- **Blank screen on a TV:** the TV's WebView is broken or very old. Update "Android System WebView" (Play
  Store, or the box's system updates), then restart the TV.
- **"This link opens outside TunisiaFlicks" on a TV:** working as intended; open that link on a phone.
- **An update can't be installed** ("App not installed", conflicting package): it was signed with another key.
  Uninstall the old app first.
