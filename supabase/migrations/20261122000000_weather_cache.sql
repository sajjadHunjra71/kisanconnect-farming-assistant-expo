-- KisanConnect · weather cache, rate limits, cron secret check
-- Everything here is for Edge Functions (service role) only: RLS on, no policies,
-- and nothing granted to anon / authenticated.

-- One forecast per ~11 km grid cell, per provider and forecast schema version.
create table if not exists public.weather_cache (
  cache_key text primary key,                      -- '<cell>:<provider>:v<schema>'
  cell text not null check (cell ~ '^-?[0-9]+\.[0-9]_-?[0-9]+\.[0-9]$'),
  provider text not null check (provider in ('open-meteo', 'met-norway')),
  schema_version int not null,
  forecast jsonb not null,
  fetched_at timestamptz not null default now(),
  check (cache_key = cell || ':' || provider || ':v' || schema_version)
);
create index if not exists weather_cache_fetched_idx on public.weather_cache (fetched_at);

alter table public.weather_cache enable row level security;
revoke all on public.weather_cache from anon, authenticated;

-- Per-user counters (e.g. new forecast fetches per hour).
create table if not exists public.rate_limits (
  user_id uuid not null references auth.users (id) on delete cascade,
  bucket text not null,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (user_id, bucket, window_start)
);

alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;

-- +1 for this user/bucket in the current hour; true while still within p_limit.
create or replace function public.bump_rate_limit(p_user uuid, p_bucket text, p_limit int)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  n int;
begin
  insert into public.rate_limits (user_id, bucket, window_start, count)
  values (p_user, p_bucket, date_trunc('hour', now()), 1)
  on conflict (user_id, bucket, window_start) do update set count = public.rate_limits.count + 1
  returning count into n;
  return n <= p_limit;
end;
$$;

-- The cron job sends the Vault secret in a header; the function asks the database
-- whether it matches. Compared as SHA-256 digests byte by byte (constant time).
create or replace function public.check_cron_secret(p_secret text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  expected text;
  a bytea;
  b bytea;
  diff int := 0;
begin
  select decrypted_secret into expected from vault.decrypted_secrets where name = 'weather_alerts_cron_secret' limit 1;
  if expected is null or p_secret is null then
    return false;
  end if;
  a := extensions.digest(p_secret, 'sha256');
  b := extensions.digest(expected, 'sha256');
  for i in 0..31 loop
    diff := diff | (get_byte(a, i) # get_byte(b, i));
  end loop;
  return diff = 0;
end;
$$;

revoke all on function public.bump_rate_limit(uuid, text, int) from public, anon, authenticated;
revoke all on function public.check_cron_secret(text) from public, anon, authenticated;
grant execute on function public.bump_rate_limit(uuid, text, int) to service_role;
grant execute on function public.check_cron_secret(text) to service_role;
