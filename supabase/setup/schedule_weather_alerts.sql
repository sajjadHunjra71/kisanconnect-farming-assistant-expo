-- KisanConnect · run ONCE in the Supabase SQL editor, after the migrations and after
-- deploying the weather-alerts function. Replace <PROJECT_REF> below (the part before
-- .supabase.co in your project URL). Nothing secret is written in this file:
-- the cron secret is a random value created inside Supabase Vault.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 1) A random cron secret, stored in Vault (skip if it already exists).
do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'weather_alerts_cron_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'weather_alerts_cron_secret');
  end if;
end $$;

-- 2) Every 3 hours: call weather-alerts with the secret in a header.
--    The function asks the database (check_cron_secret) whether the header matches.
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

-- 3) Daily housekeeping (03:30 UTC): old forecasts (> 2 days), rate-limit rows (> 1 day),
--    checked push tickets and alerts older than 30 days.
select cron.schedule('weather-purge-daily', '30 3 * * *', $$ select public.purge_weather_data(); $$);

-- To stop:   select cron.unschedule('weather-alerts-every-3h'); select cron.unschedule('weather-purge-daily');
-- Run once by hand (for testing), from the SQL editor:
--   select net.http_post(url := 'https://<PROJECT_REF>.supabase.co/functions/v1/weather-alerts',
--     headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',
--       (select decrypted_secret from vault.decrypted_secrets where name = 'weather_alerts_cron_secret')),
--     body := '{}'::jsonb);
