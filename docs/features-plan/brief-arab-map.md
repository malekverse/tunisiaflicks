TRACK arab-map · WAVE 2 · effort L

/arab-cinema is a tile map of the 22 Arab League members, and /arab-cinema/[cc] is a page per country with stats and rows computed from TMDB.
- Each tile is lit by the country's film of the day.
- The entrance is a ripple that starts at Tunisia.
- No borders. Palestine is labelled Palestine / فلسطين.

COMMON RULES
- Worktree: C:/Users/malek/AppData/Local/Temp/claude/C--Users-malek-OneDrive-Attachments-Documents-GitHub-tunisiaflicks/6a114b99-37cf-4f20-bc1e-b374d7220f50/scratchpad/tf-extras (branch feat/redesign), shared. Edit only your files.
- Git (the index is shared):
  - Stage only your paths, and commit with `git commit -m 'msg' -- <paths>`.
  - Never a bare commit, add -A, stash or reset.
  - On index.lock, retry after 2–10s.
- Design: follow docs/DESIGN.md. Text white/50 or brighter.
- Strings: features/arab-map.ts (en and ar complete, tn, fr). Counts never inside sentences.
- Tooling:
  - Run `npx tsc --noEmit --incremental false`; don't touch :3300.
  - For next/og on Windows, use the patched harness.
  - Tests: tests/arab-map.test.mjs (BASE_URL) and tests/arab-map.unit.test.mjs (step and neighbours).
- Free tiers only.

USE: arab-countries.ts (don't fork it), Chip/ChipGroup, HubDoor, RoomTint, useRoom, PosterCard, TmdbImage, EmptyState with action, Row/SectionHeader, filterKidSafe, renderSectionCard.

FILES: see ownership 'arab-map'.

GRID (9×5, dir=ltr, never mirrored)
- r0: MA0 DZ1 TN2 · LB4 SY5 IQ6 KW7
- r1: MR0 LY2 EG3 PS4 JO5 SA6 BH7 QA8
- r2: SD3 YE6 AE7 OM8
- r3: DJ5 SO6
- r4: KM6

ROUTING
- layout.tsx (server) loads getArabMapIndex(locale, kids).
  - unstable_cache key ['arab-map-index', kids ? 'kids' : 'all', tmdbLanguage, tunisDate], revalidate 86400.
  - The Kids variant runs filterKidSafe before caching.
  - If more than half the countries fail, throw so the failure isn't cached, and show names only.
  - ArabCinemaShell keeps the map mounted.
- useSelectedLayoutSegment picks the country.
- [country]:
  - Uppercase → permanentRedirect to lowercase.
  - tn → /tunisian/cinema.
  - Non-members → notFound.
- Links: `<Link scroll={false} prefetch={false}>`, with router.prefetch on pointerenter, focus and pointerdown.

KIDS
- The map stays visible. Countries without kid-safe titles are dimmed: dashed ring, lower background. Labels stay white/50, never fainter.
- Dimmed countries remain selectable and show an honest empty state.

TILE
- A Link with data-country: aspect-square, rounded-[10px], bg-white/[0.04], inset ring.
- Glow 0.10. Poster w92/w154 at opacity 0.14 + 0.26·intensity, where intensity = log10(n+1)/log10(5000).
- Labels:
  - sm and up: the name (11.5–12.5px, clamp 2).
  - Below sm: the 2-letter code (dir=ltr, 11px, white/70) so tiles are identifiable.
  - Tunisia also gets the TunisiaMark.
- Hover: opacity 0.9.
- Selected: m.span layoutId ring-red, aria-current=page. Focus uses a white outline.
- Entrance: animate-focus-in with 40ms × distance from TN, first mount only.
- Hover preview (fine pointer): 120ms delay, 248px glass card. Opens instantly within a 400ms warm window. Room light after a 120ms dwell.
- Phones:
  - touch-action pan-y.
  - A horizontal drag past 8px scrubs, but only previews: the readout updates and haptic(6) fires. Lifting never navigates.
  - Opening takes a tap on a tile, or the readout's 'Open {country}' button.
- Keyboard:
  - One tab stop.
  - Arrows choose the nearest tile in the half-plane, scored dx + 2|dy|.
  - Home goes to MA, End to KM.
  - Typeahead ignores a leading 'ال' and accents.

LAYOUTS
- Below xl: the map is sticky and a sheet scrolls over it (rounded-t-[28px]), with a 44px 'Back to the map' button.
- xl: split grid `[minmax(0,1fr)_minmax(400px,36%)]`. Columns mirror in RTL; the map never does.

INDEX PANEL
- 'All countries': 60px rows sorted with Intl.Collator, ignoring 'ال'. This list is the accessible alternative to the map and the D-pad target. There is NO separate chip list.
- 'Today across the Arab world' row.
- Source line.

COUNTRY PANEL
- Header: close X, h1, stats (Films / Series / First film on record), source line.
- Today's pick card: Play (red), More info.
- Rows: New releases, All-time favourites, Series, Classics (at least 4). When the total is under 12, show one 'Everything on record' grid instead.
- People: BORN_IN matchers, excluding bare 'عمان', 'Tripoli' and South Sudan.
- Neighbours: a Chip row in nav mode, up to 4.
- RoomTint.

STATES
- PanelSkeleton.
- EmptyState with a RetryButton action.
- Empty country: neighbours.
- No personal data, no localStorage.

/tunisian/cinema: add a HubDoor 'See the Arab cinema map' with Map icon and accent 200 162 122.

OG
- renderSectionCard, revalidate 86400, maxDuration 30.
- Unknown country → fallback card.

PERFORMANCE
- mapLimit(12).
- Index: about 66 calls per language and variant per day.
- Country page: about 14 calls; people about 50 (cached 7 days).

SHARED-FILE REQUESTS
- nav WORLD: Arab cinema.
- Footer.
- sitemap: 21 codes.
- share-sections 'arab-cinema': title 'Arab cinema', subtitle 'Films and series from the 22 countries of the Arab world, on one map.', cta 'Explore the map'.
- README.

ACCEPTANCE
1. Routes:
   - /arab-cinema → 200
   - /eg → 200, contains Egypt
   - /EG → 308 to /eg
   - /tn → 308 to /tunisian/cinema
   - /zz → 404
   - an ar cookie → RTL, contains مصر
2. Keyboard: from Tunisia, Right goes to Lebanon and Down goes to Libya. Typeahead finds مصر.
3. Kids: no unsafe titles; empty countries dimmed. Switching profile changes the index (cache key test).
4. At 375px tiles show codes, and a scrub never navigates.
5. CLS under 0.05; LCP is the h1.