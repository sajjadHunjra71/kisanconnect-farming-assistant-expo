# Progress

## Phase 0: Foundation + UI (done, 18 Nov 2026)
- Expo SDK 58, TypeScript strict, Expo Router, typed routes.
- Design system: `src/theme` (palette, tokens, typography), light + dark + auto.
- i18n: English + Urdu with instant switching in Settings (no reload). RTL handled per component via `useDirection`.
- 22 reusable UI components in `src/components/ui`, custom floating tab bar.
- Screens: welcome, language, sign-up, sign-in, forgot password, farm setup, Home, Weather, Scan, Scan result, Ask (assistant), Farm, Mandi, Expert, Ask expert, Settings.
- All data is **sample data** from `src/mocks` and every screen shows a "Sample data" badge.
- No backend, auth or AI wired yet (waiting for Supabase project, Google OAuth IDs, Gemini key).

## Next
- Phase 1: Supabase Auth (Google + email), profile, secure session.
- Phase 2: Farm + crop data in SQLite + Supabase sync.
