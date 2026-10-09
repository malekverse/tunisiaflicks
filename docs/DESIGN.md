# TunisiaFlicks design guide

The rules every page and component follows. Read it before building UI; imitate the reference
components listed at the end rather than inventing new patterns.

## The concept: "the screen is the only light in the room"

True-black page (#000). Pictures are the light: the room is tinted by the poster or backdrop on
screen (`RoomTint`, `useRoomLight`). The logo red is the room's *signal light*: primary action
("Play", "Save", "Sign in"), active states, unread dots, progress. Never decoration, never big red
fills. Surfaces are white at low alpha so they take the tint of the room light behind them.

## Tokens (Tailwind)

- Colours: `bg-black` page; surfaces `bg-white/[0.04]` (card), `bg-white/[0.06]` (input/chip),
  `bg-white/[0.1]` (hover); hairlines `border-white/[0.07]`–`/10`; text `text-white`, `text-white/70`
  (secondary), `text-white/50` (tertiary). **Text floor: white/50.** Nothing a person is meant to read
  goes below it (timestamps and counts included); only decorative glyphs and disabled controls may.
  Red scale `red-500` #FF2414 (accents, rings), `red-600` #E50F05 (button bg). Ratings star:
  `fill-star text-star`.
- Glass for chrome only: `.glass` (light) / `.glass-strong` (heavy) — sheets, menus, bars, floating cards.
- Radii by hierarchy: chips/buttons `rounded-full`; posters `rounded-poster` (10px); landscape tiles
  `rounded-tile` (14px); panels/cards `rounded-[22px]`; big frames `rounded-stage` (28px).
- Type: body is Readex Pro (`font-sans`, default). Titles use `font-display` (condensed Bricolage
  Grotesque for Latin, Alexandria for Arabic) with `font-bold` or `font-extrabold`. Page title:
  `font-display text-[clamp(34px,5vw,64px)] font-extrabold leading-[0.95]`. Section title: use
  `<SectionHeader>` (21px→26px). Body 15px, small 13px. Sentence case.
- Never: all-caps labels, tracked eyebrow labels, "·"-joined meta strings (separate spans with
  `gap-x-3`), "→" appended to links (use lucide `ChevronRight` with `rtl:rotate-180` sparingly), emoji
  as icons or in UI copy.
- Icons: `lucide-react` (stroke 1.8–2.2, 16–22px). Brand marks only from `react-icons` (FaWhatsapp…).
- Spacing: sections `space-y-10 sm:space-y-12`; page column = class `page-x` (clears the desktop rail
  and the gutter on both sides); top of a page = class `page-top` (clears the fixed top bar). Max text
  measure ~60–70ch.

## Layout

- Page root: `<div className="pb-10">` with a `PageHeader` (it carries `page-top page-x`), or
  `<div className="page-top pb-10">` with blocks inside using `page-x`. Full-bleed heroes skip `page-x`;
  rows (`<Row>`, `PosterSlider`) handle their own edge-to-edge padding.
- Page header: big display title, optional one-line subtitle in `text-white/55`, optional actions on
  the end side (`src/components/browse/PageHeader.tsx`). No eyebrow label.
- Poster grids: `MediaGrid` / `GRID_CLASS` + `PosterCard` (`src/components/MediaGrid.tsx`); `EmptyState`
  (icon + title + one helpful sentence + action) for empty and error states.
- Forms: `Input`, `Textarea`, `Select`, `Label`, `Switch` from `components/ui`; primary `<Button>` (red
  pill), `variant="secondary"` (glass), `variant="ghost"`; sizes `sm|default|lg|icon`. Labels above
  fields (13px, white/70); errors under the field in `text-red-400 text-[13px]`.
- Panels: `rounded-[22px] bg-white/[0.04] ring-1 ring-white/[0.07] p-5 sm:p-6`.
- Tabs/segmented: `components/ui/tabs` (white pill active) or the `LanguageSwitch` sliding pill
  (framer `m.span layoutId`). Dialogs: `components/ui/dialog`; bottom sheets: `components/ui/drawer`.
- Popover or menu: a panel that holds actions, a form or a list with its own buttons (the desktop
  inbox, a sign-in prompt) is a `Popover` (`components/ui/popover`; give it `role="dialog"` and a
  label when it is a panel). A plain list of commands is a `DropdownMenu`. On phones the same panel
  becomes a `Drawer`.
- Chips (`components/ui/chip`, `ChipGroup`): pick the mode by what the chips do, never by looks.
  `single` filters one way at a time (radio group), `multi` toggles several (`aria-pressed`), `nav`
  goes to other pages (a `<nav>` of links, `aria-current="page"`), `tabs` swaps panels on the same page
  (tablist, manual activation), `none` is a plain list. A removable chip's X is its own button beside
  the chip, never inside it.
- Cards that are links: the whole card is one `<a>`. A secondary action or a dismiss button on it is a
  sibling of the link (positioned over the card), never nested inside it: no button inside a link,
  no link inside a link.
- Overlapping avatars and posters (stacks): logical overlap on the children, `[&>*+*]:-ms-2`, with a
  `ring-2 ring-black` cut-out, so the stack reads the same way in Arabic. Never `-space-x-*`.
- Toasts: `toast({ title, description, variant: 'destructive' })` from `@/src/hooks/use-toast`.

## Motion (Emil Kowalski + Apple)

- `m` from `framer-motion` (LazyMotion is set up app-wide). Tokens in `src/lib/motion.ts`: `spring.ui`
  (default, no overshoot), `spring.snappy`, `spring.momentum`, `spring.pop` (celebrations), `tween.*`,
  `EASE_OUT`, `haptic()` for meaningful taps.
- Press feedback on every pressable: class `pressable` (Buttons already have it).
- Entrances ease-out, 200–300ms; exits faster. Never `transition: all`. Hover only via `hover:` (gated to
  real hover devices). One orchestrated moment per page at most (`animate-focus-in`). Don't animate
  keyboard-driven or very frequent actions. Reduced motion is respected globally.

## Mobile, RTL, languages

- Touch targets ≥ 44px; the floating tab bar sits at the bottom (page padding handles it). Secondary
  actions in sheets; nothing hover-only on touch.
- RTL: logical utilities (`ps-`/`pe-`/`ms-`/`me-`/`start-`/`end-`, `text-start`), `rtl:rotate-180` on
  directional chevrons, `rtl:bg-gradient-to-l` when a gradient starts at the start side. Mixed-direction
  text (titles, names) gets `dir="auto"` or `<bdi>`.
- Languages: English, Arabic (MSA), Tunisian Derja (Arabic script; falls back to Arabic), French (falls
  back to English). Dates through `dateLocale(locale)`; TMDB data through `tmdbLanguage(locale)`.
- Strings: core strings live in `src/lib/i18n/{en,ar,tn}.ts`. A feature's own strings live in its own
  file, `src/lib/i18n/features/<feature>.ts` (`defineStrings({ en, ar, tn?, fr? })`; `ar` must cover every
  key, `tsc` checks it). Keys are namespaced by feature (`social.feed.title`). Reuse existing core keys
  where they fit (`common.*`, `nav.*`).
- Client files never value-import `@/src/lib/i18n` (that module holds every dictionary). They import
  from `@/src/lib/i18n/locales` (languages, direction, `dateLocale`) and `@/src/lib/i18n/translate`
  (`translatorFrom`, `translateApiMessage`), and get `t` from `useT()`. `import type` from the index is
  fine. Never `locale === 'en'` (use `isArabicScript`), never an exhaustive `Record<Locale, ...>`.
- Sentences with a name or a title in them: `richT(t, key, vars, { bold })` from
  `@/src/lib/i18n/rich` isolates each value in `<bdi>` (and bolds the ones you name), so an Arabic name
  in an English sentence, or the reverse, never scrambles the word order.
- Copy around `{name}`. Arabic and Derja: no verb right after `{name}`; use a noun form that works
  for anyone ('طلب صداقة من {name}', 'من {name}: {title}'), never a conjugated verb that would have to
  agree with the person. French: no participle that agrees with `{name}` ('Invitation de {name}', not
  'invité par'); English can say 'Amine invited you'.

## Who's watching

- Accounts have Netflix-style profiles; a **Kids profile** (`getKidsMode()`) only sees kid-safe titles
  (`lib/kids`), and must not see social features, chat-like inboxes, or other people's activity.
- Signed-out visitors see most pages: every signed-in feature needs a good signed-out state (an inviting
  `SignInInvite`, never a dead end).
- Privacy by default: nothing a person watches or rates is visible to anyone until they choose so.
- Naming: a person's public page (`/u/[handle]`, `/me`) is **"Your page"** ('صفحتك', 'Votre page'), or
  "{name}'s page" for someone else's. Viewer profiles stay "profiles", and Settings stays "Settings"
  (`/profile`). Never call the public page just "profile". Its settings section is "Friends and privacy".

## Reference implementations

`src/components/shell/MenuSheet.tsx` (lists, tiles, sign-in card), `src/components/home/Billboard.tsx`
(hero, buttons), `src/components/PickOfTheDay.tsx` (framed card), `src/components/rows/Row.tsx`,
`src/components/PosterCard.tsx`, `src/components/NotificationBell.tsx` (glass dropdown list),
`src/components/VerifyEmailBanner.tsx` (floating card), `src/components/swipe/*` (rooms, sharing, codes),
`src/components/home/ChipRail.tsx` (chips), `src/app/moments/[id]/page.tsx` (simple browse page),
`src/components/ui/popover.tsx` (anchored glass panel), `src/components/library/SignInInvite.tsx`
(signed-out state; it brings people back to the same page after signing in).

New blocks on shared pages (home rows, cards) render nothing when they have nothing to show, never a
placeholder: stream them in `<Suspense fallback={null}>` and bound their data with `withTimeout`
(`src/lib/with-timeout.ts`), so one slow source can't hold the page.

## Keep every feature

Restyle, don't remove: every button, field, API call, validation, string and edge case in a file you
touch must keep working. Read the whole file before rewriting it.
