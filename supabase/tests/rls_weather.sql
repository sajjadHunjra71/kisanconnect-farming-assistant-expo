-- RLS + privilege checks for the weather tables (weather cache, rate limits, push tokens,
-- alerts, notification prefs, cron secret). Run as postgres; everything is rolled back.
--   psql "$DB_URL" -f supabase/tests/rls_weather.sql
-- A failed check raises an exception; a passed check prints a NOTICE.

begin;

insert into auth.users (id, aud, role, email)
values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'wx-a@example.test'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'wx-b@example.test');

insert into public.weather_cache (cache_key, cell, provider, schema_version, forecast)
values ('31.5_74.3:open-meteo:v3', '31.5_74.3', 'open-meteo', 3, '{}');

insert into public.alerts (id, user_id, farm_id, kind, severity, title, body, start_date, dedupe_key)
values
  ('aaaaaaaa-9999-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', gen_random_uuid(), 'frost', 'warning', 'Frost A', 'b', current_date, 'frost:a'),
  ('bbbbbbbb-9999-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000002', gen_random_uuid(), 'frost', 'warning', 'Frost B', 'b', current_date, 'frost:b');

-- Make sure there is a cron secret to check against (inside this transaction only).
do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'weather_alerts_cron_secret') then
    perform vault.create_secret('test-secret-only-in-this-txn', 'weather_alerts_cron_secret');
  end if;
end $$;

-- ── as user B: register a token ──
set local role authenticated;
set local request.jwt.claims = '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';
select public.register_push_token('ExponentPushToken[bbb]', 'ios');

-- ── as user A ──
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select public.register_push_token('ExponentPushToken[aaa]', 'android');

do $$
begin
  if exists (select 1 from public.alerts where user_id <> 'aaaaaaaa-0000-4000-8000-000000000001')
     or (select count(*) from public.alerts) <> 1 then
    raise exception 'FAIL: A can read other users'' alerts';
  end if;
  raise notice 'PASS: A reads only own alerts';

  if exists (select 1 from public.push_tokens where token = 'ExponentPushToken[bbb]') then
    raise exception 'FAIL: A can read B''s token';
  end if;
  raise notice 'PASS: A cannot read B''s push token';
end $$;

do $$
begin
  begin
    perform 1 from public.weather_cache;
    raise exception 'FAIL: client can read weather_cache';
  exception when insufficient_privilege then
    raise notice 'PASS: client cannot read weather_cache';
  end;
  begin
    perform 1 from public.rate_limits;
    raise exception 'FAIL: client can read rate_limits';
  exception when insufficient_privilege then
    raise notice 'PASS: client cannot read rate_limits';
  end;
  begin
    perform public.check_cron_secret('x');
    raise exception 'FAIL: client can call check_cron_secret';
  exception when insufficient_privilege then
    raise notice 'PASS: client cannot call check_cron_secret';
  end;
end $$;

do $$
declare n int;
begin
  begin
    update public.alerts set title = 'hacked' where id = 'aaaaaaaa-9999-4000-8000-000000000001';
    raise exception 'FAIL: client changed an alert title';
  exception when insufficient_privilege then
    raise notice 'PASS: client cannot change alert title';
  end;
  begin
    insert into public.alerts (user_id, farm_id, kind, severity, title, body, start_date, dedupe_key)
    values ('aaaaaaaa-0000-4000-8000-000000000001', gen_random_uuid(), 'fog', 'warning', 't', 'b', current_date, 'x');
    raise exception 'FAIL: client inserted an alert';
  exception when insufficient_privilege then
    raise notice 'PASS: client cannot insert alerts';
  end;

  update public.alerts set read_at = now() where id = 'aaaaaaaa-9999-4000-8000-000000000001' and read_at is null;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL: A could not mark own alert read'; end if;
  update public.alerts set read_at = null where id = 'aaaaaaaa-9999-4000-8000-000000000001';
  if (select read_at from public.alerts where id = 'aaaaaaaa-9999-4000-8000-000000000001') is null then
    raise exception 'FAIL: read alert became unread';
  end if;
  raise notice 'PASS: A marks own alert read; it can''t be un-read';

  update public.alerts set read_at = now() where id = 'bbbbbbbb-9999-4000-8000-000000000001';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: A marked B''s alert read'; end if;
  raise notice 'PASS: A cannot touch B''s alert';
end $$;

do $$
declare n int;
begin
  begin
    insert into public.push_tokens (token, user_id, platform)
    values ('ExponentPushToken[direct]', 'aaaaaaaa-0000-4000-8000-000000000001', 'ios');
    raise exception 'FAIL: direct token insert allowed';
  exception when insufficient_privilege then
    raise notice 'PASS: tokens only via register_push_token';
  end;
  delete from public.push_tokens where token = 'ExponentPushToken[bbb]';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: A deleted B''s token'; end if;
  delete from public.push_tokens where token = 'ExponentPushToken[aaa]';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL: A could not delete own token'; end if;
  raise notice 'PASS: A deletes only own token';
end $$;

-- Token moves to the account that registers it last.
select public.register_push_token('ExponentPushToken[bbb]', 'ios');
do $$
begin
  if not exists (select 1 from public.push_tokens where token = 'ExponentPushToken[bbb]') then
    raise exception 'FAIL: token did not move to A';
  end if;
  raise notice 'PASS: token moved to the newly signed-in user';
end $$;

-- Notification prefs: own row, shape checked.
do $$
begin
  update public.profiles set notification_prefs = '{"kinds":{"fog":false},"quiet_hours":{"start":"21:00","end":"07:00"}}'
    where id = 'aaaaaaaa-0000-4000-8000-000000000001';
  begin
    update public.profiles set notification_prefs = '{"kinds":{"fog":"no"},"quiet_hours":{"start":"9pm","end":"07:00"}}'
      where id = 'aaaaaaaa-0000-4000-8000-000000000001';
    raise exception 'FAIL: bad notification_prefs accepted';
  exception when check_violation then
    raise notice 'PASS: notification_prefs shape is checked';
  end;
end $$;

-- ── service role: cron secret check ──
reset role;
set local role service_role;
do $$
declare s text;
begin
  select decrypted_secret into s from vault.decrypted_secrets where name = 'weather_alerts_cron_secret';
  if not public.check_cron_secret(s) or public.check_cron_secret(s || 'x') or public.check_cron_secret(null) then
    raise exception 'FAIL: check_cron_secret';
  end if;
  if not public.bump_rate_limit('aaaaaaaa-0000-4000-8000-000000000001', 'test', 2)
     or not public.bump_rate_limit('aaaaaaaa-0000-4000-8000-000000000001', 'test', 2)
     or public.bump_rate_limit('aaaaaaaa-0000-4000-8000-000000000001', 'test', 2) then
    raise exception 'FAIL: bump_rate_limit';
  end if;
  raise notice 'PASS: cron secret check and rate limit (service role)';
end $$;

rollback;
