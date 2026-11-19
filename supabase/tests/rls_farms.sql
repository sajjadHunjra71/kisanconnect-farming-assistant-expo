-- RLS + trigger checks for farms / crops / activities.
-- Run against a local Supabase DB (as postgres):
--   psql "$(supabase status -o env | grep DB_URL | cut -d= -f2- | tr -d '"')" -f supabase/tests/rls_farms.sql
-- Everything happens inside one transaction and is rolled back.
-- A failed check raises an exception (stops the run); a passed check prints a NOTICE.

begin;

-- Two throwaway users (rolled back at the end).
insert into auth.users (id, aud, role, email)
values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'rls-a@example.test'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'rls-b@example.test');

-- ── as user B: one farm + crop ──
set local role authenticated;
set local request.jwt.claims = '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';

insert into public.farms (id, name, area_value, area_unit)
values ('bbbbbbbb-1111-4000-8000-000000000001', 'B farm', 16, 'kanal');
insert into public.crops (id, farm_id, crop_key, sowing_date)
values ('bbbbbbbb-2222-4000-8000-000000000001', 'bbbbbbbb-1111-4000-8000-000000000001', 'wheat', '2026-11-10');

do $$
begin
  if (select area_acres from public.farms where id = 'bbbbbbbb-1111-4000-8000-000000000001') <> 2 then
    raise exception 'FAIL: 16 kanal should be 2 acres';
  end if;
  raise notice 'PASS: area_acres generated (16 kanal = 2 acres)';
end $$;

-- ── as user A ──
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';

insert into public.farms (id, name, area_value, area_unit)
values
  ('aaaaaaaa-1111-4000-8000-000000000001', 'A farm 1', 5, 'acre'),
  ('aaaaaaaa-1111-4000-8000-000000000002', 'A farm 2', 2, 'hectare');
insert into public.crops (id, farm_id, crop_key, sowing_date)
values ('aaaaaaaa-2222-4000-8000-000000000001', 'aaaaaaaa-1111-4000-8000-000000000001', 'cotton', '2026-05-01');
insert into public.activities (id, farm_id, crop_id, type, done_on)
values ('aaaaaaaa-3333-4000-8000-000000000001', 'aaaaaaaa-1111-4000-8000-000000000001',
        'aaaaaaaa-2222-4000-8000-000000000001', 'irrigation', '2026-06-01');

do $$
begin
  if (select user_id from public.farms where id = 'aaaaaaaa-1111-4000-8000-000000000001')
     <> 'aaaaaaaa-0000-4000-8000-000000000001' then
    raise exception 'FAIL: user_id not taken from JWT';
  end if;
  raise notice 'PASS: user_id set from auth.uid()';
end $$;

-- A can't read B's rows.
do $$
begin
  if exists (select 1 from public.farms where user_id = 'bbbbbbbb-0000-4000-8000-000000000002')
     or exists (select 1 from public.crops where id = 'bbbbbbbb-2222-4000-8000-000000000001') then
    raise exception 'FAIL: A can read B''s rows';
  end if;
  raise notice 'PASS: A cannot read B''s rows';
end $$;

-- A can't update B's rows (0 rows touched).
do $$
declare n int;
begin
  update public.farms set name = 'hacked' where id = 'bbbbbbbb-1111-4000-8000-000000000001';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: A updated B''s farm'; end if;
  raise notice 'PASS: A cannot update B''s farm';
end $$;

-- A can't insert a row owned by B (user_id is forced to A, so B sees nothing new).
do $$
begin
  insert into public.farms (id, user_id, name, area_value, area_unit)
  values ('aaaaaaaa-1111-4000-8000-0000000000ff', 'bbbbbbbb-0000-4000-8000-000000000002', 'spoof', 1, 'acre');
  if (select user_id from public.farms where id = 'aaaaaaaa-1111-4000-8000-0000000000ff')
     <> 'aaaaaaaa-0000-4000-8000-000000000001' then
    raise exception 'FAIL: A wrote a row as B';
  end if;
  raise notice 'PASS: A cannot write rows as B';
end $$;

-- A can't insert a crop under B's farm.
do $$
begin
  begin
    insert into public.crops (id, farm_id, crop_key, sowing_date)
    values ('aaaaaaaa-2222-4000-8000-0000000000ff', 'bbbbbbbb-1111-4000-8000-000000000001', 'rice', '2026-07-01');
  exception when foreign_key_violation or insufficient_privilege then
    raise notice 'PASS: A cannot insert a crop under B''s farm';
    return;
  end;
  raise exception 'FAIL: A inserted a crop under B''s farm';
end $$;

-- Activity whose crop belongs to another farm fails.
do $$
begin
  begin
    insert into public.activities (id, farm_id, crop_id, type, done_on)
    values ('aaaaaaaa-3333-4000-8000-0000000000ff', 'aaaaaaaa-1111-4000-8000-000000000002',
            'aaaaaaaa-2222-4000-8000-000000000001', 'spray', '2026-06-02');
  exception when foreign_key_violation then
    raise notice 'PASS: activity with a crop from another farm is rejected';
    return;
  end;
  raise exception 'FAIL: activity accepted a crop from another farm';
end $$;

-- Stale compare-and-set update touches 0 rows; version bumps on each write.
do $$
declare n int; v int;
begin
  update public.farms set name = 'A farm 1b'
    where id = 'aaaaaaaa-1111-4000-8000-000000000001' and version = 1;
  get diagnostics n = row_count;
  select version into v from public.farms where id = 'aaaaaaaa-1111-4000-8000-000000000001';
  if n <> 1 or v <> 2 then raise exception 'FAIL: CAS update with current version (n=%, v=%)', n, v; end if;

  update public.farms set name = 'stale write'
    where id = 'aaaaaaaa-1111-4000-8000-000000000001' and version = 1;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: stale CAS update changed % rows', n; end if;
  raise notice 'PASS: stale CAS update changes 0 rows';
end $$;

-- Client can't overwrite version / created_at.
do $$
declare v int;
begin
  update public.farms set version = 99, created_at = '2000-01-01'
    where id = 'aaaaaaaa-1111-4000-8000-000000000001';
  select version into v from public.farms where id = 'aaaaaaaa-1111-4000-8000-000000000001';
  if v <> 3 or (select created_at from public.farms where id = 'aaaaaaaa-1111-4000-8000-000000000001') < '2020-01-01' then
    raise exception 'FAIL: client controlled version/created_at (v=%)', v;
  end if;
  raise notice 'PASS: server owns version and created_at';
end $$;

-- Soft-deleting a farm soft-deletes its crops and activities; no undelete.
do $$
begin
  update public.farms set deleted_at = now() where id = 'aaaaaaaa-1111-4000-8000-000000000001';
  if (select deleted_at from public.crops where id = 'aaaaaaaa-2222-4000-8000-000000000001') is null
     or (select deleted_at from public.activities where id = 'aaaaaaaa-3333-4000-8000-000000000001') is null then
    raise exception 'FAIL: farm soft delete did not cascade';
  end if;
  raise notice 'PASS: farm soft delete cascades to crops and activities';

  update public.farms set deleted_at = null where id = 'aaaaaaaa-1111-4000-8000-000000000001';
  if (select deleted_at from public.farms where id = 'aaaaaaaa-1111-4000-8000-000000000001') is null then
    raise exception 'FAIL: deleted farm was undeleted';
  end if;
  raise notice 'PASS: deleted row cannot be undeleted';
end $$;

-- A child created under a deleted farm is born deleted.
do $$
begin
  insert into public.crops (id, farm_id, crop_key, sowing_date)
  values ('aaaaaaaa-2222-4000-8000-000000000002', 'aaaaaaaa-1111-4000-8000-000000000001', 'maize', '2026-08-01');
  if (select deleted_at from public.crops where id = 'aaaaaaaa-2222-4000-8000-000000000002') is null then
    raise exception 'FAIL: crop under deleted farm is live';
  end if;
  raise notice 'PASS: crop under a deleted farm inherits deleted_at';
end $$;

-- Clients can't hard delete.
do $$
declare n int;
begin
  begin
    delete from public.farms where id = 'aaaaaaaa-1111-4000-8000-000000000002';
    get diagnostics n = row_count;
  exception when insufficient_privilege then
    raise notice 'PASS: client hard delete refused';
    return;
  end;
  if n <> 0 then raise exception 'FAIL: client hard-deleted a farm'; end if;
  raise notice 'PASS: client hard delete touches 0 rows';
end $$;

-- ── as postgres: a hard farm delete cascades to children ──
reset role;
do $$
begin
  delete from public.farms where id = 'aaaaaaaa-1111-4000-8000-000000000001';
  if exists (select 1 from public.crops where farm_id = 'aaaaaaaa-1111-4000-8000-000000000001')
     or exists (select 1 from public.activities where farm_id = 'aaaaaaaa-1111-4000-8000-000000000001') then
    raise exception 'FAIL: farm delete did not cascade';
  end if;
  raise notice 'PASS: farm delete cascades to crops and activities';
end $$;

rollback;
