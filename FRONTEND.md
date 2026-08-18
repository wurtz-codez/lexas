# FRONTEND.md — Lexas Renderer

This documents the **current state** of the Electron renderer (React 19 + TypeScript + Vite + Tailwind CSS v4). It covers the tech stack, how the app is wired together, the IPC surface, the screens that exist today, and the user workflow through the current application.

> Companion docs: `AGENTS.md` (project tracker / backend), `DESIGN.md` (design system), `FRONTEND_PLAN.md` (original build plan). This file is the "as-built" record of the frontend.

---

## Tech Stack (renderer)

| Concern            | Technology                      | Notes                                        |
| ------------------ | ------------------------------- | -------------------------------------------- |
| UI framework       | React 19                        | `createRoot` in `main.tsx`                   |
| Bundler            | Vite                            | Forge Vite plugin                            |
| Styling            | Tailwind CSS v4 + PostCSS       | `@tailwindcss/postcss`                       |
| UI components      | shadcn/ui + Radix primitives    | In `src/components/ui/`                      |
| Icons              | lucide-react                    | `size-4` etc. via button `[&_svg]` rule      |
| Animation          | motion (framer-motion)          | `motion/react` — welcome, onboarding, swipe deck |
| Routing            | React Router (BrowserRouter)    | Providers wired; no `<Routes>` defined yet   |
| Server-state       | TanStack Query                  | Brief data + mutations via IPC               |
| Client-state       | Zustand                         | Auth store only                              |
| Toasts             | sonner (`<Toaster />`)          | Refresh/sync/feedback errors                 |
| Themes             | custom ThemeProvider            | `light` / `dark` / `system`, localStorage    |
| Bridge             | contextBridge (preload)         | Typed `window.electron.*`                    |

---

## Architecture & File Map

```
src/
├── main.tsx                  # React entry — renders <App/>
├── App.tsx                   # Providers + top-level gate (auth → onboarding → layout)
├── preload.ts                # contextBridge → exposes window.electron.*
├── types/index.ts            # Shared IPC + domain types (renderer + main)
├── styles/globals.css        # Tailwind v4 + shadcn CSS vars
├── components/
│   ├── ui/                   # shadcn primitives (button, card, badge, avatar, …)
│   └── layout/root-layout.tsx# Header, theme/settings toggles, context banner, main area
├── features/
│   ├── auth/                 # auth-store (Zustand), config, welcome-page, connect-account, auth-gate
│   ├── onboarding/           # onboarding-flow (5-step wizard)
│   ├── settings/             # context-editor (edit profile/projects/people)
│   └── brief/                # hooks.ts + swipe deck components
└── lib/
    ├── theme-provider.tsx    # ThemeProvider + useTheme
    └── utils.ts              # cn() (clsx + tailwind-merge)
```

---

## IPC Surface (`window.electron.*`)

Exposed in `src/preload.ts`, typed in the `Window` global of `src/types/index.ts`. Every call is an `ipcRenderer.invoke` into a main-process handler.

| Namespace   | Method                              | Returns                              | Backend handler                     |
| ----------- | ----------------------------------- | ------------------------------------ | ----------------------------------- |
| `auth`      | `startOAuth(provider)`              | `AuthResult`                         | `oauth-server.ts`                   |
|             | `signOut()`                         | `void`                               | `oauth-server.ts`                   |
|             | `getStatus()`                       | `AuthStatus`                         | `oauth-server.ts`                   |
| `onboarding`| `save(data)`                        | `void`                               | `onboarding-server.ts`              |
|             | `setCompleted()`                    | `void`                               | `onboarding-server.ts`              |
|             | `getStatus()`                       | `OnboardingStatus`                   | `onboarding-server.ts`              |
| `sync`      | `gmail()` / `calendar()`            | `SyncResult`                         | `sync-server.ts`                    |
|             | `correlate()`                       | `CorrelationResult`                  | `sync-server.ts`                    |
|             | `runAll()`                          | `RunAllSyncResult`                   | `sync-server.ts` (best-effort)      |
| `brief`     | `generate(date, tzOffsetMinutes)`   | `BriefResult`                        | `brief-server.ts` / `context-engine`|
|             | `getLatest()`                       | `BriefDetail \| null`                | `brief-server.ts`                   |
| `feedback`  | `submit(briefItemId, type)`         | `void`                               | `feedback-server.ts`                |
| `calendar`  | `createEvent(details)`              | `CreateEventResult`                  | `calendar-server.ts`                |

Key shapes:

- `BriefDetail = { id, brief_date, generated_at, items: BriefItemDetail[] }`
- `BriefItemDetail` includes `item` (source/title/snippet/sender/occurred_at/ends_at), `person` (+`is_vip`), `project`, `reason` (AI "why"), `score`, and **`feedback`** — the *latest* feedback row for that item (`{ type, created_at } | null`).

---

## State Management

**TanStack Query** — anything that reads/writes the DB through IPC:
- `useBrief()` — `['brief','latest']`, calls `brief.getLatest()`, `staleTime: 30s`.
- `useRefreshBrief()` — mutation: `sync.runAll()` → `brief.generate(todayLocal())` → invalidate the brief query.
- `useSubmitFeedback()` — mutation: `feedback.submit(id, type)` with **optimistic update** on the brief cache + rollback on error.

**Zustand** — auth only (`auth-store.ts`): `status`, `provider`, `email`, `error`, `checkStatus/startOAuth/signOut/clearError`.

**Local React state** — transient UI: onboarding form, context-editor form, and the swipe deck's `queue`/`history`/`counts` (deliberately local so TanStack refetches don't re-add swiped cards).

---

## Screens & Components (as-built)

### 1. Auth gate & Welcome page
- `AuthGate` (`auth-gate.tsx`) calls `auth.getStatus()` on mount. Shows:
  - **loading** → centered spinner
  - **connecting** → "Waiting for you to finish signing in…"
  - **disconnected** → `<WelcomePage />`
  - **error** → auth-failed card with retry
  - **connected** → renders children (app)
- `WelcomePage` (`welcome-page.tsx`) — glassmorphic marketing hero ("Your day, distilled."), bento feature grid, provider access via the profile icon; theme toggle; mouse-parallax background.
- `ConnectAccount` (`connect-account.tsx`) — Google (enabled) / Microsoft ("Coming Soon") cards → `auth.startOAuth(provider)`.

### 2. Onboarding wizard
- `OnboardingFlow` (`onboarding-flow.tsx`) — 5 animated steps: display name → roles → projects → VIP people → focus summary → done screen. Data accumulates in local state, persisted once on complete via `onboarding.save()` + `onboarding.setCompleted()`. Skippable per-step ("Continue"/"Skip for now").

### 3. Root layout
- `RootLayout` (`root-layout.tsx`): sticky glass header with the **lexas** brand, **Settings** gear, **theme toggle**. A dismissible "Set up context" banner shows when onboarding produced no context. The main area shows `ContextEditor` when settings is open, otherwise `BriefView`.

### 4. Settings / Context editor
- `ContextEditor` (`context-editor.tsx`) — edit display name, roles (predefined + custom), projects, VIP people, and focus summary; persists via `onboarding.save()`.

### 5. Brief view (home hub) — swipe deck
- `BriefView` (`brief-view.tsx`) — header ("Your Brief" + formatted date) with a **Refresh** button (spinner while pending). Renders `<SwipeDeck key={data.id}>` so the deck resets **only when a new brief is generated**, not on feedback refetches.

**Deck vs Reviewed split:** the deck is fed **only un-reviewed items** (`data.items.filter(item => item.feedback === null)`). Once an item has any feedback it leaves the deck and appears in the **Reviewed** list below — so the deck always shows new mails to triage, never ones already decided. Because feedback is keyed to the mail, **Refresh keeps this split intact**: already-reviewed mails stay in Reviewed (they don't come back into the deck), while skipped + newly-synced mails populate the deck.

**Deck ordering:** the most important mail is on top. `SwipeDeck` builds its queue from `data.items` (rank-ascending from `getLatest`) reversed via `orderedQueue()` (`sort((a, b) => b.rank - a.rank)`), so **rank 1 is the first card** you see and swipe, followed by progressively less important ones.

**Components (`features/brief/components/`):**
- **`swipe-card.tsx`** — front card: `motion` drag on `x` with `dragElastic={0.7}`, tilt via `useTransform(x, [-200,200], [-16,16])`, spring-back under threshold, fly-off beyond 150px/velocity 700. Emerald **Keep** badge (right drag) and slate **Archive** badge (left drag) fade in with drag. `CardBody` renders avatar/initials, sender + email, time pill, category pill (VIP → project → source), feedback chip ("Kept"/"Archived"), subject, snippet, **"Why this matters"** (the `reason` field), and source/rank meta. `BackgroundCard` renders the stack behind it (scaled down, blurred, dimmed).
- **`action-dock.tsx`** — frosted dock: Archive (left), Undo (center), Keep (right).
- **`add-to-calendar-button.tsx`** — Action Engine affordance. Rendered on the front card only when `item.item.source === 'email'` **and** `item.suggested_action` exists (Gemini-detected meeting/task). Opens a confirmation `Dialog` with **editable title + start/end** (local-time `datetime-local`, converted to/from ISO), Cancel/Add. On confirm → `calendar.createEvent` → success disables the button ("Added") + writes the `calendar_actions` row backend-side. `onPointerDown` stops propagation so it never starts a card drag.
- **`reviewed-list.tsx`** — "Reviewed" section rendered below the deck: every item with `item.feedback !== null` (already swiped/decided this brief), sorted by most recent feedback first. Each row shows source, title, time/sender, the current vote chip ("Kept"/"Archived"), and **thumbs to change the vote** (appends a new `feedback` row; latest-wins). Hidden when nothing has been reviewed. Changes go through the same `useSubmitFeedback` optimistic path as swipes.
- **`swipe-deck.tsx`** — owns the local `queue`/`history`/`counts`. Decisions call `onDecision(item, action)` (mapped in `BriefView` to `feedback.submit(..., 'important'|'not_important')`); on failure the card is returned to the queue. Keyboard: `←`/`H` archive, `→`/`L` keep, `⌘Z`/`Ctrl+Z` undo (ignored while an `INPUT`/`TEXTAREA`/`SELECT` is focused, e.g. the calendar modal). Zero state = **"All triaged"** card with kept/archived counts + Reset (rebuilds the queue in importance order).

> **Product decision:** the brief is **triage via swipe deck** (deliberate user choice). Every card gets a keep/archive verdict; keep records `important`, archive records `not_important`. A ranked-highlights list was briefly tried and reverted in favor of this interaction.

**States:**
| Condition                  | UI                                       |
| -------------------------- | ---------------------------------------- |
| initial load               | centered spinner                         |
| load error                 | error card                               |
| no brief at all (`null`)   | **"No brief yet"** + hint to refresh     |
| brief exists, 0 items      | **"You're all caught up"**               |
| brief has items            | swipe deck (important first)             |

---

## User Workflow (current app)

1. **Launch** → `WelcomePage` (marketing). Theme toggle available.
2. **Connect** → Get Started / profile icon → pick **Google** → system browser OAuth (PKCE, local callback server) → app re-focuses and is authenticated.
3. **Onboarding** → 5-step wizard captures name, roles, projects, VIP contacts, focus summary. Skippable; editable later in Settings.
4. **Home** → `BriefView`. If no brief has been generated yet, see "No brief yet".
5. **Refresh** → button runs `sync.runAll()` (Gmail + Calendar + correlation, best-effort) then `brief.generate(today)` then refetches. Partial sync failures surface as `Sync had issues: <specific step message>`.
6. **Triage** → the most important mail is on top. Swipe each card **right/→/L** to keep (records `important`), **left/←/H** to archive (records `not_important`). Undo with `⌘Z` or the dock button. When the queue is empty, see "All triaged" with counts + Reset.
7. **Add to Calendar (action engine)** → on email cards where Gemini detected a meeting/task, tap **"Add to Calendar"**, review/edit title + start/end in the modal (nothing is auto-created), confirm → event is created in Google Calendar and the card's button flips to "Added".
8. **Review votes** → below the deck, the **Reviewed** section lists everything you've already decided. Tap a thumb to flip your vote (records a new append-only row; latest wins).
9. **Adjust context** → Settings gear → ContextEditor → Save; the next generated brief uses it.
10. **Feedback loop** → swipes and reviewed-vote changes write to the append-only `feedback` table; `brief.getLatest()` returns the latest per item so the UI never shows a stale vote.

---

## Frontend Gotchas (read before touching the UI)

- **Feedback is an append-only log keyed to the MAIL (`synced_item_id`).** `feedback.submit` keeps both rows on an up→down flip; only consecutive identical taps are suppressed. Keying to the mail (not the transient `brief_item`) is what makes "already reviewed" **survive Refresh** — regenerating the brief no longer wipes your votes. `brief.getLatest()` returns the *latest* row per item — always render from `item.feedback`, never aggregate raw feedback rows on the client.
- **`todayLocal()` is the LOCAL day; the engine matches a UTC window.** `brief.generate(date, tzOffsetMinutes)` (renderer passes `new Date().getTimezoneOffset()`) and `context-engine.ts`'s `localDayWindowUtc` convert the local calendar day into a `[start, end)` UTC window over `occurred_at`. This fixed a real bug where a mail sent early morning IST (UTC date = previous day) was dropped from today's brief. If items are missing again, check `localDayWindowUtc` and the renderer's offset first.
- **Deck ordering:** `SwipeDeck` shows the most important card on top. It reverses `data.items` (rank-ascending) via `orderedQueue()` in `swipe-deck.tsx` — if the deck ever shows the wrong card first, check that helper and the `queue[queue.length-1]` top-card convention.
- **Deck remount semantics:** `SwipeDeck` is keyed by `data.id`, so the deck resets only on a *new* brief. TanStack refetches (e.g. after feedback) preserve the queue but sync feedback state onto remaining cards via a merge effect.
- **Undo is UI-only** in the deck: it returns the card to the queue but does **not** mutate the feedback log (re-deciding simply appends a new row that latest-wins). This avoids recording a false signal for cards that had none.
- **`suggested_action` is detection, not execution.** It comes from the LLM during `brief.generate` (optional schema field) and is persisted as JSON on `brief_items`. It is only surfaced in the UI when the item is an email; the actual calendar insert is a separate, always-confirmed user action (`calendar.createEvent`). Never auto-create an event.
- **Modal times are local.** `add-to-calendar-button` converts Gemini's ISO `proposed_start/end` to `datetime-local` (user's local zone) for editing and back to ISO on confirm. Like `todayLocal()`, the proposal itself is best-effort on timezone — the confirm step is the safety net.
- **Microsoft provider** is currently disabled in the UI ("Coming Soon"); OAuth config exists for both.
