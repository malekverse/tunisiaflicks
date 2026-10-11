# TunisiaFlicks for Android phones and Android TV

One Expo (React Native) app in the site's design, built twice: for phones and tablets
(`com.tunisiaflicks.app`) and, with `EXPO_TV=1`, for Android TV (`com.tunisiaflicks.tv`). It reads the
site's `/api/app/v1`. How it works, building, and releasing: [docs/apps.md](../docs/apps.md).

```sh
npm ci
npm run typecheck
npm test
npm run prebuild:phone          # or prebuild:tv; generates android/ (never committed)
cd android && ./gradlew assembleRelease
```

- `src/app`: the screens (expo-router): the tabs (Home, Discover, Search, My List, You), a title, "See
  all", the player and the trailer.
- `src/components`: the site's pieces (cards, rows, the billboard, buttons, the tab bar), focus-aware for
  the TV remote.
- `src/theme/tokens.ts`: the design tokens from `docs/DESIGN.md`.
- `src/lib`: the API (React Query) and what's kept on the device (zustand).
- `src/i18n`: English, French and Arabic (Tunisian uses Arabic).
