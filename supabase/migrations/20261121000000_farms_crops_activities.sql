-- KisanConnect · farms, crops, activities
--
-- Sync model (offline-first):
--   * ids are uuids made on the device, so rows can be created offline.
--   * every write bumps `version`; clients update with `where version = <base>`
--     (compare-and-set). The server never raises on a mismatch: the update just
--     touches 0 rows and the client pulls the newer row.
--   * rows are soft-deleted (`deleted_at`); a deleted row can't be undeleted and
--     deleting a parent soft-deletes its children.
--   * clients pull changes ordered by (updated_at, id); see the per-user index.
-- Hard deletes only happen through `on delete cascade` from auth.users
-- (delete-account) or from a parent row; there is no delete policy.

-- ───────────────────────── farms ─────────────────────────
create table if not exists public.farms (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  area_value numeric(10, 3) not null check (area_value > 0),
  area_unit text not null check (area_unit in ('acre', 'kanal', 'hectare')),
  area_acres numeric generated always as (
    case area_unit
      when 'acre' then area_value
      when 'kanal' then area_value / 8
      when 'hectare' then area_value * 2.4710538
    end
  ) stored,
  district text check (char_length(district) <= 60),
  lat numeric(5, 2) check (lat between -90 and 90),
  lng numeric(5, 2) check (lng between -180 and 180),
  location_source text check (location_source in ('gps', 'district')),
  soil_type text check (soil_type in ('loam', 'clay', 'sandy', 'silt', 'unknown')),
  notes text check (char_length(notes) <= 500),
  version int not null default 1,
  last_op_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint farms_id_user_key unique (id, user_id),
  constraint farms_latlng_pair check ((lat is null) = (lng is null))
);

create index if not exists farms_user_sync_idx on public.farms (user_id, updated_at, id);

-- ───────────────────────── crops ─────────────────────────
create table if not exists public.crops (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  farm_id uuid not null,
  crop_key text not null check (crop_key in ('wheat', 'rice', 'cotton', 'sugarcane', 'maize')),
  variety text check (char_length(variety) <= 60),
  sowing_date date not null,
  area_value numeric(10, 3) check (area_value > 0),
  area_unit text check (area_unit in ('acre', 'kanal', 'hectare')),
  area_acres numeric generated always as (
    case area_unit
      when 'acre' then area_value
      when 'kanal' then area_value / 8
      when 'hectare' then area_value * 2.4710538
    end
  ) stored,
  status text not null default 'active' check (status in ('active', 'harvested', 'failed')),
  harvested_on date check (harvested_on is null or harvested_on >= sowing_date),
  version int not null default 1,
  last_op_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint crops_area_pair check ((area_value is null) = (area_unit is null)),
  constraint crops_id_farm_user_key unique (id, farm_id, user_id),
  constraint crops_farm_fk foreign key (farm_id, user_id)
    references public.farms (id, user_id) on delete cascade
);

create index if not exists crops_user_sync_idx on public.crops (user_id, updated_at, id);
create index if not exists crops_farm_idx on public.crops (farm_id, user_id);

-- ─────────────────────── activities ───────────────────────
create table if not exists public.activities (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  farm_id uuid not null,
  crop_id uuid,
  type text not null check (type in ('irrigation', 'fertilizer', 'spray', 'harvest', 'sowing', 'other')),
  done_on date not null,
  quantity numeric(12, 3) check (quantity > 0),
  quantity_unit text check (quantity_unit in ('bag', 'kg', 'litre', 'acre-inch', 'maund', 'hour')),
  product text check (char_length(product) <= 80),
  cost_pkr numeric(12, 2) check (cost_pkr >= 0),
  notes text check (char_length(notes) <= 500),
  source text not null default 'manual' check (source in ('manual', 'reminder')),
  version int not null default 1,
  last_op_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint activities_quantity_pair check ((quantity is null) = (quantity_unit is null)),
  constraint activities_farm_fk foreign key (farm_id, user_id)
    references public.farms (id, user_id) on delete cascade,
  -- MATCH SIMPLE: skipped when crop_id is null; otherwise the crop must be on the same farm and user.
  constraint activities_crop_fk foreign key (crop_id, farm_id, user_id)
    references public.crops (id, farm_id, user_id) on delete cascade
);

create index if not exists activities_user_sync_idx on public.activities (user_id, updated_at, id);
create index if not exists activities_farm_idx on public.activities (farm_id, user_id);
create index if not exists activities_crop_idx on public.activities (crop_id, farm_id, user_id);

-- ─────────────────────── triggers ───────────────────────

-- BEFORE INSERT (all three): owner comes from the JWT, version starts at 1.
create or replace function public.sync_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  parent_deleted timestamptz;
begin
  if auth.uid() is not null then
    new.user_id := auth.uid();
  end if;
  new.version := 1;
  new.created_at := coalesce(new.created_at, now());
  new.updated_at := now();

  -- A child created under a deleted parent is born deleted.
  if tg_table_name = 'crops' then
    select f.deleted_at into parent_deleted
      from public.farms f where f.id = new.farm_id and f.user_id = new.user_id;
  elsif tg_table_name = 'activities' then
    select coalesce(
      (select f.deleted_at from public.farms f where f.id = new.farm_id and f.user_id = new.user_id),
      (select c.deleted_at from public.crops c where c.id = new.crop_id and c.user_id = new.user_id)
    ) into parent_deleted;
  end if;
  if parent_deleted is not null then
    new.deleted_at := coalesce(new.deleted_at, parent_deleted);
  end if;

  return new;
end;
$$;

-- BEFORE UPDATE (all three): bump version, protect owner/created_at, no undelete.
-- Never raises on version mismatch: clients use `where version = <base>`.
create or replace function public.sync_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.id := old.id;
  new.user_id := old.user_id;
  new.created_at := old.created_at;
  new.version := old.version + 1;
  new.updated_at := now();
  new.deleted_at := coalesce(old.deleted_at, new.deleted_at);
  return new;
end;
$$;

-- AFTER UPDATE OF deleted_at: soft-delete children when a parent goes null → deleted.
create or replace function public.sync_cascade_soft_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_table_name = 'farms' then
    update public.crops set deleted_at = new.deleted_at
      where farm_id = new.id and user_id = new.user_id and deleted_at is null;
    update public.activities set deleted_at = new.deleted_at
      where farm_id = new.id and user_id = new.user_id and deleted_at is null;
  elsif tg_table_name = 'crops' then
    update public.activities set deleted_at = new.deleted_at
      where crop_id = new.id and user_id = new.user_id and deleted_at is null;
  end if;
  return null;
end;
$$;

create trigger farms_before_insert before insert on public.farms
  for each row execute function public.sync_before_insert();
create trigger crops_before_insert before insert on public.crops
  for each row execute function public.sync_before_insert();
create trigger activities_before_insert before insert on public.activities
  for each row execute function public.sync_before_insert();

create trigger farms_before_update before update on public.farms
  for each row execute function public.sync_before_update();
create trigger crops_before_update before update on public.crops
  for each row execute function public.sync_before_update();
create trigger activities_before_update before update on public.activities
  for each row execute function public.sync_before_update();

create trigger farms_cascade_soft_delete after update of deleted_at on public.farms
  for each row when (old.deleted_at is null and new.deleted_at is not null)
  execute function public.sync_cascade_soft_delete();
create trigger crops_cascade_soft_delete after update of deleted_at on public.crops
  for each row when (old.deleted_at is null and new.deleted_at is not null)
  execute function public.sync_cascade_soft_delete();

-- ─────────────────── row level security ───────────────────
alter table public.farms enable row level security;
alter table public.crops enable row level security;
alter table public.activities enable row level security;

create policy "farms: read own" on public.farms for select to authenticated
  using (user_id = (select auth.uid()));
create policy "farms: insert own" on public.farms for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "farms: update own" on public.farms for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "crops: read own" on public.crops for select to authenticated
  using (user_id = (select auth.uid()));
create policy "crops: insert own" on public.crops for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "crops: update own" on public.crops for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "activities: read own" on public.activities for select to authenticated
  using (user_id = (select auth.uid()));
create policy "activities: insert own" on public.activities for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "activities: update own" on public.activities for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- No delete policy: clients soft-delete. Anonymous users get nothing.
revoke all on public.farms, public.crops, public.activities from anon;
revoke delete on public.farms, public.crops, public.activities from authenticated;
