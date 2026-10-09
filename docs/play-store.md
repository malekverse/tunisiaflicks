# TunisiaFlicks on Google Play (phones)

The Play Store app is the site itself, wrapped as a **Trusted Web Activity**: Chrome shows the site full
screen with no address bar, under its own icon. No separate codebase: every change to the site is in the
app at once. The wrapper is built with Google's Bubblewrap from `android/twa/twa-manifest.json`.

**Cost:** a one-time **US$25** Google Play developer registration. Everything else is free.

## 1. Developer account

1. Register at https://play.google.com/console (personal account, one-time fee, identity check).
2. New personal accounts must run a **closed test with at least 12 testers for 14 days in a row** before
   they can publish to everyone. Line up the testers (friends, family) early. Google changes these rules
   from time to time: check the current requirement in the Console.

## 2. Build the app with Bubblewrap

Needs Node.js and JDK 17 (Bubblewrap can download its own JDK and Android SDK on first run).

```sh
npm install -g @bubblewrap/cli
cd android/twa
bubblewrap update            # creates the Android project from twa-manifest.json
bubblewrap build             # creates app-release-bundle.aab (upload this) and app-release-signed.apk
```

The first `bubblewrap build` creates the **upload key** `android/twa/android.keystore` (alias
`tunisiaflicks`) and asks for its passwords. Back it up like the TV key (docs/TV.md): with Play App Signing a
lost upload key can be replaced through Google support, but it takes days. The generated project and the
keystore are git-ignored on purpose; only `twa-manifest.json` is versioned.

For a new version: raise `appVersionCode` (and `appVersionName`) in `twa-manifest.json`, then
`bubblewrap update && bubblewrap build`. Only needed when the wrapper changes (icon, name, shortcuts), not
when the site does.

## 3. Prove the site owns the app (Digital Asset Links)

Without this the app still opens, but with a browser bar on top.

1. In the Play Console: your app > Test and release > App integrity > App signing. Copy the **App signing key
   certificate SHA-256** (Google re-signs the app with it) and the **Upload key certificate SHA-256**.
2. In Vercel (Production), then redeploy:
   - `ANDROID_TWA_PACKAGE` = `com.tunisiaflicks.app`
   - `ANDROID_TWA_SHA256` = both fingerprints, comma-separated
3. Check https://tunisiaflicks.vercel.app/.well-known/assetlinks.json shows them, and the Google tool
   https://developers.google.com/digital-asset-links/tools/generator says the link is valid.

## 4. The store listing

- **App name:** TunisiaFlicks. **Category:** Entertainment.
- **Privacy policy:** https://tunisiaflicks.vercel.app/privacy
- **Icon:** 512×512 from `public/icons/icon-512.png`. **Feature graphic:** 1024×500. **Screenshots:** at
  least two phone screenshots (home, a title page, Tunisian).
- **Content rating:** fill the questionnaire honestly (it shows films and series with trailers; there are
  Kids profiles).
- **Target audience:** not designed for children under 13 (Kids profiles are a feature inside an account).
- **Data safety** (answer from the privacy policy):
  - Collected: e-mail address and name (account), app activity (watch history, favourites, lists,
    ratings), app interactions; push notification tokens if notifications are on.
  - Not sold, not used for ads.
  - Encrypted in transit: yes (HTTPS only).
  - Users can delete their data: yes, in Settings (account deletion), or by contacting the site.
- **Ads:** no ads in the app (only say this if it's true when you publish).

## 5. Publish

1. Create a **closed testing** release, upload `app-release-bundle.aab`, add the testers' e-mails, and share
   the opt-in link with them. Wait the required days.
2. Apply for production access from the Console, then promote the release to production.
3. When it's live, set `NEXT_PUBLIC_PLAY_STORE_URL` in Vercel to
   `https://play.google.com/store/apps/details?id=com.tunisiaflicks.app` and redeploy: `/app` then shows
   "Get it on Google Play".
