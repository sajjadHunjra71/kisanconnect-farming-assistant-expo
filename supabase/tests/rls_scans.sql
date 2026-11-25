-- RLS + privilege checks: scans, scan photos (storage), AI quota/budget/events.
-- Run as postgres; everything is rolled back. Failed check = exception, passed = NOTICE.

begin;

insert into auth.users (id, aud, role, email)
values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'scan-a@example.test'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'scan-b@example.test');

-- ── user A: farm, crop, scan ──
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';

insert into public.farms (id, name, area_value, area_unit) values ('aaaaaaaa-1111-4000-8000-000000000001', 'A farm', 5, 'acre');
insert into public.crops (id, farm_id, crop_key, sowing_date) values ('aaaaaaaa-2222-4000-8000-000000000001', 'aaaaaaaa-1111-4000-8000-000000000001', 'wheat', '2026-11-01');

-- AI columns are ignored on a client insert.
insert into public.scans (id, farm_id, crop_id, crop_key, quality, ai_result, final_status, checked_at)
values ('aaaaaaaa-3333-4000-8000-000000000001', 'aaaaaaaa-1111-4000-8000-000000000001', 'aaaaaaaa-2222-4000-8000-000000000001',
        'wheat', '{"blurVariance": 120}', '{"status":"ok"}', 'likely', now());

do $$
begin
  if (select final_status from public.scans where id = 'aaaaaaaa-3333-4000-8000-000000000001') is not null
     or (select ai_result from public.scans where id = 'aaaaaaaa-3333-4000-8000-000000000001') is not null then
    raise exception 'FAIL: client set AI columns on insert';
  end if;
  raise notice 'PASS: client cannot set AI columns on insert';
end $$;

-- Client update of AI columns is ignored; ask_expert works; version bumps.
do $$
declare v int;
begin
  update public.scans set final_status = 'likely', top_disease_id = 'wheat-yellow-rust', ask_expert = true
    where id = 'aaaaaaaa-3333-4000-8000-000000000001';
  if (select final_status from public.scans where id = 'aaaaaaaa-3333-4000-8000-000000000001') is not null then
    raise exception 'FAIL: client changed AI columns';
  end if;
  if not (select ask_expert from public.scans where id = 'aaaaaaaa-3333-4000-8000-000000000001') then
    raise exception 'FAIL: ask_expert not saved';
  end if;
  select version into v from public.scans where id = 'aaaaaaaa-3333-4000-8000-000000000001';
  if v <> 2 then raise exception 'FAIL: version not bumped (%).', v; end if;
  raise notice 'PASS: client cannot change AI columns; ask_expert saved';
end $$;

-- Stale compare-and-set changes nothing.
do $$
declare n int;
begin
  update public.scans set ask_expert = false where id = 'aaaaaaaa-3333-4000-8000-000000000001' and version = 1;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: stale CAS update changed % rows', n; end if;
  raise notice 'PASS: stale CAS update changes 0 rows';
end $$;

-- photo_path must be <own uid>/<scan id>.jpg
do $$
begin
  begin
    update public.scans set photo_path = 'bbbbbbbb-0000-4000-8000-000000000002/aaaaaaaa-3333-4000-8000-000000000001.jpg'
      where id = 'aaaaaaaa-3333-4000-8000-000000000001';
    raise exception 'FAIL: photo_path in another user folder accepted';
  exception when check_violation then
    raise notice 'PASS: photo_path must be in the owner folder';
  end;
  update public.scans set photo_path = 'aaaaaaaa-0000-4000-8000-000000000001/aaaaaaaa-3333-4000-8000-000000000001.jpg'
    where id = 'aaaaaaaa-3333-4000-8000-000000000001';
end $$;

-- No hard delete for clients.
do $$
declare n int;
begin
  begin
    delete from public.scans where id = 'aaaaaaaa-3333-4000-8000-000000000001';
    get diagnostics n = row_count;
  exception when insufficient_privilege then
    raise notice 'PASS: client cannot hard-delete scans';
    return;
  end;
  if n <> 0 then raise exception 'FAIL: client hard-deleted a scan'; end if;
  raise notice 'PASS: client hard delete touches 0 rows';
end $$;

-- A uploads a photo into their own folder.
insert into storage.objects (bucket_id, name, owner)
values ('scan-photos', 'aaaaaaaa-0000-4000-8000-000000000001/aaaaaaaa-3333-4000-8000-000000000001.jpg', 'aaaaaaaa-0000-4000-8000-000000000001');

-- Client can't touch quota / budget / events or the quota functions.
do $$
begin
  begin perform 1 from public.ai_quota; raise exception 'FAIL: client reads ai_quota';
  exception when insufficient_privilege then raise notice 'PASS: client cannot read ai_quota'; end;
  begin perform 1 from public.ai_budget; raise exception 'FAIL: client reads ai_budget';
  exception when insufficient_privilege then raise notice 'PASS: client cannot read ai_budget'; end;
  begin insert into public.ai_events (kind, status) values ('scan', 'ok'); raise exception 'FAIL: client writes ai_events';
  exception when insufficient_privilege then raise notice 'PASS: client cannot write ai_events'; end;
  begin perform public.use_ai_quota('aaaaaaaa-0000-4000-8000-000000000001', 'scan', 999, 999); raise exception 'FAIL: client calls use_ai_quota';
  exception when insufficient_privilege then raise notice 'PASS: client cannot call use_ai_quota'; end;
end $$;

-- ── user B ──
set local request.jwt.claims = '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';

do $$
declare n int;
begin
  if exists (select 1 from public.scans) then raise exception 'FAIL: B can read A''s scans'; end if;
  raise notice 'PASS: B cannot read A''s scans';

  update public.scans set ask_expert = false where id = 'aaaaaaaa-3333-4000-8000-000000000001';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: B updated A''s scan'; end if;
  raise notice 'PASS: B cannot update A''s scan';

  begin
    insert into public.scans (id, farm_id, crop_key) values ('bbbbbbbb-3333-4000-8000-000000000001', 'aaaaaaaa-1111-4000-8000-000000000001', 'wheat');
    raise exception 'FAIL: B linked a scan to A''s farm';
  exception when foreign_key_violation then
    raise notice 'PASS: B cannot link a scan to A''s farm';
  end;

  if exists (select 1 from storage.objects where bucket_id = 'scan-photos') then raise exception 'FAIL: B can list A''s photos'; end if;
  raise notice 'PASS: B cannot read/list A''s photos';

  delete from storage.objects where name like 'aaaaaaaa-0000-4000-8000-000000000001/%';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: B deleted A''s photo'; end if;
  raise notice 'PASS: B cannot delete A''s photos';

  begin
    insert into storage.objects (bucket_id, name, owner)
    values ('scan-photos', 'aaaaaaaa-0000-4000-8000-000000000001/evil.jpg', 'bbbbbbbb-0000-4000-8000-000000000002');
    raise exception 'FAIL: B uploaded into A''s folder';
  exception when insufficient_privilege then
    raise notice 'PASS: B cannot upload into A''s folder';
  end;
end $$;

-- ── service role: quota + budget ──
reset role;
set local role service_role;
do $$
declare r text;
begin
  -- user cap 2: ok, ok, user_limit
  if public.use_ai_quota('aaaaaaaa-0000-4000-8000-000000000001', 'scan', 2, 100) <> 'ok'
     or public.use_ai_quota('aaaaaaaa-0000-4000-8000-000000000001', 'scan', 2, 100) <> 'ok'
     or public.use_ai_quota('aaaaaaaa-0000-4000-8000-000000000001', 'scan', 2, 100) <> 'user_limit' then
    raise exception 'FAIL: per-user cap';
  end if;
  -- global budget 3 (2 already used): B gets 1, then budget gone and B's unit is not used
  r := public.use_ai_quota('bbbbbbbb-0000-4000-8000-000000000002', 'scan', 10, 3);
  if r <> 'ok' then raise exception 'FAIL: B first unit (%).', r; end if;
  r := public.use_ai_quota('bbbbbbbb-0000-4000-8000-000000000002', 'scan', 10, 3);
  if r <> 'budget' then raise exception 'FAIL: budget cap (%).', r; end if;
  if (select scans_used from public.ai_quota where user_id = 'bbbbbbbb-0000-4000-8000-000000000002') <> 1 then
    raise exception 'FAIL: user unit taken although budget was gone';
  end if;
  -- refund
  perform public.refund_ai_quota('bbbbbbbb-0000-4000-8000-000000000002', 'scan', 1, true);
  if (select used from public.ai_budget where kind = 'gemini') <> 2
     or (select scans_used from public.ai_quota where user_id = 'bbbbbbbb-0000-4000-8000-000000000002') <> 0 then
    raise exception 'FAIL: refund';
  end if;
  raise notice 'PASS: per-user cap, shared budget and refund';

  -- server can write AI columns (version bumps so the phone pulls it)
  update public.scans set final_status = 'possible', top_disease_id = 'wheat-yellow-rust', checked_at = now(), ai_result = '{"status":"ok"}'
    where id = 'aaaaaaaa-3333-4000-8000-000000000001';
  if (select final_status from public.scans where id = 'aaaaaaaa-3333-4000-8000-000000000001') <> 'possible' then
    raise exception 'FAIL: server could not write AI columns';
  end if;
  raise notice 'PASS: server writes AI columns';
end $$;

rollback;
