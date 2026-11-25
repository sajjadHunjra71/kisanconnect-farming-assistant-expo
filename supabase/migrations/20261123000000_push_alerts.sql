-- KisanConnect · weather alerts, push tokens, notification preferences

-- ── push tokens ─────────────────────────────────────────────
-- Token is globally unique: a phone that switches accounts moves its token.
create table if not exists public.push_tokens (
  token text primary key check (token ~ '^(Exponent|Expo)PushToken\[.+\]$'),
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists push_tokens_user_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;
create policy "push_tokens: read own" on public.push_tokens for select to authenticated
  using (user_id = (select auth.uid()));
create policy "push_tokens: delete own" on public.push_tokens for delete to authenticated
  using (user_id = (select auth.uid()));
-- Insert/update only through register_push_token.
revoke all on public.push_tokens from anon;
revoke insert, update on public.push_tokens from authenticated;
grant select, delete on public.push_tokens to authenticated;

create or replace function public.register_push_token(p_token text, p_platform text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  insert into public.push_tokens (token, user_id, platform)
  values (p_token, uid, p_platform)
  on conflict (token) do update
    set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
end;
$$;

revoke all on function public.register_push_token(text, text) from public, anon;
grant execute on function public.register_push_token(text, text) to authenticated;

-- ── alerts (inbox + push) ───────────────────────────────────
create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  farm_id uuid not null,
  crop_id uuid,
  kind text not null,
  severity text not null check (severity in ('warning', 'danger')),
  title text not null,
  body text not null,
  start_date date not null,                         -- local (Pakistan) date the event starts
  dedupe_key text not null,                         -- kind:farm_id:crop_id:start_date
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  pushed_at timestamptz,
  push_ticket_id text,
  read_at timestamptz,
  constraint alerts_dedupe_key unique (user_id, dedupe_key)
);
create index if not exists alerts_user_sync_idx on public.alerts (user_id, updated_at, id);
create index if not exists alerts_unpushed_idx on public.alerts (created_at) where pushed_at is null;

alter table public.alerts enable row level security;
create policy "alerts: read own" on public.alerts for select to authenticated
  using (user_id = (select auth.uid()));
create policy "alerts: mark own read" on public.alerts for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.alerts from anon;
revoke insert, update, delete on public.alerts from authenticated;
grant select on public.alerts to authenticated;
grant update (read_at) on public.alerts to authenticated;

-- updated_at moves on every change (the app pulls by (updated_at, id));
-- read_at can be set once, never cleared or moved.
create or replace function public.alerts_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.read_at := coalesce(old.read_at, new.read_at);
  return new;
end;
$$;

create trigger alerts_before_update before update on public.alerts
  for each row execute function public.alerts_before_update();

-- Expo push tickets waiting for a receipt check (service role only).
create table if not exists public.push_tickets (
  ticket_id text primary key,
  token text not null,
  created_at timestamptz not null default now(),
  checked_at timestamptz
);
alter table public.push_tickets enable row level security;
revoke all on public.push_tickets from anon, authenticated;

-- Small key/value state for scheduled jobs (e.g. the weather-alerts farm cursor).
create table if not exists public.job_state (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.job_state enable row level security;
revoke all on public.job_state from anon, authenticated;

-- ── notification preferences ────────────────────────────────
alter table public.profiles
  add column if not exists notification_prefs jsonb not null default
    '{"kinds":{"heatwave":true,"heat-stress":true,"frost":true,"heavy-rain":true,"strong-wind":true,"fog":true,"disease":true},"quiet_hours":{"start":"22:00","end":"06:00"}}'::jsonb;

create or replace function public.valid_notification_prefs(p jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v jsonb;
begin
  if jsonb_typeof(p) <> 'object' or jsonb_typeof(p -> 'kinds') <> 'object' then
    return false;
  end if;
  for v in select value from jsonb_each(p -> 'kinds') loop
    if jsonb_typeof(v) <> 'boolean' then
      return false;
    end if;
  end loop;
  return coalesce(p #>> '{quiet_hours,start}', '') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
     and coalesce(p #>> '{quiet_hours,end}', '') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$';
end;
$$;

alter table public.profiles drop constraint if exists profiles_notification_prefs_shape;
alter table public.profiles add constraint profiles_notification_prefs_shape check (public.valid_notification_prefs(notification_prefs));

-- ── housekeeping (called daily by cron) ─────────────────────
create or replace function public.purge_weather_data()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.weather_cache where fetched_at < now() - interval '2 days';
  delete from public.rate_limits where window_start < now() - interval '1 day';
  delete from public.push_tickets where created_at < now() - interval '2 days';
  delete from public.alerts where start_date < (now() at time zone 'Asia/Karachi')::date - 30;
$$;
revoke all on function public.purge_weather_data() from public, anon, authenticated;
grant execute on function public.purge_weather_data() to service_role;
