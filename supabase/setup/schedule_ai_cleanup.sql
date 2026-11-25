-- KisanConnect · run ONCE in the SQL editor after deploying scan-cleanup.
-- Needs the Vault secret created by schedule_weather_alerts.sql (same cron secret).
-- Replace <PROJECT_REF>.
--
-- Daily at 04:00 UTC, scan-cleanup:
--   * removes photos of scans deleted more than a day ago (storage files can't be
--     deleted from SQL, so the function does it through the Storage API)
--   * calls purge_ai_data(): ai_events older than 90 days, ai_quota / ai_budget older than 7 days

select cron.schedule(
  'scan-cleanup-daily',
  '0 4 * * *',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/scan-cleanup',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'weather_alerts_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);

-- To stop: select cron.unschedule('scan-cleanup-daily');
