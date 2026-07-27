# Recall — Product & Engineering Brief
### Mobile-First Study, Notes & Flashcards App
*Working title "Recall" — run a trademark search before locking it in; there are existing apps and services using variants of this name.*

---

## 0. Reality Check Before You Read Further

Three parts of the original scope will bite the team if they go in unexamined:

1. **Real-time collaboration is not an MVP feature, full stop.** It's not a toggle you add later — it changes the data model for the note-content field itself (plain JSON/Markdown vs. a CRDT document type). Decide the note-content storage format *now*, even if collaboration ships in Phase 3, because migrating a live user base's note format later means rewriting every stored note. See §7 and §9.
2. **A WebGL 3D hero on a mobile-first study app is a genuine UX tax, not a free win.** Three.js adds real bundle weight, GPU/battery cost, and thermal throttling risk on the low-to-mid-range Android devices that make up most of the developing-market mobile web. It has to be non-blocking, lazy, and disposable — never load-bearing for the app's actual utility. Treat it as marketing-page garnish, not product identity. See §4.
3. **"Note summarization" is an AI feature with a data-handling obligation attached, not just a UI button.** The moment you send user notes to a third-party LLM API, you've taken on a privacy-policy disclosure requirement and, if you have any EU users, a GDPR data-processing question. This needs an answer before MVP ships, not after. See §12.

Everything below is written to make those three constraints explicit rather than something the team discovers in a retro three months in.

---

## 1. Assumptions & Constraints

- **Platform:** Mobile-first responsive web app (not native). Desktop is a first-class secondary breakpoint, not an afterthought — but touch targets, thumb-reach zones, and one-handed use drive layout decisions first.
- **Core MVP surface:** note capture/organization, AI summarization, flashcard creation, spaced-repetition review, search, tagging, export/import.
- **Deferred to later phases:** real-time multi-user collaboration, AI-generated flashcards from notes, rich media embeds, cross-device conflict-free rich-text editing.
- **Visual reference:** the attached Huly design-token export is used *only* as a structural mood board — surface hierarchy logic, type-scale ratio, spacing rhythm, control geometry. No hex values, the custom "Esbuild" display font, the logo mark, or literal copy from that reference are to be reused. A fully original token set is defined in §3.2 for exactly this reason — see §12 for why this matters legally, not just stylistically.
- **Backend:** must be honest about what "real-time" means at each phase. MVP uses request/response + one-way server-sent streaming for AI output. Bidirectional real-time (WebSocket presence, live cursors, collaborative editing) is explicitly Phase 3, gated on CRDT infrastructure being in place.
- **Offline:** required from MVP for notes, tags, decks, and flashcards (the tabular/structured data). Offline support for rich-text conflict resolution is a harder problem, deferred until the note-content format decision in §7 is locked.
- **Accessibility:** WCAG 2.2 AA is the target bar, not "best effort."

---

## 2. UI/UX Point of View

### 2.1 Design Philosophy

The reference system (Huly) works because it commits to two hard rules: one accent does all the brand work, and every control uses the same geometric language. Steal the *discipline*, not the palette.

For a study/memory app specifically, color has a job beyond branding: spaced-repetition review already has a semantic color language users half-know from every flashcard app they've touched (red = forgot, amber = hard, green = got it, blue = easy). Fighting that convention with brand color in the review screen would be a usability regression dressed up as originality. So the system below splits into two layers:

- **Brand layer** — one primary accent, one sparingly-used secondary, for navigation, CTAs, and identity.
- **Semantic layer** — a separate, fixed four-color grading scale for the review screen only, never touched by rebranding.

Overall direction: **near-black graphite canvas, single signal-green accent, rounded-rectangle (not full-pill) controls** — distinct enough from the reference to stand on its own, dark and cinematic enough to feel premium rather than "SaaS admin panel #4,281."

### 2.2 Design Tokens (Original — Do Not Reuse Huly's Values)

**Colors**

| Token | Value | Role |
|---|---|---|
| `--color-canvas` | `#14161A` | Default page background, dark mode |
| `--color-void` | `#0A0B0D` | Deepest layer — modal backdrops, hero base |
| `--color-card` | `#1C1F24` | Elevated card/panel surface |
| `--color-border` | `#2C2F36` | Hairline dividers, card edges |
| `--color-text-muted` | `#8A8D94` | Tertiary text, placeholders |
| `--color-text-secondary` | `#B4B7BD` | Secondary text, captions |
| `--color-text-primary` | `#F2F3F5` | Primary reading text |
| `--color-accent` | `#34E7A8` | Primary CTA, active nav state, brand mark — the single "switched on" color |
| `--color-accent-warm` | `#FFB454` | Sparingly used: due-soon indicators, streak flame icon, one gradient stop in the hero. Never a second brand color — a punctuation mark |
| `--color-canvas-light` | `#FFFFFF` | Light-mode canvas, editorial/marketing bands |
| `--color-linen-light` | `#F5F6F4` | Soft secondary light-mode tint |

**Semantic grading scale (review screen only — fixed, never rebrand this)**

| Token | Value | Meaning |
|---|---|---|
| `--grade-again` | `#F0554B` | Forgot / restart interval |
| `--grade-hard` | `#F5A623` | Recalled with difficulty |
| `--grade-good` | `#34E7A8` | Recalled correctly (reuses brand accent deliberately) |
| `--grade-easy` | `#4C8CFF` | Recalled instantly |

Run every text/background pairing above through an automated contrast checker (axe-core or the WebAIM tool) in CI before shipping — don't take these values on faith; verify them against the actual rendered component, since contrast is affected by font weight and size, not just the raw hex pair.

**Typography**

| Face | Use | License |
|---|---|---|
| **Inter** | All functional UI — body, nav, buttons, captions. 400 body / 500–600 emphasis. | SIL Open Font License — free, commercial use, no attribution required |
| **Space Grotesk** | Display only — hero headline, section openers. 32–72px, tight tracking. Never below 24px. | SIL Open Font License, hosted free on Google Fonts |

Do not commission or license a paid display face for MVP. Space Grotesk gets you 90% of the "editorial, not generic SaaS" effect at zero cost and zero licensing review overhead. Revisit a custom commissioned type only after the brand is validated with real users.

**Shape & Spacing**

- Base unit: 4px.
- Buttons: **12px radius**, not full pill — this alone reads as a distinct system from Huly at a glance.
- Cards: 16px radius. Modals/sheets: 24px radius (mobile bottom-sheets in particular benefit from a larger top radius).
- Section rhythm: 64px vertical gap on mobile, 96px on desktop.

### 2.3 Core Screens (MVP)

Onboarding → Home/Library (notes list, grouped by notebook/tag) → Note Editor → Summarize action (async, streamed) → Deck List → Card Editor (manual + "generate from this note" stub for later) → Review Session (full-screen, gesture-first: swipe or tap to grade) → Search (global, notes + cards) → Settings.

---

## 3. 3D Landing Experience — Requirements

**Scope discipline:** the 3D scene exists on the public marketing/landing route only. It never loads inside the authenticated app shell. This is non-negotiable — it protects the actual product from ever being blocked on WebGL.

**Initial config**
- Library: Three.js, minimal custom shader (a single vertex-displaced plane or particle field — do not import a heavy pre-built scene template).
- Target: a slow, ambient, low-poly abstraction (think: drifting light particles suggesting "memory forming" or a soft depth-of-field starfield) — not a literal 3D object requiring orbit controls. Ambient scenes are cheaper to render and don't invite interaction patterns you then have to make accessible.

**Performance budget**
- Scene JS (Three.js + custom code, gzipped): under 150KB.
- Scene must be lazy-loaded *after* the Largest Contentful Paint (LCP) element (the headline + CTA) has painted — use `IntersectionObserver` and dynamic `import()`, never block first paint on WebGL.
- Cap to 30fps on `devicePixelRatio > 1` devices to control GPU/thermal load; detect low-memory devices (`navigator.deviceMemory < 4` where available) and skip the scene entirely on those.
- Pause the render loop with the Page Visibility API when the tab isn't focused.

**Fallbacks (mandatory, not optional)**
1. No WebGL context available → static CSS gradient using the accent tokens above, or a single optimized AVIF/WebP poster frame.
2. `prefers-reduced-motion: reduce` → static poster frame, no exceptions. Do not offer a "reduce but still animate slowly" middle state — reduced motion means static.
3. `navigator.connection.saveData === true` or a slow effective connection type → skip the WebGL bundle download entirely, serve the poster frame.

**Accessibility**
- The `<canvas>` element is `aria-hidden="true"`; it is decorative, not informational, so it must never be the only carrier of content.
- Headline and CTA are real DOM text, not baked into the canvas or an image — screen readers and SEO crawlers need this regardless of the 3D layer's state.

---

## 4. GSAP Animation Plan

GSAP's licensing changed materially in 2025 and this affects your build decision, so it's worth stating precisely: as of **April 30, 2025**, GSAP — including every plugin that used to require a paid Club GreenSock membership (ScrollTrigger, SplitText, MorphSVG, DrawSVG, ScrollSmoother, Inertia) — is free for commercial use under GSAP's Standard License, following Webflow's acquisition of GreenSock. <cite index="4-1">Webflow made GSAP 100% free for the web community, giving developers more freedom to harness the full breadth of GSAP-powered motion, expanding the standard license to cover commercial use at no cost.</cite> The one carve-out in that license is a prohibition on building a *no-code visual animation tool that competes with Webflow's own builder* <cite index="5-1">— "Prohibited Uses" means implementation of GSAP Products in tools that allow users to build visual animations without code that competes with Webflow's visual animation building capabilities</cite> — which has zero relevance to a study app. Net effect: no licensing cost or review overhead, use whichever plugins the animation plan actually needs.

**Sequences**
1. **Hero entrance:** headline chars/words fade+rise (SplitText, now free — use it, it's the right tool), staggered 40ms, CTA fades in 200ms after.
2. **Scroll-triggered feature reveals:** ScrollTrigger-pinned sections for the 3–4 feature cards below the fold, each triggering a fade+8px-rise on entry, `once: true` (don't re-animate on scroll-back, it reads as janky rather than polished).
3. **Review-session micro-feedback:** card flip (CSS `transform: rotateY`, GSAP-driven timeline) on tap; grade-button press gives a 120ms scale-down/up "confirm" pulse.
4. **Progress/streak counter:** number roll-up animation on the home screen (GSAP `+=` tween on a proxy object, not on raw DOM text nodes, to avoid layout thrash).

**`prefers-reduced-motion` handling**
- Wrap every ScrollTrigger and entrance timeline in a check against `window.matchMedia('(prefers-reduced-motion: reduce)').matches`.
- Reduced-motion path: opacity-only crossfades, 0 duration on transforms, no scroll-pinning, no auto-playing counters (jump straight to end value).
- This is a build-time branch, not a "lower the duration" tweak — test it as its own path in QA.

---

## 5. Technology Stack

| Layer | Recommendation | Why |
|---|---|---|
| Frontend framework | **Next.js (App Router) + TypeScript** | Given your CADENCE and Reel builds already standardized on Next.js, staying consistent here cuts ramp-up time and lets you reuse SSR/streaming patterns you've already solved. |
| State | React Context for auth/theme (low-frequency), **TanStack Query** for all server state (notes, decks, cards) instead of Redux — spaced-repetition apps are fundamentally "fetch, mutate, invalidate" workloads, and Query's cache + optimistic-update model fits that better than a hand-rolled Redux store. | Reduces boilerplate vs. Redux Toolkit for this specific data shape. |
| Styling | Tailwind (v4, CSS-first `@theme` config) | Matches the token system in §2.2 directly; avoids a second styling paradigm. |
| 3D/animation | Three.js + GSAP (see §3–4) | As specified. |
| Backend | **Fastify (Node.js) + PostgreSQL** | Same stack family as CADENCE — reuse your auth middleware, request validation, and deployment pipeline instead of standing up a second backend pattern from scratch. |
| AI summarization transport | **SSE (Server-Sent Events)**, not a full WebSocket, for MVP | You already have SSE streaming solved from CADENCE's AI chat work. SSE is one-directional (server→client), which is exactly what "stream a summary as it generates" needs — it's simpler to operate than bidirectional WebSocket infrastructure and doesn't require you to have solved presence/rooms yet. Save WebSocket for when Phase 3 collaboration actually needs bidirectional presence. |
| Search / embeddings | **pgvector** on the same Postgres instance | Powers both semantic search over notes (Phase 2) and "find related notes" without adding a second database. Also consistent with your existing stack decisions. |
| Auth | JWT access token (15 min) + httpOnly refresh cookie (rotating), email/password via Argon2id hashing, Google OAuth2 at minimum for MVP | Standard, auditable, no vendor lock-in. |
| Offline persistence | **Dexie.js (IndexedDB wrapper)** | Same library your GullyScore offline-first architecture already uses — direct pattern reuse. |
| Testing | Playwright (E2E), Vitest (unit) | Playwright for the review-flow and offline-sync critical paths especially — these are the two places regressions are costly and easy to miss manually. |

---

## 6. Data Model

| Entity | Key Fields | Notes |
|---|---|---|
| **User** | id, email, passwordHash, name, avatarUrl, authProvider, createdAt | |
| **Settings** | userId (FK, 1:1), theme, reducedMotion, dailyNewCardLimit, dailyReviewLimit, timezone, aiProcessingOptOut (bool) | The `aiProcessingOptOut` field exists specifically because of §12 — users need a way to keep specific content out of the summarization pipeline. |
| **Notebook** | id, userId, name, color, parentId (nullable, for nesting), createdAt | |
| **Note** | id, userId, notebookId, title, contentJSON (see §7 for format decision), contentPlainText (denormalized, for FTS/pgvector indexing), isArchived, isPinned, createdAt, updatedAt | |
| **Tag** | id, userId, name, color, createdAt | |
| **NoteTag** | noteId, tagId | join table |
| **Summary** | id, noteId, summaryText, modelUsed, status (pending/streaming/complete/failed), createdAt | Kept separate from Note so regenerating a summary never touches the source content. |
| **Deck** | id, userId, name, description, color, createdAt | |
| **Flashcard** | id, deckId, sourceNoteId (nullable), cardType (basic/cloze), front, back, createdAt, updatedAt | |
| **SchedulingState** | cardId (FK, 1:1), dueDate, stability, difficulty, interval, repetitions, lapses, algorithmVersion, lastReviewedAt | One row per card, updated on every review — see §12 on FSRS vs. SM-2. |
| **ReviewLog** | id, cardId, userId, reviewedAt, grade (again/hard/good/easy), previousInterval, newInterval, responseTimeMs | Append-only; this is your audit trail and the raw material for any future "retention analytics" feature. |
| **Attachment** | id, noteId, fileUrl, fileType, sizeBytes, createdAt | |
| *(Phase 3)* **CollabSession**, **PresenceState** | — | Deliberately not designed yet — depends on the CRDT decision in §7/§9. Designing this now would be guessing. |

---

## 7. API Contract Skeleton (REST, high-level)

**Auth**
`POST /auth/register` · `POST /auth/login` · `POST /auth/refresh` · `POST /auth/logout` · `GET /auth/me` · `GET /auth/oauth/:provider/redirect`

**Notes**
`GET /notes` (filters: notebookId, tag, archived) · `POST /notes` · `GET /notes/:id` · `PATCH /notes/:id` · `DELETE /notes/:id`
`POST /notes/:id/summarize` → kicks off an async job, returns `{ summaryId, status: "pending" }`
`GET /notes/:id/summary/stream` → **SSE** endpoint, streams tokens as the summary generates, terminates with a `done` event

**Tags / Notebooks**
`GET|POST /tags`, `PATCH|DELETE /tags/:id`, `POST|DELETE /notes/:id/tags/:tagId` — same shape for `/notebooks`

**Decks & Flashcards**
`GET|POST /decks`, `GET|PATCH|DELETE /decks/:id`
`GET|POST /decks/:id/cards`, `PATCH|DELETE /cards/:id`
`POST /notes/:id/generate-cards` — **stubbed in MVP, returns 501 Not Implemented on purpose** until the AI-generated-flashcards feature is actually built in Phase 2; don't ship a fake success response for a feature that doesn't exist yet.

**Review**
`GET /review/queue?deckId=` → returns due cards ranked by the scheduling algorithm
`POST /cards/:id/review` → body `{ grade, responseTimeMs }`, returns updated `SchedulingState`

**Search**
`GET /search?q=&type=notes|cards&tags=`

**Export / Import**
`GET /export?format=markdown|json` (MVP formats — see §12 on why `.apkg` is a Phase 2+ decision, not MVP)
`POST /import` (multipart, `format` param)

**Realtime — phased honestly**
- MVP: SSE only, one endpoint (`/notes/:id/summary/stream`), no persistent connection registry needed.
- Phase 3: `WS /ws/collab/:noteId` — gated entirely on the CRDT decision below.

---

## 8. Offline & Sync Strategy

- **Structured data (notebooks, tags, decks, cards, scheduling state):** Dexie/IndexedDB mirrors the server schema. Writes go local-first with optimistic UI, queued in an `outbox` table, flushed via a Service Worker background-sync when connectivity returns. Conflict resolution: last-write-wins keyed on `updatedAt`, which is fine for this data — a tag rename or a card edit rarely has two people editing it at once in a single-user MVP.
- **Rich-text note content is the hard case, and this is the decision that has to happen before Phase 1 coding starts, not after:**
  - **Option A (simple, MVP-friendly):** store note content as plain JSON (e.g., a ProseMirror/Tiptap document tree) or Markdown. Offline editing works fine single-user. Last-write-wins is *acceptable* for a single user editing across two of their own devices, but it is *not* viable the moment a second human edits the same note — so this option caps you at single-user editing until you migrate.
  - **Option B (collaboration-ready from day one):** store note content as a **Yjs** CRDT document from the start. Yjs is purpose-built for exactly this — offline-first local edits that merge conflict-free when reconnected, *and* it's the same data structure real-time collaboration needs later, so Phase 3 doesn't require a content-format migration at all.
  - **Recommendation:** Option B, even though real-time collab is Phase 3. The cost of adopting Yjs early (a slightly less human-readable stored format, a small library dependency) is much lower than the cost of migrating every user's note content mid-flight later — that migration is the kind of thing that corrupts formatting on edge cases and generates support tickets for months. This is the single highest-leverage architecture decision in this whole brief.
- **Search index:** rebuild the local FTS index (or query the pgvector-backed server index when online) rather than trying to sync a search index offline — search staleness by a few minutes is an acceptable trade, sync complexity for a search index is not worth the engineering cost.

---

## 9. Detailed User Flows

**Onboarding**
Landing (3D hero) → Sign up (email or Google OAuth) → single-screen preference capture (daily new-card limit, reduced-motion preference, theme) → empty-state Home screen with a "Create your first note" and "Import from Markdown" dual CTA — don't force a tutorial walkthrough; an empty state with one obvious action converts better than a 5-step tour for a utility app.

**Create/Edit Note**
Home → "+" (thumb-reachable, bottom-right on mobile) → Editor (title + rich-text body) → autosave every ~2s to local Dexie store + debounced sync to server when online → tag/notebook assignment via a bottom sheet, not a modal (mobile-first: sheets preserve context, modals interrupt it).

**Summarize a Note**
Note view → "Summarize" action → optimistic UI shows a streaming skeleton → SSE stream populates the summary card token-by-token → summary is saved as a separate `Summary` record (never overwrites the source note) → user can regenerate or dismiss.

**Create Flashcards**
From a note: select text → "Make flashcard" → pre-fills `front` with the selection, cursor moves to `back` for manual entry (MVP is manual; "auto-generate from note" is the `501` stub above, built out in Phase 2 once summarization quality is validated — auto-generating cards from a bad summary produces bad cards, so sequencing matters). Standalone: Deck view → "+ Card."

**Study / Spaced-Repetition Review**
Deck (or Home "Due Today") → Review session, full-screen, one card at a time → tap/swipe to reveal answer → four-button grade (Again/Hard/Good/Easy, using the semantic palette from §2.2) → `SchedulingState` updates, next card loads immediately, no confirmation dialog (confirmation friction on a repeated action of 20+ per session is a real usability cost) → session-end summary (cards reviewed, new streak count).

**Search**
Persistent search entry point (bottom nav on mobile) → query returns notes and cards in separate, clearly labeled sections, ranked by recency + relevance → tag filter chips above results.

**Export / Import**
Settings → Export → format picker (Markdown zip / JSON) → server generates async, emails/downloads link when ready for large exports. Import mirrors this, with a pre-import preview screen showing "X notes, Y tags will be created" before committing — never import silently into a user's existing library without a preview step.

---

## 10. Accessibility & Internationalization

**Accessibility**
- Target WCAG 2.2 AA. Every interactive element gets a visible `:focus-visible` state distinct from hover (dark UIs especially tend to skip this and then fail keyboard-nav audits).
- Skip-to-content link on every route.
- The streaming summary and toast notifications use `aria-live="polite"` regions — async content that appears without user action needs to be announced, not silently rendered.
- Review-session grading is fully keyboard-operable (number keys 1–4 mapped to Again/Hard/Good/Easy is the de facto convention in this product category — following it costs nothing and meets user expectations from other tools).
- Run axe-core in CI (Playwright has an axe integration) on every PR touching a shared component, not just as a pre-launch pass — accessibility regressions creep in one Tailwind class change at a time.

**Internationalization**
- Even if MVP ships English-only, wire copy through `next-intl` or `react-i18next` from the start — retrofitting i18n keys into hardcoded JSX strings later is a full-team, multi-week tax that's entirely avoidable by paying a small tax now.
- Use CSS logical properties (`margin-inline-start`, not `margin-left`) throughout. Given your location, Urdu is a plausible future locale and it's RTL — logical properties mean RTL support is a `dir="rtl"` flip and a font swap, not a layout rewrite.

---

## 11. Legal & Licensing Clarity

This is not legal advice — treat the points below as things to raise with actual counsel before public launch, not as a substitute for that review.

- **On the Huly reference specifically:** Huly's application source code is licensed under **EPL-2.0** and is genuinely open — <cite index="15-1">the Huly platform source code is available on GitHub, and self-hosted deployments are free to use and modify under that license</cite>. But that license attaches to the *code repositories*, not automatically to the marketing site's specific visual design, brand mark, wordmark, or the literal headline copy shown in the screenshot you provided — those are typically governed separately (often all-rights-reserved) even alongside an open-source codebase, and reproducing a competitor's distinctive visual identity too closely can raise trade-dress concerns independent of copyright. This is exactly why §2.2 defines an original token set rather than reusing the extracted values — treat the reference as a structural mood board only, never as source material to be copied.
- **GSAP:** confirmed free for commercial use including all former paid plugins as of April 30, 2025 (see §4 for the citation and the one narrow carve-out, which doesn't apply here). No licensing cost or review needed.
- **Fonts:** Inter and Space Grotesk are both SIL Open Font License — free for commercial use, no attribution requirement, no licensing review needed. This is precisely why §2.2 recommends them over a bespoke display face for MVP.
- **Spaced-repetition algorithm:** the classic SM-2 algorithm (Wozniak, 1987) has been publicly documented and freely implemented by dozens of open-source projects for decades — no licensing barrier. **FSRS** (Free Spaced Repetition Scheduler) is MIT-licensed, open source, and generally benchmarks as more accurate than SM-2 in independent testing — recommend building on FSRS from day one rather than shipping SM-2 first, since migrating users' scheduling state between algorithms mid-flight disrupts their review queues. Avoid using competitor product names ("Anki-style scheduling") in *user-facing marketing copy* even though the math itself is open and unencumbered — keep those references in internal engineering docs only.
- **Export interoperability:** Markdown/JSON export is unambiguous. If `.apkg` (Anki-package) export gets added later, note it's a documented, widely-implemented SQLite-based container format with existing open-source libraries — but don't use the word "Anki" in-product UI without framing it clearly as an interoperability feature, not an affiliation or endorsement.
- **AI summarization data handling:** sending user note content to a third-party LLM API is a data-processing event that needs disclosure in the privacy policy, plus (per §6) a per-user opt-out setting. If you take EU users, this likely needs a data-processing agreement with whichever LLM vendor you use and a documented retention/deletion policy — flag this to counsel before EU launch specifically, not as a general "someday" item.
- **App name/logo/trademark:** run an actual trademark clearance search before locking "Recall" (or whatever name ships) — consistent with the clearance step you've already been flagging on other projects (Reel, for instance).

---

## 12. Phased Roadmap

Sizing below is relative (S/M/L/XL) rather than calendar time, since actual duration depends on team size and availability, which isn't specified here — apply your own throughput to size these into a schedule. Confidence on the *sequencing* is high; confidence on any specific calendar estimate without headcount is low, so none is given.

### Phase 1 — MVP
**Ships:** email/Google auth · notebook + note CRUD with autosave · tagging · AI summarization via SSE streaming (with the opt-out setting live from day one, not bolted on later) · manual flashcard creation · FSRS-based review engine · offline support for notes/decks/cards via Dexie · global search (notes + cards) · Markdown/JSON export-import · 3D marketing landing page with full fallback chain · dark/light theme · WCAG 2.2 AA baseline.

**Explicitly cut from MVP (say so loudly, don't let this creep back in silently):** real-time collaboration, AI-generated flashcards from notes, `.apkg` export, non-Google OAuth providers, rich media embeds beyond basic image attachment.

**Exit criteria:** a user can capture a note, get it summarized, turn it into cards, and complete a review session — fully offline after first load, with sync resuming cleanly on reconnect. That end-to-end loop, tested under airplane-mode-toggle conditions in Playwright, is the actual MVP bar — not a feature checklist.

### Phase 2 — Depth
**Ships:** AI-generated flashcard suggestions from a note/summary (now that summarization quality is validated in production) · richer editor (tables, code blocks, image paste) · pgvector-powered semantic search and "related notes" · `.apkg` export · daily/weekly study analytics (retention rate, streak) · push/email due-card reminders.

### Phase 3 — Real-Time & Polish
**Ships:** actual bidirectional collaboration on shared notebooks, built on the Yjs foundation laid in Phase 1 (§9) — presence indicators, live cursors, comment threads · WebSocket sync layer replacing SSE-only transport · full performance and accessibility re-audit · advanced onboarding personalization.

---

## 13. Open Risks & Questions for the Team

1. **LLM vendor for summarization** — cost-per-summary, latency, and data-retention terms differ a lot by provider; this choice gates the privacy-policy language in §12 and should be locked before Phase 1 engineering starts, not mid-sprint.
2. **FSRS parameter initialization** — FSRS needs either default global parameters (fine for MVP) or per-user optimization from review history (a Phase 2 refinement, not a blocker).
3. **Yjs adoption cost** — confirm the team's comfort with CRDT concepts before committing to §9's recommendation; it's the right long-term call but it is a real learning curve if nobody on the team has used Yjs before. Budget onboarding time for it explicitly rather than assuming it's a drop-in library.
4. **Trademark clearance on "Recall"** — flagged in §12, needs an actual answer before the name goes on a splash screen anywhere public.
