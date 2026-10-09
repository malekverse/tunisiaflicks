TRACK ai-search · WAVE 2 · effort XL. 'Ask' turns a sentence into real TMDB titles. It is a second mode of the existing search, not a chatbot.
- Not for Kids or TV mode in v1.
- Guests may use it, with limits.
- Without GROQ_API_KEY the feature disappears completely.

COMMON RULES
- Workspace
  - Worktree: C:/Users/malek/AppData/Local/Temp/claude/C--Users-malek-OneDrive-Attachments-Documents-GitHub-tunisiaflicks/6a114b99-37cf-4f20-bc1e-b374d7220f50/scratchpad/tf-extras (branch feat/redesign), shared. Edit only your files.
- Git (the index is shared)
  - Stage only your paths. Commit with `git commit -m 'msg' -- <paths>`.
  - Never a bare commit, add -A, stash or reset.
  - On index.lock, retry after 2–10s.
- Design: follow docs/DESIGN.md. Text ≥ white/50.
- Strings: features/ai.ts (en+ar, tn, fr).
- Client imports come from i18n/locales and use catalogueLanguage/tmdbLanguage.
- Tooling
  - Run `npx tsc --noEmit --incremental false`. Don't touch :3300.
  - Unit tests: tests/ai-search.unit.test.ts (erasable TS only, run by npm run test:unit).
  - Mongo 5.9: findOneAndUpdate returns {value}.
- Free tiers only.

FILES: see ownership 'ai-search'.

PLACEMENTS
1. ChipRail (server)
- Leading 'Ask' chip (AiMark) → /search?mode=ask, only when aiSearchEnabled() && !getKidsMode() && !isTvMode().
- Change the 'mood.new' icon from Sparkles to CalendarPlus, so sparkles mean AI only.
- Skip the moment chip whose id equals getSeasonalBanner({kids, signedIn:false})?.id.
2. CommandPalette
- Ask item: 'Ask: “{query}”', AiMark tile 36px, row metrics same as titles.
  - It is the FIRST item only when looksLikeAsk(q) (score ≥4 and ≥3 words).
  - Otherwise, for 3+ words, it is the LAST item, after Titles and People and before 'See all results'.
  - The existing 'Enter with nothing highlighted opens results' path must keep working.
- Ctrl/⌘+Enter asks from anywhere.
- Empty state: 'Try asking', 2 prompts (seed hash of tunisToday plus hour).
- Footer hint: '⌘↵ to ask' or 'Ctrl ↵'.
- Status comes from aiSearchStatus() (server action, memoized).
- Hidden for Kids (useProfiles) and in TV mode (useTvMode).
3. /search (keep every current behaviour)
- 'Titles | Ask' switch: buttons with a layoutId pill, driven by the `mode` URL param.
- Ask mode
  - Placeholder 'A title, a person, or describe a mood…', maxLength 160, enterKeyHint search. Enter asks.
  - Answer, in order:
    1. Interpretation chips (Chip with onRemove; the remove button is a sibling), led by AiMark, with an Undo toast (5s).
    2. MediaGrid.
    3. AiNote 'Suggested by AI from TMDB data. It can be wrong.'
    4. Show more.
- Titles mode with 3+ words: a quiet 'Ask instead' line.
- Empty Ask: 3 daily example chips plus 'Ask uses an AI model. It only sees the words you type.'
4. AiMark
- lucide Sparkle, white on glass, never red.
- Thinking pulse (static under reduced motion).
- Exports AiMark({size, thinking?}) and AiNote().

BACKEND
- config.ts
  - aiSearchEnabled() = !!GROQ_API_KEY && AI_SEARCH_OFF !== '1'.
  - PROMPT_VERSION 'ai-1'. GROQ_BASE https://api.groq.com/openai/v1.
  - The model list comes only from GET /models (revalidate 86400): models with structured outputs use schema mode, json_mode models use json mode. Preference ['openai/gpt-oss-120b', 'openai/gpt-oss-20b'] is a sort order; AI_SEARCH_MODELS overrides it. Exclude whisper, orpheus, prompt-guard, allam.
  - TIMEOUTS {firstModel 7000, nextModel 4500, overall 12000}.
- groq.ts
  - Strict json_schema, temperature 0, seed 7, max_completion_tokens 500, reasoning_effort low, include_reasoning false.
  - User content is JSON {year, request}. Never a user field.
  - Read x-ratelimit-remaining-tokens/-requests into aiState; skip a model with fewer than 1500 tokens left; block it until reset after a 429.
- Budget (cache.ts / limits.ts)
  - Before every Groq call, an atomic $inc on aiState {_id:'budget:YYYY-MM-DD', calls, guestCalls, tokens}: updateOne with filter calls < AI_DAILY_CALLS (default 300) and, for guests, guestCalls < 40% of it, with upsert. A duplicate-key error or modifiedCount 0 means exhausted.
  - After the call, add usage.total_tokens.
  - Any DB error fails closed: no model call, fall back to quickPlan.
  - Cache hits never count.
- Rate limits (limits.ts; fails closed, unlike src/lib/rate-limit.ts)
  - Guests: keyed on a first-party tf-gid cookie (16 random bytes, httpOnly, lax, 1 year, set by the route) — 6/min and 30/day. Backstop per IP (IPv6 /64): 60/min and 300/day.
  - Users: 10/min and 80/day.
  - ai:global: 6/min per model.
  - ai-run: 40/min.
  - 429 {code, retryAfter, signIn}.
- prompt.ts: static SYSTEM_PROMPT (~450 tokens). The request is data. Covers en, fr, MSA, Derja and Arabizi. Strict PLAN_JSON_SCHEMA.
- schema.ts (zod)
  - Caps: genres 3, keywords 4, places 3, countries 12, languages 3, people 2.
  - Ranges: years 1900..now+1, runtime 20–400, minRating 5–9.
  - ISO codes are checked against TMDB configuration. Spans must appear verbatim in the query.
  - searchPlanSchema v1.
- normalize.ts (client-safe): cleanInput, scrubPersonal (emails, URLs, phones including Tunisian 8-digit), normalizeQuery, askScore/looksLikeAsk, isOwnSpan.
- heuristic.ts: quickPlan (~150 entries).
- vocab.ts: REGIONS arab/maghreb come from ARAB_TMDB_COUNTRIES.
- interpret, resolve, execute
  - Allow-listed discover parameters only.
  - vote_count ≥50 for movies, ≥30 for TV, 5 for Arab titles.
  - Score = 10·coverage + 4·like + 3·bayes + 1.5·rank.
  - At most 14 calls, 6 concurrent. Top 40.
- cache.ts: aiSearchCache (14d model / 10 min parser), aiState, aiStats (90d, no query text).
- plan-codec.ts: the '~' DSL.

ROUTE POST /api/ai/search
- nodejs runtime, force-dynamic, maxDuration 25.
- Guards: JSON only; Origin must match Host (403); Kids 403; disabled 404; denyLimitedSession.
- Body {q, plan?, page?}. Locale comes from getLocale.
- NDJSON events: plan, results, switch, error.
- Client plans are re-validated, and labels are re-derived from ids. The model never writes user-visible copy.

CLIENT
- use-ai-search reads the stream with an AbortController.
  - The reading state appears only after 150ms.
  - replaceState keeps /search?mode=ask&q=&p=.
  - A p= link makes no model call.
- States
  - likeNotFound, unmatched.
  - Empty: SearchX + 'Try without “{label}”'.
  - Rate limited; daily limit with a sign-in CTA for guests; budget exhausted ('Ask is resting. Results use simple matching.').
  - TMDB failure; switched to titles.
- Motion: chips enter with spring.ui and a 40ms stagger (cap 8). No per-card stagger.
- Accessibility: one sr-only status. Backspace on a focused chip removes it.
- Strings: ai.* (ask, placeholder, searchOrAsk, try.*, state.*, chip.*, notice.*, error.*, empty.*, note, thinking). ar AiNote: 'اقترحه الذكاء الاصطناعي من بيانات TMDB وقد يخطئ.'

SHARED-FILE REQUESTS
- layout/TopBar: integration computes ask.
- legal: the Groq paragraph.
- README: GROQ_API_KEY, AI_SEARCH_MODELS, AI_SEARCH_OFF, AI_DAILY_CALLS; the Groq org has no payment method.

ACCEPTANCE
1. Unit tests
   - normalizeQuery, cleanInput, scrubPersonal
   - a 40-case looksLikeAsk table, including 'the lord of the rings' → false
   - quickPlan, codec round-trips, schema rejections
2. Without a key: 404, and no Ask anywhere, including the palette.
3. Requests
   - Bad body → 400; crafted plan → 400; cross-origin → 403.
   - The valid plan 'k:m~g:comedy~y:1990-1999~s:top' returns plan, then results.
4. In the palette, 'the lord of the rings' + Enter opens the film.
5. With a key: a repeat hits the cache; the per-minute cap returns 429; with the budget exhausted, quickPlan answers.
6. Kids and TV mode show no Ask. Title search is unchanged.
7. The eval script runs 40 queries and 10 injections.