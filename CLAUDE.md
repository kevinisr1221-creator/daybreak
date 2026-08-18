# CLAUDE.md — Prayer Buddy

Guidance for AI assistants (Claude Code) working on **Prayer Buddy**, a Christian
prayer companion app. The application code lives in the
`kevinisr1221-creator/prayer-buddie` repository; this document describes that
codebase.

> **Hosting note:** The project was originally built and hosted on Replit
> (`replit.md` is the legacy Replit-era doc). The team has moved off Replit —
> editing now happens through Claude Code, and a new hosting target is TBD. The
> mobile app's default API base URL still points at the old Replit deployment
> (`mobile/src/config/env.ts` → `https://prayer-buddy-1.replit.app`); update this
> when the backend gets a new home.

## What the project is

Two client applications sharing **one backend and one PostgreSQL database**:

1. **Web app** — `client/` (React + Vite SPA) served by `server/` (Express +
   TypeScript). Solo-prayer experience only: no friends, groups, or mailbox in
   the web UI.
2. **Mobile app** — `mobile/` (React Native + Expo SDK 54, TypeScript). The
   flagship client: onboarding, solo & group prayer, plans, buddies/friends,
   prayer groups, mailbox, journal, achievements, premium upgrade.

Static marketing/legal pages live in `web/` (landing, privacy, terms, install
guides, admin page).

## Repository layout

```
server/           Express backend (TypeScript, ESM, run with tsx)
  index.ts        entrypoint (NODE_ENV=development tsx server/index.ts)
  routes.ts       main REST routes (/api/*)
  routes/         feature routes: billing, group-prayer, instrumentals,
                  profile, admin-analytics, admin-plans
  lib/            auth middleware/tokens, admin PIN, premium, push,
                  object storage, socket auth, lobby media state
  storage.ts      data access (incl. streak rules — STREAK_MIN_MINUTES)
  ws.ts           WebSocket server (lobbies, chat, presence)
  scheduler.ts    scheduled jobs (reminders / push)
  email.ts        Gmail OAuth email sending (password reset etc.)
  db.ts, migrate.ts, load-plan-content.ts
shared/           code shared by server + clients
  schema.ts       Drizzle ORM schema + Zod validation (source of truth for DB)
  constants.ts    prayer topics etc. (kept in sync with mobile — see tests)
  streakUtils.ts  streak calculation shared logic
  __tests__/      run via `npm run check`
client/           web SPA (React, Vite, Tailwind, shadcn/ui, Wouter routing,
                  TanStack Query); pages in client/src/pages/
mobile/           Expo app (see "Mobile app" below)
web/              static HTML pages (landing/privacy/terms/admin/install)
docs/             maintained architecture docs — READ THESE FIRST
                  (overview, architecture, data-model, features, user-flows,
                  integrations, premium-billing, mvp-gap, spec/)
migrations/       Drizzle SQL migrations
scripts/, script/ build helpers (build.ts, build-welcome.mjs, export-db.mjs)
plan-content-all.json  prayer-plan day content loaded by the server
design_guidelines.md   the design system (Calm/Headspace-inspired)
replit.md         legacy Replit-era overview (historical, partially outdated)
```

## Commands

Backend / web (repo root):

```bash
npm run dev        # dev server: tsx server/index.ts (serves API + Vite client)
npm run build      # production build (script/build.ts)
npm start          # run production build (dist/index.cjs)
npm run check      # tsc + shared unit tests (topics sync, password reset,
                   # auth token, admin PIN) — run this before pushing
npm run db:push    # drizzle-kit push (schema → database)
npm run web:build  # rebuild static welcome page
```

Mobile (`cd mobile`):

```bash
npm run start      # expo start
npm run android    # expo start --android
npm run ios        # expo start --ios
npm run web        # expo start --web (PWA build; push notifications absent)
```

## Environment variables (server)

`DATABASE_URL`, `PORT`, `NODE_ENV`, `AUTH_SECRET`, `SOCKET_SECRET`,
`ADMIN_EMAILS`, `ADMIN_PIN`, `APP_BASE_URL`,
`GMAIL_OAUTH_CLIENT_ID` / `GMAIL_OAUTH_CLIENT_SECRET` /
`GMAIL_OAUTH_REFRESH_TOKEN` / `GMAIL_SENDER` (email),
`EXPO_ACCESS_TOKEN` (push), `REVENUECAT_SECRET_API_KEY` /
`REVENUECAT_WEBHOOK_AUTH` / `REVENUECAT_ENTITLEMENT_ID` (premium billing).

## Mobile app — the important mental model

### Navigation is hand-rolled (no react-navigation)

`mobile/App.tsx` owns a **manual navigation stack**: `history: FullScreen[]`,
with `navigate()` (push), `goBack()` (pop), and `selectTab()` (reset to a root).
Screens are plain components switched in `renderScreen()`. Parameterised
screens pass state via App-level useState (`activePlanId`, `activeGroupId`,
`activeLobbyId`, `activeCalendarDate`, …), **not** route params. To add a
screen: add its id to the `FullScreen` union, add a `case` in `renderScreen()`,
and wire `onNavigate`/`onBack` callbacks — follow the existing pattern exactly.

### Screens (36) — `mobile/src/screens/`

- **Entry/onboarding:** Login, ForgotPassword, ResetPassword,
  onboarding/{Hello, Profile, Questionnaire}, SetUsername
- **Root tabs** (BottomNav: Home / Plans / Groups / You + center Pray button):
  HomeScreen, PlansScreen, GroupsHubScreen, ProfileScreen
- **Prayer flow:** PrayerSettingsScreen (setup) → PrayerSessionScreen →
  PrayerCompleteScreen; group prayer goes through LobbyScreen (WebRTC + chat)
- **Plans:** PlansListScreen → PlanDetailScreen → PlanDayScreen; UpgradeScreen
  (premium gate)
- **Groups/social:** PrayerGroupsListScreen, CreateGroupScreen,
  GroupDetailScreen, FriendsScreen, MailboxScreen
- **Personal (via You tab):** JournalScreen, PrayerPointsScreen,
  TeachingScreen, AchievementsScreen, EditProfileScreen, ChangePasswordScreen,
  HistoryScreen, CalendarDayScreen
- **Settings:** SettingsScreen → LanguageScreen, RemindersScreen,
  AdminPrayerRequestsScreen (admin-only, PIN-gated)
- **Other:** PrayerRequestScreen; ComponentGallery.tsx is a dev-only gallery,
  not wired into App.tsx.

### Key conventions

- **Theming:** single source of color truth is
  `mobile/src/theme/tokens.ts` (dark "Sanctuary" deep-indigo/gold palette +
  light cream/lavender palette, identical key shape). Screens read colors via
  `useThemeColors()` from `ThemeContext` — never hardcode hex values.
  Spacing/radius/typography scales live in `mobile/src/theme/colors.ts`.
- **Fonts:** Spectral (display/headings) + Inter (UI), loaded by
  `useAppFonts()`; web design guidelines use Inter + Crimson Pro.
- **Contexts:** AuthContext (user/session), ThemeContext, LanguageContext
  (i18n), InstrumentalContext (background audio).
- **State/persistence:** AsyncStorage-backed stores in `mobile/src/store/`
  (preferences, plans progress, planContent, journal, folders). Offline-first:
  sessions queue locally and flush via `flushPendingSessions()`.
- **API access:** `mobile/src/utils/api.ts` (+ `groupApi.ts`, `socket.ts`).
  Base URL comes from `mobile/src/config/env.ts`.
- **Platform splits:** `.web.tsx` variants exist (AdBanner, RTCMedia); push
  notifications are skipped on web (`Platform.OS !== 'web'`).
- **Business rule worth knowing:** a session must last **3+ minutes** to count
  toward the streak and to advance a plan day
  (`PLAN_ADVANCE_MIN_MINUTES` in App.tsx, mirroring `STREAK_MIN_MINUTES` in
  `server/storage.ts`). Keep these in sync.

## Backend conventions

- REST endpoints under `/api`; auth via tokens (`server/lib/authToken.ts`,
  `authMiddleware.ts`); admin surface gated by `ADMIN_EMAILS` + `ADMIN_PIN`.
- DB via **Drizzle ORM**; schema + Zod validators in `shared/schema.ts`.
  Change schema there, then `npm run db:push` (or add a migration).
- Real-time (lobbies/chat/presence) via `server/ws.ts`; WebRTC media state in
  `server/lib/lobbyMediaState.ts`.
- Premium entitlements via RevenueCat webhooks (`server/routes/billing.ts`,
  `server/lib/premium.ts`).
- Push via Expo (`server/lib/push.ts`); device ids are stable per install
  (see `getOrCreateDeviceId` in mobile App.tsx).

## Working style for AI assistants

1. **Read `docs/` before large changes** — `docs/overview.md`,
   `docs/architecture.md`, and `docs/user-flows.md` are current and
   code-grounded; `replit.md` is legacy.
2. **Don't rebuild — extend.** The project's history (see `attached_assets/`
   prompts) is full of "do NOT rebuild the app" instructions. Make targeted
   edits that preserve existing screens and flows.
3. **Match the design system**: Sanctuary palette tokens, Spectral/Inter,
   spacing scale, "sacred simplicity" (one primary action per screen), gentle
   non-competitive encouragement. See `design_guidelines.md`.
4. **Run `npm run check`** (typecheck + shared tests) before committing
   backend/shared changes.
5. **Prayer topics** are duplicated between `shared/constants.ts` and
   `mobile/src/constants/prayerTopics.ts` and guarded by a sync test — update
   both together.
6. The mobile and web clients are **not feature-equivalent** (web is
   solo-only). Confirm which client a change targets before editing.
7. Tone matters: this is a spiritual app. Copy should be calm, warm, and
   respectful — no pressure mechanics, streak-shaming, or competitive framing.
