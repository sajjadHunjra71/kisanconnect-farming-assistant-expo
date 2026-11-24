/** Local SQLite schema. Bump SCHEMA_VERSION and add a step to MIGRATIONS for changes. */

const SYNC_COLS = `
  version integer not null default 0,
  last_op_id text,
  created_at text not null,
  updated_at text not null,
  deleted_at text`;

export const MIGRATIONS: string[] = [
  // v1
  `
  create table if not exists farms (
    id text primary key not null,
    user_id text not null,
    name text not null,
    area_value real not null,
    area_unit text not null,
    area_acres real not null,
    district text,
    lat real,
    lng real,
    location_source text,
    soil_type text,
    notes text,${SYNC_COLS}
  );
  create index if not exists farms_sync_idx on farms (user_id, updated_at, id);

  create table if not exists crops (
    id text primary key not null,
    user_id text not null,
    farm_id text not null,
    crop_key text not null,
    variety text,
    sowing_date text not null,
    area_value real,
    area_unit text,
    area_acres real,
    status text not null default 'active',
    harvested_on text,${SYNC_COLS}
  );
  create index if not exists crops_sync_idx on crops (user_id, updated_at, id);
  create index if not exists crops_farm_idx on crops (farm_id);

  create table if not exists activities (
    id text primary key not null,
    user_id text not null,
    farm_id text not null,
    crop_id text,
    type text not null,
    done_on text not null,
    quantity real,
    quantity_unit text,
    product text,
    cost_pkr real,
    notes text,
    source text not null default 'manual',${SYNC_COLS}
  );
  create index if not exists activities_sync_idx on activities (user_id, updated_at, id);
  create index if not exists activities_farm_idx on activities (farm_id);
  create index if not exists activities_crop_idx on activities (crop_id);

  create table if not exists outbox (
    op_id text primary key not null,
    tbl text not null check (tbl in ('farms', 'crops', 'activities')),
    row_id text not null,
    kind text not null check (kind in ('create', 'update', 'delete')),
    payload text not null,
    base_version integer not null,
    attempts integer not null default 0,
    status text not null default 'pending' check (status in ('pending', 'inflight', 'failed')),
    last_error text,
    created_at text not null
  );
  create index if not exists outbox_row_idx on outbox (tbl, row_id, status);

  create table if not exists sync_state (
    tbl text primary key not null check (tbl in ('farms', 'crops', 'activities')),
    cursor_updated_at text,
    cursor_id text
  );
  `,
  // v2: weather alerts inbox + small key/value table
  `
  create table if not exists alerts (
    id text primary key not null,
    farm_id text not null,
    crop_id text,
    kind text not null,
    severity text not null,
    title text not null,
    body text not null,
    start_date text not null,
    created_at text not null,
    updated_at text not null,
    pushed_at text,
    read_at text,
    read_dirty integer not null default 0,
    notified_at text
  );
  create index if not exists alerts_updated_idx on alerts (updated_at, id);
  create table if not exists kv (key text primary key not null, value text not null);
  `,
  // v3: leaf scans (synced) + local scan queue (photo upload / cloud check state)
  `
  create table if not exists scans (
    id text primary key not null,
    user_id text not null,
    farm_id text,
    crop_id text,
    crop_key text not null,
    photo_path text,
    quality text,
    model_result text,
    model_version text,
    ask_expert integer not null default 0,
    ai_result text,
    final_status text,
    top_disease_id text,
    needs_expert_ai integer,
    checked_at text,${SYNC_COLS}
  );
  create index if not exists scans_sync_idx on scans (user_id, updated_at, id);
  create table if not exists scan_local (
    scan_id text primary key not null,
    local_path text not null,
    uploaded integer not null default 0,
    check_state text not null,
    attempts integer not null default 0,
    last_error text,
    notified integer not null default 0,
    created_at text not null
  );
  `,
  // v4: v1's outbox / sync_state had check (tbl in ('farms','crops','activities')), so scans
  // could never be queued or synced on phones that already had the app. Rebuild both without
  // a table-name check (the store validates table names against TABLE_COLUMNS), keeping rows
  // and outbox order (rowid).
  `
  create table outbox_v4 (
    op_id text primary key not null,
    tbl text not null,
    row_id text not null,
    kind text not null check (kind in ('create', 'update', 'delete')),
    payload text not null,
    base_version integer not null,
    attempts integer not null default 0,
    status text not null default 'pending' check (status in ('pending', 'inflight', 'failed')),
    last_error text,
    created_at text not null
  );
  insert into outbox_v4 (rowid, op_id, tbl, row_id, kind, payload, base_version, attempts, status, last_error, created_at)
    select rowid, op_id, tbl, row_id, kind, payload, base_version, attempts, status, last_error, created_at from outbox order by rowid;
  drop table outbox;
  alter table outbox_v4 rename to outbox;
  create index if not exists outbox_row_idx on outbox (tbl, row_id, status);

  create table sync_state_v4 (
    tbl text primary key not null,
    cursor_updated_at text,
    cursor_id text
  );
  insert into sync_state_v4 (tbl, cursor_updated_at, cursor_id) select tbl, cursor_updated_at, cursor_id from sync_state;
  drop table sync_state;
  alter table sync_state_v4 rename to sync_state;
  `,
];

export const SCHEMA_VERSION = MIGRATIONS.length;

const SYNC_COLUMN_NAMES = ['version', 'last_op_id', 'created_at', 'updated_at', 'deleted_at'];

/** Column lists used when writing rows (only these keys ever reach SQL). */
export const TABLE_COLUMNS = {
  farms: ['id', 'user_id', 'name', 'area_value', 'area_unit', 'area_acres', 'district', 'lat', 'lng', 'location_source', 'soil_type', 'notes', ...SYNC_COLUMN_NAMES],
  crops: ['id', 'user_id', 'farm_id', 'crop_key', 'variety', 'sowing_date', 'area_value', 'area_unit', 'area_acres', 'status', 'harvested_on', ...SYNC_COLUMN_NAMES],
  activities: ['id', 'user_id', 'farm_id', 'crop_id', 'type', 'done_on', 'quantity', 'quantity_unit', 'product', 'cost_pkr', 'notes', 'source', ...SYNC_COLUMN_NAMES],
  scans: [
    'id', 'user_id', 'farm_id', 'crop_id', 'crop_key', 'photo_path', 'quality', 'model_result', 'model_version', 'ask_expert',
    'ai_result', 'final_status', 'top_disease_id', 'needs_expert_ai', 'checked_at', ...SYNC_COLUMN_NAMES,
  ],
} as const;

/** Columns stored as JSON text in SQLite (objects in the app). */
export const JSON_COLUMNS = new Set(['quality', 'model_result', 'ai_result']);
/** Columns stored as 0/1 in SQLite (booleans in the app). */
export const BOOL_COLUMNS = new Set(['ask_expert', 'needs_expert_ai']);
