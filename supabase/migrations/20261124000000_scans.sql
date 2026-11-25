-- KisanConnect · leaf scans, AI quota/budget/log, consent, scan photo bucket
--
-- Who writes what on public.scans:
--   phone (authenticated): the row, quality, model_result, model_version, farm/crop links,
--                          photo_path, ask_expert, soft delete.
--   server (service role, ai-diagnose): ai_result, final_status, top_disease_id,
--                          needs_expert_ai, checked_at. A trigger keeps these columns
--                          unchanged for client writes (silently, so a full-row sync
--                          upsert from the phone never fails).
-- Scans use the shared sync triggers (version bump, no undelete) and are pulled by
-- (updated_at, id); a server AI write bumps the version so the phone pulls it.

-- ── scans ──────────────────────────────────────────────────
create table if not exists public.scans (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  farm_id uuid,
  crop_id uuid,
  crop_key text not null check (crop_key in ('wheat', 'rice', 'cotton', 'sugarcane', 'maize')),
  photo_path text,
  quality jsonb,
  model_result jsonb,
  model_version text check (char_length(model_version) <= 60),
  ask_expert boolean not null default false,
  -- server-only
  ai_result jsonb,
  final_status text check (final_status in ('likely', 'possible', 'unclear', 'not_crop', 'failed')),
  top_disease_id text check (char_length(top_disease_id) <= 60),
  needs_expert_ai boolean,
  checked_at timestamptz,
  -- sync
  version int not null default 1,
  last_op_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  -- a crop link needs its farm (composite FKs are skipped when any column is null)
  constraint scans_crop_needs_farm check (crop_id is null or farm_id is not null),
  -- photos live at scan-photos/<user_id>/<scan_id>.jpg, nowhere else
  constraint scans_photo_path check (photo_path is null or photo_path = user_id::text || '/' || id::text || '.jpg'),
  constraint scans_quality_object check (quality is null or jsonb_typeof(quality) = 'object'),
  constraint scans_model_result_object check (model_result is null or jsonb_typeof(model_result) = 'object'),
  constraint scans_farm_fk foreign key (farm_id, user_id) references public.farms (id, user_id) on delete cascade,
  constraint scans_crop_fk foreign key (crop_id, farm_id, user_id) references public.crops (id, farm_id, user_id) on delete cascade
);

create index if not exists scans_user_sync_idx on public.scans (user_id, updated_at, id);
create index if not exists scans_deleted_idx on public.scans (deleted_at) where deleted_at is not null;

create trigger scans_before_insert before insert on public.scans
  for each row execute function public.sync_before_insert();
create trigger scans_before_update before update on public.scans
  for each row execute function public.sync_before_update();

-- Keep the AI columns server-only (runs as the caller, like protect_profile_columns).
create or replace function public.protect_scan_ai_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.ai_result := null;
      new.final_status := null;
      new.top_disease_id := null;
      new.needs_expert_ai := null;
      new.checked_at := null;
    else
      new.ai_result := old.ai_result;
      new.final_status := old.final_status;
      new.top_disease_id := old.top_disease_id;
      new.needs_expert_ai := old.needs_expert_ai;
      new.checked_at := old.checked_at;
    end if;
  end if;
  return new;
end;
$$;

create trigger scans_protect_ai_columns before insert or update on public.scans
  for each row execute function public.protect_scan_ai_columns();

alter table public.scans enable row level security;
create policy "scans: read own" on public.scans for select to authenticated
  using (user_id = (select auth.uid()));
create policy "scans: insert own" on public.scans for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "scans: update own" on public.scans for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.scans from anon;
revoke delete on public.scans from authenticated;

-- ── AI consent on the profile ──────────────────────────────
alter table public.profiles
  add column if not exists ai_consent_at timestamptz,
  add column if not exists ai_consent_version int;
alter table public.profiles drop constraint if exists profiles_ai_consent_pair;
alter table public.profiles add constraint profiles_ai_consent_pair
  check ((ai_consent_at is null) = (ai_consent_version is null));

-- ── quota, budget, events (service role only) ──────────────
-- Days follow America/Los_Angeles because Google's daily free limits reset at Pacific midnight.
create table if not exists public.ai_quota (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  scans_used int not null default 0 check (scans_used >= 0),
  chats_used int not null default 0 check (chats_used >= 0),
  primary key (user_id, day)
);

create table if not exists public.ai_budget (
  day date not null,
  kind text not null,
  used int not null default 0 check (used >= 0),
  "limit" int not null check ("limit" >= 0),
  primary key (day, kind)
);

create table if not exists public.ai_events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete set null,
  kind text not null,              -- 'scan' | 'chat'
  model text,
  model_version text,
  latency_ms int,
  status text not null,            -- 'ok' | 'retry_ok' | 'invalid' | 'rate_limited' | 'error'
  tokens int,
  request_id text,
  created_at timestamptz not null default now()
);
create index if not exists ai_events_created_idx on public.ai_events (created_at);

alter table public.ai_quota enable row level security;
alter table public.ai_budget enable row level security;
alter table public.ai_events enable row level security;
revoke all on public.ai_quota, public.ai_budget, public.ai_events from anon, authenticated;

create or replace function public.ai_day()
returns date
language sql
stable
set search_path = ''
as $$ select (now() at time zone 'America/Los_Angeles')::date $$;

-- One call, one transaction: take a unit from the user's daily cap AND the shared global
-- budget, or neither. Returns 'ok' | 'user_limit' | 'budget'.
create or replace function public.use_ai_quota(p_user uuid, p_kind text, p_user_limit int, p_global_limit int)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  d date := public.ai_day();
begin
  if p_kind not in ('scan', 'chat') then
    raise exception 'unknown kind %', p_kind using errcode = '22023';
  end if;
  insert into public.ai_budget (day, kind, used, "limit") values (d, 'gemini', 0, p_global_limit)
    on conflict (day, kind) do update set "limit" = excluded."limit";
  insert into public.ai_quota (user_id, day) values (p_user, d) on conflict do nothing;

  if p_kind = 'scan' then
    update public.ai_quota set scans_used = scans_used + 1 where user_id = p_user and day = d and scans_used < p_user_limit;
  else
    update public.ai_quota set chats_used = chats_used + 1 where user_id = p_user and day = d and chats_used < p_user_limit;
  end if;
  if not found then
    return 'user_limit';
  end if;

  update public.ai_budget set used = used + 1 where day = d and kind = 'gemini' and used < "limit";
  if not found then
    -- give the user's unit back: nothing is used when the shared budget is gone
    if p_kind = 'scan' then
      update public.ai_quota set scans_used = scans_used - 1 where user_id = p_user and day = d;
    else
      update public.ai_quota set chats_used = chats_used - 1 where user_id = p_user and day = d;
    end if;
    return 'budget';
  end if;
  return 'ok';
end;
$$;

-- A retry costs one more global unit (not another user unit).
create or replace function public.use_ai_budget(p_global_limit int)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  d date := public.ai_day();
begin
  insert into public.ai_budget (day, kind, used, "limit") values (d, 'gemini', 0, p_global_limit)
    on conflict (day, kind) do nothing;
  update public.ai_budget set used = used + 1 where day = d and kind = 'gemini' and used < "limit";
  return found;
end;
$$;

-- Gemini failed before answering: give back the units this request took.
create or replace function public.refund_ai_quota(p_user uuid, p_kind text, p_global_units int, p_user_unit boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  d date := public.ai_day();
begin
  update public.ai_budget set used = greatest(0, used - greatest(0, p_global_units)) where day = d and kind = 'gemini';
  if p_user_unit then
    if p_kind = 'scan' then
      update public.ai_quota set scans_used = greatest(0, scans_used - 1) where user_id = p_user and day = d;
    else
      update public.ai_quota set chats_used = greatest(0, chats_used - 1) where user_id = p_user and day = d;
    end if;
  end if;
end;
$$;

-- Housekeeping, called daily by cron (supabase/setup/schedule_ai_cleanup.sql).
create or replace function public.purge_ai_data()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.ai_events where created_at < now() - interval '90 days';
  delete from public.ai_quota where day < public.ai_day() - 7;
  delete from public.ai_budget where day < public.ai_day() - 7;
$$;

revoke all on function public.ai_day() from public, anon, authenticated;
revoke all on function public.use_ai_quota(uuid, text, int, int) from public, anon, authenticated;
revoke all on function public.use_ai_budget(int) from public, anon, authenticated;
revoke all on function public.refund_ai_quota(uuid, text, int, boolean) from public, anon, authenticated;
revoke all on function public.purge_ai_data() from public, anon, authenticated;
grant execute on function public.ai_day() to service_role;
grant execute on function public.use_ai_quota(uuid, text, int, int) to service_role;
grant execute on function public.use_ai_budget(int) to service_role;
grant execute on function public.refund_ai_quota(uuid, text, int, boolean) to service_role;
grant execute on function public.purge_ai_data() to service_role;

-- ── scan photo bucket ──────────────────────────────────────
-- Private, JPEG only, max 2 MB. Each user can only add, read and delete files in their
-- own folder scan-photos/<user_id>/…  No updates (a photo is never replaced).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('scan-photos', 'scan-photos', false, 2097152, array['image/jpeg'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "scan photos: upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'scan-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "scan photos: read own" on storage.objects for select to authenticated
  using (bucket_id = 'scan-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "scan photos: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'scan-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
