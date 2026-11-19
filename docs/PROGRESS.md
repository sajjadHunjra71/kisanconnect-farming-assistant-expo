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

## Next
- Phase 2: Farm + crop data in SQLite + Supabase sync.
