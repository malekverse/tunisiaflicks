# The Android TV app

`android-tv/` is a small Android app (Java, one Activity, one WebView) that opens
`https://tunisiaflicks.vercel.app/?tv=1`: the site in TV mode, for Android TV, Google TV and TV boxes that
have no good browser. Everything else (the remote-friendly interface, signing in from a phone at `/activate`)
is the site itself, so the app rarely needs a new version.

What the app does on its own:

- **Stays on the site.** A page can only go to `tunisiaflicks.vercel.app`; any other address is cancelled
  (with a short "open it on your phone" message). Players inside frames still load.
- **Locked down.** No new windows, no file or content access, no mixed content, no JavaScript bridge, every
  permission request and every bad certificate refused, Safe Browsing on.
- **Back** asks the page first (`window.tfTvBack()` closes the player menu or a sheet), then goes back, then
  leaves the app.
- **Full screen video** from the player and trailers.
- **Old WebView:** below Android System WebView 100 it shows an "Update Android System WebView" screen
  (with "Try anyway").
- **Offline:** a "No connection / Try again" screen instead of the browser's error page.
- The site recognizes it by the user agent suffix `TunisiaFlicksTV/<version>` and hides "Exit TV mode" and
  the app panel on `/app`.

It runs on Android 5.0 and newer, and shows in both the TV launcher (with its banner) and the phone launcher.

## One-time setup: the signing key

Android only updates an app with one signed by the **same key**, so this key is forever. Lose it and every
TV has to uninstall the app before installing a new version.

1. Create it (Android Studio's Java is enough):

   ```sh
   keytool -genkeypair -v -keystore tunisiaflicks-tv.jks -alias tunisiaflicks-tv \
     -keyalg RSA -keysize 4096 -validity 10000
   ```

2. **Back it up** in two places that aren't this computer (a password manager that stores files, and an
   encrypted USB stick), with its passwords.
3. In GitHub: Settings > Secrets and variables > Actions > New repository secret:
   - `TV_KEYSTORE_BASE64`: the file in base64 (`base64 -w0 tunisiaflicks-tv.jks`, or in PowerShell
     `[Convert]::ToBase64String([IO.File]::ReadAllBytes("tunisiaflicks-tv.jks"))`)
   - `TV_KEYSTORE_PASSWORD`, `TV_KEY_ALIAS` (`tunisiaflicks-tv`), `TV_KEY_PASSWORD`

## Releasing a version

```sh
git tag tv-v1.0.0
git push origin tv-v1.0.0
```

`.github/workflows/android-tv.yml` builds the signed APK and creates a GitHub Release with
`tunisiaflicks-tv.apk`, its `.sha256`, and both fingerprints in the notes. Versions are `tv-vMAJOR.MINOR.PATCH`
(minor and patch up to 99); each new tag must be higher than the last.

Then, in Vercel (Production), so `/app` offers it:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_ANDROID_APK_URL` | `https://github.com/<owner>/<repo>/releases/latest/download/tunisiaflicks-tv.apk` (always the newest) |
| `NEXT_PUBLIC_ANDROID_APK_SHA256` | the APK SHA-256 from the release notes |
| `NEXT_PUBLIC_ANDROID_CERT_SHA256` | the signing certificate SHA-256 from the release notes (the same for every release) |
| `NEXT_PUBLIC_ANDROID_RELEASE_URL` | the release page |

These are public values, built into the page: redeploy after changing them.

## Installing on a TV (what `/app` tells people)

1. On the TV: Settings > Device preferences > Security & restrictions > Unknown sources, and allow the app
   that will open the file (Downloader, or the file manager).
2. Download the APK on the TV (the Downloader app with the address from `/app`), or copy it with a USB stick.
3. Open it and choose Install, then open TunisiaFlicks from the apps row.

## Building it yourself

Needs JDK 17+ (Android Studio's `jbr` works) and the Android SDK with platform 36.

```sh
cd android-tv
./gradlew assembleDebug        # app/build/outputs/apk/debug/app-debug.apk
./gradlew lintDebug            # Android lint
```

`assembleRelease` without the `TF_KEYSTORE_*` variables builds an unsigned APK.

## When something goes wrong

- **Blank screen:** the TV's WebView is broken or very old. Update "Android System WebView" (Play Store, or
  the box's system updates), then restart the TV.
- **"This link opens outside TunisiaFlicks":** working as intended; open that link on a phone.
- **The update can't be installed** ("App not installed", conflicting package): it was signed with another key.
  Uninstall the old app first (sign-in on the TV is lost; sign in again from a phone).
