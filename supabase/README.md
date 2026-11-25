# Supabase (backend)

Free tier only. Nothing here contains keys.

## One-time setup
1. Create a project at https://supabase.com (free plan, region closest to Pakistan, e.g. Singapore or Mumbai).
2. **SQL Editor** → run each file in `migrations/` in name order:
   - `20261118000000_profiles.sql`
   - `20261120000000_protect_profile_role.sql`
   - `20261121000000_farms_crops_activities.sql` (Phase 2)
   - `20261122000000_weather_cache.sql` (Phase 3)
   - `20261123000000_push_alerts.sql` (Phase 3)
   - `20261124000000_scans.sql` (Phase 4: scans, AI quota/budget/log, consent, `scan-photos` bucket)
3. **Authentication → Providers**: Email on (with "Confirm email"), Google on (needs the Google Web client ID + secret).
4. **Authentication → URL Configuration → Redirect URLs**: add
   - `kisanconnect://**` (dev and production builds)
   - `exp://**` (Expo Go during development)
5. Deploy the Edge Functions with the Supabase CLI (no global install and no Docker needed):
   ```
   npx supabase login
   npx supabase link --project-ref <PROJECT_REF>
   npx supabase functions deploy delete-account --use-api
   npx supabase functions deploy weather-proxy --use-api
   npx supabase functions deploy weather-alerts --use-api
   npx supabase functions deploy ai-diagnose --use-api
   npx supabase functions deploy scan-cleanup --use-api
   npx supabase secrets set GROQ_API_KEY=<key from console.groq.com/keys>
   ```
   Leaf checks use Groq (Gemini was used until 2026-11-25). Optional: `GROQ_MODEL` (default `qwen/qwen3.8-27b`, must be a Groq vision model), `AI_DAILY_BUDGET` (shared cloud calls per Pacific day, default 200; keep it below Groq's free requests-per-day; the `ai_budget` rows still carry the old kind name `gemini`) and `AI_SCANS_PER_USER` (default 10).
   `config.toml` turns off the gateway JWT check for all three; each function checks the caller itself
   (`delete-account` and `weather-proxy` with `auth.getUser()`, `weather-alerts` with the cron secret).
6. Weather alerts schedule: open `setup/schedule_weather_alerts.sql`, replace `<PROJECT_REF>`, and run it once in the SQL Editor.
   It creates a random cron secret inside Supabase Vault (`gen_random_bytes`), schedules `weather-alerts` every 3 hours
   (the secret goes in the `x-cron-secret` header and is checked by the `check_cron_secret` database function),
   and a daily clean-up of old forecasts, rate-limit rows, push tickets and alerts.
7. Phase 4: run `setup/schedule_ai_cleanup.sql` once (replace `<PROJECT_REF>`): daily photo backstop + AI log clean-up.
8. Optional checks: run `tests/rls_farms.sql`, `tests/rls_weather.sql` and `tests/rls_scans.sql` in the SQL Editor. Each ends in `rollback`, so nothing is kept.

`functions/_shared/engine/` is a generated copy of the app's `src/engine` (`npm run sync-engine`; a unit test fails if it's stale).

The service-role key is never put in the app or in `.env`. Edge Functions get it automatically.
