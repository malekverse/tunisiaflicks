TRACK seasons · WAVE 1 · effort M. Make the calendar visible without decorating the shell. You build the seasonal nav slot (data only), one SeasonalBanner on home, HubDoor, countdowns and the moment-page echo. Decorations stay cut: no finial, garland, data-season skin, BrandMark swap, setting, preview bar or particles.

COMMON RULES
- Worktree and git
  - Worktree: C:/Users/malek/AppData/Local/Temp/claude/C--Users-malek-OneDrive-Attachments-Documents-GitHub-tunisiaflicks/6a114b99-37cf-4f20-bc1e-b374d7220f50/scratchpad/tf-extras (branch feat/redesign), shared.
  - Edit only your files. Shared index: stage only your paths; commit with `git commit -m 'msg' -- <paths>`. Never a bare commit, add -A, stash or reset. On index.lock, retry after 2–10s; never delete it.
- Design and strings
  - Follow docs/DESIGN.md: logical RTL, 44px targets, text ≥ white/50, no all-caps, '·', '→' or emoji. A dismiss button is a sibling of the card link.
  - Strings: features/seasons.ts (en+ar, tn, fr). No verb right after {name} in Arabic.
  - Client imports from i18n/locales. Never `locale === 'en'`.
- Tooling
  - Run `npx tsc --noEmit --incremental false` on your own files. Don't touch the :3300 server.
  - Unit tests: tests/seasons.unit.test.mjs via `npm run test:unit`; the loader resolves '@/' and stubs next/cache.
- Free tiers only.

FILES: see ownership 'seasons'. Foundations created src/lib/seasons.ts (types and stub functions) and the SeasonalBanner stub. Both are already mounted in layout (nav slot) and on home (slot 3).

READ FIRST: src/lib/moments.ts, hijri.ts, ramadan.ts (ramadanStatus, BANNER_DAYS_BEFORE=45), RamadanBanner, RamadanCountdown, moments/[id]/page.tsx.

Moment weights in moments.ts: ramadan 100; both Eids 95; independence-day, republic-day and womens-day 80 (kids:false); new-year 70; halloween and christmas 60.

1. seasons.ts (keep the foundation types; pure; never throws)
1.1 getSeasonalNav(kids, today = tunisDate())
- Only moments with weight ≥ 90:
  - Ramadan, when daysUntil ≤ 45 (inclusive, matching ramadanStatus), until its end: {href:'/ramadan', label:'nav.ramadan', icon:'moon', accent:'245 190 80'}.
  - Eid al-Fitr, 1–3 Shawwal: href /moments/eid-al-fitr.
  - Eid al-Adha, 9–13 Dhu al-Hijjah: href /moments/eid-al-adha.
- Otherwise 'Your year' from Dec 1 to Jan 15: {href:'/wrapped', label:'nav.myYear', icon:'year', accent:'255 210 120', signedInOnly:true}, weight 50.
- Highest weight wins.
- Kids: only moments where momentForKids is true; Your year is allowed.
1.2 getSeasonalBanner({kids, signedIn, today?, now?})
- At most one banner, from weight ≥ 80 moments plus Your year in December for signed-in users.
- Order: live before soon, then by weight.
- model.id equals the moments.ts id ('ramadan', 'eid-al-fitr', …) or 'your-year'. ChipRail uses it to avoid showing the same moment twice.
- Cases:
  - (a) Ramadan soon (45 to 2 days before): 'Ramadan starts {when}' (RelativeTimeFormat numeric:auto), subtitle ramadan.bannerText, note 'Around {date}'.
  - (b) Eve (≤48h): countdown to `${start}T00:00:00+01:00`, note 'The date depends on the moon sighting'.
  - (c) During Ramadan: 'Ramadan Mubarak, day {day}'. In the last 3 days the subtitle is 'Eid al-Fitr is {when}' (tn 'العيد الصغير {when}'), with a countdown within 48h.
  - (d) Eid al-Fitr days: the moment's title and blurb.
  - (e) Eid al-Adha: eve countdown 'Eid al-Adha is {when}' (tn 'العيد الكبير'), then the days.
  - (f) National days, from 2 days before to the day, hidden for Kids: '{name} is {when}', then '{years} years of …' (1956/1957/1956; Arabic 'عامًا', valid for 11–99).
  - (g) 'Your year' (Dec 1–31, signed in): 'Your year on TunisiaFlicks is ready' → /wrapped.
- Dev: when not in production and SEASONS_TODAY is a valid YYYY-MM-DD, it overrides today.

2. HubDoor (server-safe Link)
- Shell: rounded-[22px] px-4 py-4 sm:px-5, flex, gap-4, at least 72px tall.
- Background: gradient from rgb(var(--door)/0.16) via /0.06 to transparent, flipped with rtl:bg-gradient-to-l. ring /0.22, hover ring /0.4 (hover-gated).
- Contents:
  - icon disk 48px (40 below sm) with accent/0.14 and a glow
  - title in font-display, 17px / sm:20px, bold
  - one text line, 13–14px, white/70
  - badge slot
  - ChevronRight with rtl:rotate-180
- pressable, active:scale-[0.985], focus ring red-500.

3. SeasonalBanner (replaces the stub; async server)
- Inputs: kids from the prop, else getKidsMode; signedIn from getServerSession.
- Read cookies().get(SEASON_DISMISS_COOKIE). When it contains `${id}:${occurrence}`, render nothing on the server, so there is no flash and no layout shift.
- Otherwise render, inside page-x, a HubDoor-like card scoped by the accent:
  - emblem disc (crescent / crescent+star / TunisiaMark in white with #E70013, never mirrored / CalendarHeart)
  - title, subtitle spans, note in white/50, chevron
  - the card is one Link with aria-labelledby and aria-describedby
- A live countdown delegates to SeasonalBannerLive (client).
- Dismiss: a 44px X button positioned over the card, a sibling of the Link (aria-label seasons.dismiss).
  - On click it writes the cookie (append the entry and keep the last 4, path /, 1 year, lax) and also localStorage (try/catch).
  - It collapses opacity and height with tween.fast on click only, never on mount.
- RamadanBanner.tsx becomes `export { default } from '@/src/components/seasons/SeasonalBanner'`.

4. SeasonCountdown and useCountdown
- Aligned to the minute or second; pauses when hidden; resyncs on visibility; the first render uses the server's `initial` values.
- NumberFlow tiles: min-w-[4.25rem] rounded-2xl bg-white/[0.06], ring of the accent at /0.2, 26–30px tabular numbers, units 11px white/60.
- dir=ltr, role=timer, aria-live off, plus an sr-only sentence.
- At zero: crossfade to zeroTitle with opacity and a 2px blur (tween.base; opacity only under reduced motion) and announce once via role=status.

5. Moment pages: when active, PageHeader icon = emblem; when live, SeasonCountdown lg as children. Keep RoomTint, KidsBlocked and the ramadan redirect.

6. STRINGS: seasons.ramadan.soon, ramadan.eidSoon, adha.soon, around, moon, national.soon, independence.years, republic.years, womens.years, year.title, year.text, countdown.label, countdown.seconds, dismiss. Reuse the core moment and countdown keys.

SHARED-FILE REQUESTS: README entry for SEASONS_TODAY.

ACCEPTANCE
1. tests/seasons.unit.test.mjs table:

| Date | Nav | Banner |
|---|---|---|
| 2026-10-08 | null | null |
| 2026-12-20 | Your year (signedInOnly) | Your year (signed in) |
| 2026-12-25 | Ramadan (day −45; Ramadan 1448 starts 2027-02-08) | Ramadan soon |
| 2027-02-07 | Ramadan | live countdown |
| 2027-02-20 | Ramadan | day 13 |
| 2027-03-07 | Ramadan | Eid line |
| 2027-03-09 | Eid al-Fitr | Eid days |
| 2027-03-20 | null | national day, 71 years (null for kids) |
| 2027-05-15 | Eid al-Adha | eve |

2. Dismissal: after one reload the server HTML contains no banner, and there is no layout shift. It applies to that occurrence only.
3. RTL: chevron and gradient flip; the Tunisia mark doesn't.
4. Reduced motion: no blur.
5. Shell chrome is untouched.

## OWNER OVERRIDES (the product owner's explicit requirements; they take precedence over anything above)

Restore a RESTRAINED SEASONAL SKIN (the owner asked for "Ramadan, Eid and New Year skins with matching home banners"). Keep the IA rule "no decorations in the navigation chrome", so the skin is ambient, not ornamental:
1. Season light: `getSeasonSkin(kids, today)` in src/lib/seasons.ts → `{ id, light: 'r g b', glow?: 'r g b' } | null` for Ramadan (from its first day, not the 45-day lead), both Eids, New Year's Eve/Day (Dec 31–Jan 1), and the national days. The root layout sets `data-season={id}` on <html> and `--season-light: r g b` (integration/foundations mount; request it). RoomLight (src/components/shell/RoomLight.tsx; this track owns it in wave 1) uses `--season-light` as its DEFAULT light when no page sets its own (pages with posters keep their picture light). Ramadan/Eid: lantern gold 245 190 80; New Year: champagne 255 210 120; national days: flag red 231 0 19 at low strength.
2. New Year banner: include new-year in SeasonalBanner on Dec 31 (countdown to midnight Africa/Tunis, 'Happy New Year' on Jan 1) even though its weight is 70.
3. Motifs live INSIDE the SeasonalBanner and the moment pages only: a thin line-art crescent and lantern (Ramadan/Eid), a few slow sparkles (New Year, CSS only, none with reduced motion). Small inline SVG, no images.
4. Kids: same skin (it is just light). Preview for testing: `SEASONS_TODAY` env (dev only) as planned.
