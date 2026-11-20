-- KisanConnect · run ONCE in the Supabase SQL editor after deploying `weather-alerts`.
-- Calls the function every 3 hours with pg_cron + pg_net.
--
-- Before running, replace the two placeholders:
--   <PROJECT_REF>   your project ref (the part before .supabase.co)
--   <CRON_SECRET>   a long random string; set the same value as a function secret:
--                   supabase secrets set CRON_SECRET=<CRON_SECRET>
-- The secret is stored in Supabase Vault, not in this file.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select vault.create_secret('<CRON_SECRET>', 'weather_alerts_cron_secret');

select cron.schedule(
  'weather-alerts-every-3h',
  '0 */3 * * *',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/weather-alerts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'weather_alerts_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);

-- To stop it later:  select cron.unschedule('weather-alerts-every-3h');
