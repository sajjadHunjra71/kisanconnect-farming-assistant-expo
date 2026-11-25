# Supabase backend

Postgres with Row Level Security, Storage, Edge Functions (Deno) and pg_cron. No keys are stored in this folder.

## Setup

1. Create a Supabase project.
2. **SQL Editor**: run each file in `migrations/` in name order:
   - `20261118000000_profiles.sql`: profiles and protected columns
   - `20261120000000_protect_profile_role.sql`
   - `20261121000000_farms_crops_activities.sql`: farms, crops, activities and the sync triggers
   - `20261122000000_weather_cache.sql`: shared forecast cache, rate limits, cron-secret check
   - `20261123000000_push_alerts.sql`: weather alerts, push tokens, notification preferences
   - `20261124000000_scans.sql`: leaf scans, AI quota/budget/log, consent, private `scan-photos` bucket
3. **Authentication → Providers**: Email (with "Confirm email") and Google (Web client ID + secret).
4. **Authentication → URL Configuration → Redirect URLs**: `kisanconnect://**` and, for Expo Go, `exp://**`.
5. Deploy the Edge Functions with the Supabase CLI (no Docker needed):
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
   Optional secrets: `GROQ_MODEL` (default `qwen/qwen3.8-27b`, must be a Groq vision model), `AI_DAILY_BUDGET`
   (shared cloud calls per Pacific day, default 200) and `AI_SCANS_PER_USER` (default 10).
   `config.toml` turns off the gateway JWT check; every function checks the caller itself
   (`auth.getUser()` on the caller's token, or the cron secret for scheduled functions).
6. Schedules: in `setup/`, replace `<PROJECT_REF>` and run once in the SQL Editor:
   - `schedule_weather_alerts.sql`: creates a random cron secret in Supabase Vault, runs `weather-alerts` every 3 hours
     (secret sent in `x-cron-secret`, checked by `check_cron_secret()`), plus daily clean-up of old cache and alert rows.
   - `schedule_ai_cleanup.sql`: daily photo clean-up and AI log retention.
7. Checks: `tests/rls_farms.sql`, `tests/rls_weather.sql` and `tests/rls_scans.sql` run in the SQL Editor and end in `rollback`.

`functions/_shared/engine/` is a generated copy of the app's `src/engine` (`npm run sync-engine`; a unit test fails if it is stale).

The service-role key never goes into the app or `.env`; Edge Functions receive it from the platform.
