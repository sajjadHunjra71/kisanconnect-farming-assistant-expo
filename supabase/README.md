# Supabase (backend)

Free tier only. Nothing here contains keys.

## One-time setup
1. Create a project at https://supabase.com (free plan, region closest to Pakistan, e.g. Singapore or Mumbai).
2. **SQL Editor** → run each file in `migrations/` in order (`20261118000000_profiles.sql`, then `20261120000000_protect_profile_role.sql`).
3. **Authentication → Providers**: Email on (with "Confirm email"), Google on (needs the Google Web client ID + secret).
4. **Authentication → URL Configuration → Redirect URLs**: add
   - `kisanconnect://**` (dev and production builds)
   - `exp://**` (Expo Go during development)
5. Deploy the account-deletion function (Supabase CLI): `supabase functions deploy delete-account`.

The service-role key is never put in the app or in `.env`. Edge Functions get it automatically.
