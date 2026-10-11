// One app, built twice (CI: .github/workflows/android-apps.yml):
// - the phone and tablet app, com.tunisiaflicks.app;
// - with EXPO_TV=1, the Android TV app, com.tunisiaflicks.tv (react-native-tvos and its config plugin:
//   the TV launcher, the banner, remote focus).
// Both keep the package names and the signing key of the earlier apps, so they install as updates.
import type { ConfigContext, ExpoConfig } from 'expo/config'

const TV = process.env.EXPO_TV === '1'
const VERSION = process.env.TF_VERSION_NAME || '2.0.0'
const VERSION_CODE = Number(process.env.TF_VERSION_CODE || '20000')
// The site the app talks to (its /api/app/v1); a development build can point elsewhere.
const API = process.env.TF_API_URL || 'https://tunisiaflicks.vercel.app'

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'TunisiaFlicks',
  slug: 'tunisiaflicks',
  scheme: 'tunisiaflicks',
  version: VERSION,
  orientation: TV ? 'landscape' : 'portrait',
  userInterfaceStyle: 'dark',
  backgroundColor: '#000000',
  icon: './assets/icon.png',
  android: {
    package: TV ? 'com.tunisiaflicks.tv' : 'com.tunisiaflicks.app',
    versionCode: VERSION_CODE,
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-foreground.png',
      monochromeImage: './assets/adaptive-foreground.png',
      backgroundColor: '#000000',
    },
    // Links to the site's titles open in the app.
    intentFilters: TV ? [] : [
      {
        action: 'VIEW',
        autoVerify: true,
        category: ['BROWSABLE', 'DEFAULT'],
        data: [
          { scheme: 'https', host: 'tunisiaflicks.vercel.app', pathPrefix: '/movie/' },
          { scheme: 'https', host: 'tunisiaflicks.vercel.app', pathPrefix: '/tv/' },
        ],
      },
    ],
    blockedPermissions: ['android.permission.RECORD_AUDIO', 'android.permission.READ_EXTERNAL_STORAGE', 'android.permission.WRITE_EXTERNAL_STORAGE'],
  },
  plugins: [
    'expo-router',
    'expo-font',
    'expo-localization',
    'expo-screen-orientation',
    ['expo-splash-screen', { image: './assets/splash.png', imageWidth: 180, backgroundColor: '#000000' }],
    // Plain http only for a development build pointed at a computer (TF_API_URL=http://10.0.2.2:3000).
    ['expo-build-properties', { android: { minSdkVersion: 24, enableProguardInReleaseBuilds: true, enableShrinkResourcesInReleaseBuilds: true, usesCleartextTraffic: API.startsWith('http://') } }],
    ['@react-native-tvos/config-tv', { isTV: TV, androidTVBanner: './assets/tv-banner.png' }],
    './plugins/with-release-signing',
  ],
  experiments: { typedRoutes: true },
  extra: { api: API, tv: TV },
})
