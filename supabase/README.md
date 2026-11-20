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
3. **Authentication → Providers**: Email on (with "Confirm email"), Google on (needs the Google Web client ID + secret).
4. **Authentication → URL Configuration → Redirect URLs**: add
   - `kisanconnect://**` (dev and production builds)
   - `exp://**` (Expo Go during development)
5. Deploy the Edge Functions with the Supabase CLI (no global install needed: `npx supabase …`):
   ```
   npx supabase login
   npx supabase link --project-ref <PROJECT_REF>
   npx supabase functions deploy delete-account
   npx supabase functions deploy weather-proxy
   npx supabase functions deploy weather-alerts --no-verify-jwt
   npx supabase secrets set CRON_SECRET=<a long random string>
   ```
6. Weather alerts every 3 hours: open `setup/schedule_weather_alerts.sql`, put in your project ref and the same CRON_SECRET, and run it once in the SQL Editor.

`functions/_shared/` holds copies of the app's pure engine files (`npm run sync-shared` regenerates them; a test fails if they're stale).

The service-role key is never put in the app or in `.env`. Edge Functions get it automatically.
