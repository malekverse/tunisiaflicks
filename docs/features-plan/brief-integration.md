TRACK integration · run by the lead between waves; not a parallel agent.

RULES
- Same worktree and git protocol as the tracks.
- Apply the shared-file requests that tracks report, plus the list below.
- Then run, in order: typecheck, lint, test:unit, build, then test:smoke with BASE_URL=http://localhost:3300.
- Commit and tag.

AFTER WAVE 0
Verify foundations' acceptance; tag wave-0.

AFTER WAVE 1
- nav WORLD: Dramas {href:'/dramas', label:'dramas.nav', icon: Drama, grownUp:true} after Tunisian.
- layout: `messages={dictionaryFor(locale)}` and french's generateMetadata.
- page: getMovies(kids, catalogueLanguage(locale)) and getTop10(kids, community, catalogueLanguage(locale)).
- Footer Explore: Turkish & K-dramas.
- sitemap: the /dramas pages.
- share-sections: dramas-turkish, dramas-korean, and the search subtitle 'in English, French and Arabic'.
- en.ts and ar.ts 'search.description' mention French.
- account.ts: exportSocialData/deleteSocialData and exportDigestData/deleteDigestData.
- profiles/[id]:
  - DELETE calls deleteSocialProfile and deleteDigestPrefs.
  - PATCH kids=true returns 400 'social.errors.kidsHasHandle' when the profile has a handle.
  - Any change of the kids flag calls resetSocialVisibility.
- legal: social, digest and interface-language paragraphs (en/ar/fr); bump.
- package.json: `check:i18n` = `node scripts/check-translations.mjs && node scripts/check-client-i18n.mjs`; CI runs it.
- README: languages, social, scheduling, digest.
- Tag wave-1.

AFTER WAVE 2
- nav:
  - WORLD: Tunisian (kidsHref '/tunisian/cinema'), Dramas, Arab cinema {href:'/arab-cinema', label:'arabMap.nav', icon: Map}.
  - YOURS: Friends {href:'/friends', label:'social.nav', icon: UsersRound, grownUp:true}; Movie night {href:'/movie-night', label:'movieNight.nav', icon: Popcorn, grownUp:true, kidsAlt:{href:'/swipe', label:'swipe.title', icon: HeartHandshake}}; Library.
  - Remove Swipe and My Year.
- layout: `ask = aiSearchEnabled() && !kids && !tv`, then `<TopBar kids ask/>`. TopBar label: `t(ask ? 'ai.searchOrAsk' : 'search.open')`.
- Footer:
  - Explore: Arab cinema, Tunisian TV, Movie night.
  - Site: Support us (only when supportUrl()), Get the app.
- sitemap: /arab-cinema plus 21 codes, /tunisian/tv plus tunisianTvSitemap().catch(() => []), /app, and /support when supportUrl().
- share-sections: arab-cinema, tunisian-tv.
- account.ts, as an ordered pipeline:
  1. shared-lists onAccountDeleted, then movie-night onAccountDeleted.
  2. Social, digest, badges, deleteTvSessions.
  3. The generic deleteMany, with 'lists' removed from USER_COLLECTIONS.
  - Exports carry no other people's ids.
- profiles/[id] DELETE, in order: onProfileRemovedFromLists, forgetProfileInNights, deleteSocialProfile, deleteDigestPrefs, deleteBadgeData, revokeTvSessionsForProfile.
- digest providers: register the five.
- cron.yml: jobs nights `5 */3 * * *`, badges `10 2 * * *`, tunisian-tv `23 */3 * * *`, added to the choice list. SCHEDULER.md rows.
- legal: Groq, badges (13-month day flags, off switch), Ko-fi hash, Tunisian TV thumbnails and video, hub trailers, Deezer, nights, shared lists, TV pairing and signed-in TVs.
- robots: disallow /activate and /api/.
- public/sw.js: VERSION v4.
- README: the env list.
- scripts/check-account-deletion.mjs:
  - Seeds a throwaway dev user in every new collection.
  - Runs deleteUserData and the profile delete.
  - Asserts no document references the ids.
- Manual matrix: guest, grown-up, Kids, TV mode, RTL, 375px.
- Tag wave-2.