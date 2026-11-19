# Progress

## Phase 0: Foundation + UI (done, 18 Nov 2026)
- Expo SDK 58, TypeScript strict, Expo Router, typed routes.
- Design system: `src/theme` (palette, tokens, typography), light + dark + auto.
- i18n: English + Urdu with instant switching in Settings (no reload). RTL handled per component via `useDirection`.
- 22 reusable UI components in `src/components/ui`, custom floating tab bar.
- Screens: welcome, language, sign-up, sign-in, forgot password, farm setup, Home, Weather, Scan, Scan result, Ask (assistant), Farm, Mandi, Expert, Ask expert, Settings.
- All data is **sample data** from `src/mocks` and every screen shows a "Sample data" badge.
- No backend, auth or AI wired yet (waiting for Supabase project, Google OAuth IDs, Gemini key).

## Phase 1: Login (code done, 18 Nov 2026; waiting for Supabase keys)
- Supabase client (`src/lib/supabase.ts`) with PKCE, session in AsyncStorage, auto refresh only in foreground.
- Google sign-in through the browser (Supabase OAuth + `expo-web-browser`), so it runs in Expo Go.
- Email sign up (with confirmation email), sign in, forgot password, set new password from the email link.
- Deep links: `kisanconnect://auth/callback` and `kisanconnect://auth/reset` (Expo Go uses `exp://…/--/auth/...`).
- `profiles` table with Row Level Security, auto-created on sign up (`supabase/migrations`). Users can't change their own `role`.
- `delete-account` Edge Function (service-role key stays on the server).
- Login guard: signed-out users go to welcome / sign-in. Settings shows the signed-in email, sign out and delete account.
- Without keys in `.env` the app runs in **demo mode** exactly like Phase 0.

## Motion pass (19 Nov 2026)
Inspired by references on 60fps.design, rebuilt in Reanimated (UI thread, respects Reduce Motion):
- Weather: day slider. Scrub the hour ruler and the sky cross-fades dawn → day → dusk → night, sun/moon moves on an arc, rain appears for rainy hours, temperature rolls to the new value, haptic tick per hour.
- Scan result: scan line sweeps the photo, then the result card pops in with a glare and the content arrives in a stagger.
- Tasks: ticking a task pops the box, draws the tick, fires a small confetti burst and floats "+1".

## Phase 2A: Farm data, local storage, crop engine (code done, 20 Nov 2026)
- Supabase migration `supabase/migrations/20261121000000_farms_crops_activities.sql`: `farms`, `crops`, `activities` with client-made uuids, `version` + `last_op_id` for compare-and-set sync, soft delete (`deleted_at`, no undelete, parent → children cascade), generated `area_acres`, composite FKs so a crop/activity can only point at the same user's farm (and an activity's crop must be on the same farm). RLS: own rows only, no delete policy.
- `supabase/tests/rls_farms.sql`: 14 checks in one rolled-back transaction (cross-user read/write, crop under someone else's farm, crop on another farm, stale CAS = 0 rows, no undelete, soft and hard delete cascades). Ran green against a local Postgres with a stubbed `auth` schema; run it again on the real Supabase DB once linked.
- `src/engine/` (pure TS, no React Native): crop calendars + common Punjab varieties (marked indicative), stage from sowing date in LOCAL calendar days (planned / growing / completed), area units → acres, date helpers. `src/mocks/crops.ts` re-exports it so screens are unchanged.
- `src/db/`: per-user SQLite file `kisan-<userId>.db` (demo mode / web → in-memory sample data). Tables: farms, crops, activities, `outbox`, `sync_state`. `farmsRepo` / `cropsRepo` / `activitiesRepo` write the row and its outbox entry in one exclusive transaction; entries are coalesced (pure `coalesceOutbox`) so a row has at most one unsent op. Input validation mirrors the server checks.
- New deps: expo-sqlite, netinfo, datetimepicker, expo-location (when-in-use message in app.json), expo-sharing; jest + jest-expo (`npm test`, 22 tests).
- Not yet: push/pull sync (2B), farm/crop/activity screens wired to the repos.

## Next
- Phase 2B: outbox push + cursor pull sync with Supabase, then wire farm screens to the repos.
