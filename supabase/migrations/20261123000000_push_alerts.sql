-- KisanConnect · Phase 3 · push tokens and sent weather alerts

-- One row per device token. A phone that switches accounts moves its token to the
-- new user (register_push_token), so alerts never go to the previous account.
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
-- Writes only through the functions below.
revoke insert, update, delete on public.push_tokens from anon, authenticated;

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

create or replace function public.unregister_push_token(p_token text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.push_tokens where token = p_token and user_id = auth.uid();
$$;

revoke all on function public.register_push_token(text, text) from public, anon;
revoke all on function public.unregister_push_token(text) from public, anon;
grant execute on function public.register_push_token(text, text) to authenticated;
grant execute on function public.unregister_push_token(text) to authenticated;

-- Alerts already pushed (so the same alert is never sent twice). Written by the
-- weather-alerts Edge Function (service role); users can read their own.
create table if not exists public.alerts_sent (
  user_id uuid not null references auth.users (id) on delete cascade,
  farm_id uuid not null,
  alert_id text not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, farm_id, alert_id)
);

alter table public.alerts_sent enable row level security;
create policy "alerts_sent: read own" on public.alerts_sent for select to authenticated
  using (user_id = (select auth.uid()));
revoke insert, update, delete on public.alerts_sent from anon, authenticated;
