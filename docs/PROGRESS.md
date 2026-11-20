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

## Phase 2B: Offline sync engine (code done, 20 Nov 2026; needs a real Supabase run)
- `src/sync/engine.ts` (pure TS, Supabase behind a `SyncTransport` interface):
  - Push in outbox order after refreshing the session. Create = insert-or-ignore with `last_op_id`; update/delete = compare-and-set on `version`. On "0 rows" the row is fetched: my `last_op_id` → done (lost response); deleted on server → keep server copy; else conflict → server copy wins and an "Updated from another device" note is stored.
  - Errors: network / 5xx / 503 paused / 429 → retry with exponential backoff (2 s → 5 min), attempts not counted; 401 → stop until signed in; 4xx / 23514 / 42501 / 23503 → attempts++, failed after 5. A failed farm or crop blocks its children's ops (skipped, not failed).
  - Edits made while an op is in flight get a new outbox entry, rebased onto the server's new version when the op lands.
  - Pull farms → crops → activities by keyset (updated_at, id), 500 per page, starting 2 min before the cursor. Rows with a local outbox entry are left for the push; others apply when server.version ≥ local. Cursor older than 90 days → full re-download and prune rows the server no longer has.
- `src/sync/sync-manager.ts`: single-flight runs. Triggers: sign-in/app start, app foreground, network back, pull-to-refresh / Sync now (push + pull), 1.5 s after a local write (push only).
- `useSyncStore`: status (saved on phone / syncing / synced / offline / error), pending count, failed ops, conflict notes. `SyncStatus` on the Farm header; Settings → Sync with "Sync now" and "Discard failed"; pull-to-refresh on Farm.
- Sign-out: user sign-out warns "X changes not uploaded yet" (Sync now / Sign out anyway / Cancel), then closes and deletes `kisan-<userId>.db`. Delete account deletes it too. If the session ends by itself the file is kept and sign-in shows "Sign in again to upload X changes".
- Tests: 45 (23 new for sync: coalesced create, CAS conflict, lost responses, error classes, parent blocking, in-flight rebase, pull keyset/overlap/version rule/protection, 90-day re-download). iOS bundle exports cleanly.
- Not yet: run against a real Supabase project; farm/crop/activity screens still read sample data (2C).

## Phase 2C: Farms (code done, 20 Nov 2026)
- Farm tab reads real farms (`useRepoQuery` re-queries after local writes and every sync run). Several farms → chip switcher; the chosen farm is remembered. No farms → "Add your first farm". Demo mode still shows the sample farm.
- Add / edit farm (`/farm/edit?id=`): name, area + acre/kanal/hectare (default from the profile's `units`), location by GPS (permission → balanced fix → reverse geocode → matched to one of 41 Punjab districts by name/alias, else nearest centre within 60 km; lat/lng rounded to 2 dp) or a searchable district list (district centre). Permission denied / no fix / outside Punjab → the list opens with a short message. Soil chips, notes, inline errors. Delete asks first and removes crops and activity log too.
- Onboarding farm setup now asks farm name + area and saves a real farm (and crop, from "sown about…") for signed-in users; demo mode skips saving.
- Session-loss banner also on Welcome. "Updated from another device" tag on the farm card.

## Phase 2D: Crops (code done, 20 Nov 2026)
- Farm tab: active crops as progress cards from the crop engine (future sowing → "Planned, sowing in N days"; past the season → "ready to harvest"); harvested / failed crops in a collapsed "Past crops" section.
- Add / edit crop (`/crop/edit?farmId=&id=`): crop tiles, variety chips from the engine list + "Other" free text, sowing date picker (today − (season + 180 days) … today + 30), optional area + unit with a warning (not a block) when active crops add up to more than the farm.
- Crop detail (`/crop/[id]`): stage timeline with the current stage highlighted and "next stage in N days", this crop's activity list, Mark harvested (status + today's date), Delete (asks first), edit. "Updated from another device" tag.
- Home shows the selected farm's active crops (up to 3) instead of the sample crop; empty state links to the Farm tab.

## Phase 2E: Activity log (code done, 20 Nov 2026)
- Log / edit activity (`/activity/edit`): type chips with icons, date (today by default, never in the future), quantity + unit, product, cost in PKR, notes, optional crop (or whole farm). Opens from crop detail, the Farm tab and a new "Log" quick action on Home (uses the selected farm).
- Logging a harvest for an active crop asks "Mark crop as harvested?"; yes writes the activity and the crop status in one transaction (`repos.logActivity`; both or neither).
- Activity timeline per farm (`/activity?farmId=`, from Farm → Activity log): filter by crop / whole farm and by type, tap to edit or delete.
- Farm summary card: last irrigation and sprays this season per active crop, total cost since the earliest active sowing date. Whole-farm activities count for every active crop (`summarizeFarm`, unit-tested).

## Phase 2F: Data export, docs and test handover (code done, 20 Nov 2026)
- Settings → **Export my data**: JSON `{ exportedAt, profile, farms, crops, activities }` with live rows only (no soft-deleted rows, no sync fields), saved to the cache folder and shared with expo-sharing (web: file download). Demo mode exports the sample data. Builder is unit-tested.
- Delete account always wipes the user's local database file, even if the local sign-out step fails (unit-tested with mocks).
- District list updated to all 41 current Punjab districts (Murree, Talagang, Kot Addu, Wazirabad, Taunsa added).
- Tests check that en.json and ur.json have the same keys, no empty strings, and that every literal `t('…')` key used in `src/` exists.
- README: "Offline sync" section. Hand-over test script: `docs/TESTING-PHASE2.md`.
- New dependency: expo-file-system (for writing the export file).

## Next
- Run docs/TESTING-PHASE2.md against the real Supabase project, then Phase 3.
