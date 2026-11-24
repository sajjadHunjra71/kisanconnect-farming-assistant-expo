/**
 * Local schema migrations on a real SQLite engine (node:sqlite behind a small
 * expo-sqlite-shaped adapter), starting from databases made by older app versions.
 */
import type { SQLiteDatabase } from 'expo-sqlite';

import { MIGRATIONS, SCHEMA_VERSION } from '../schema';
import { createSqliteStore, migrate } from '../sqlite-store';

// eslint-disable-next-line @typescript-eslint/no-require-imports
type Params = (string | number | null)[];
type Statement = { run: (...p: Params) => unknown; get: (...p: Params) => unknown; all: (...p: Params) => unknown[] };
type RawDb = { exec: (sql: string) => void; prepare: (sql: string) => Statement };
// node:sqlite (Node 22+); typed by hand because the app's tsconfig has no Node types.
const { DatabaseSync } = require('node:sqlite') as { DatabaseSync: new (path: string) => RawDb };

function adapter(raw: RawDb): SQLiteDatabase {
  const db = {
    execAsync: async (sql: string) => raw.exec(sql),
    runAsync: async (sql: string, params: Params = []) => raw.prepare(sql).run(...params),
    getFirstAsync: async (sql: string, params: Params = []) => raw.prepare(sql).get(...params) ?? null,
    getAllAsync: async (sql: string, params: Params = []) => raw.prepare(sql).all(...params),
    withExclusiveTransactionAsync: async (fn: (txn: unknown) => Promise<void>) => {
      raw.exec('begin exclusive');
      try {
        await fn(db);
        raw.exec('commit');
      } catch (e) {
        raw.exec('rollback');
        throw e;
      }
    },
  };
  return db as unknown as SQLiteDatabase;
}

/** A database as an older app version left it: migrations up to `version` applied. */
function oldDb(version: number) {
  const raw = new DatabaseSync(':memory:');
  for (let v = 0; v < version; v++) raw.exec(MIGRATIONS[v]);
  raw.exec(`pragma user_version = ${version}`);
  const add = raw.prepare(
    `insert into outbox (op_id, tbl, row_id, kind, payload, base_version, attempts, status, created_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  add.run('op-1', 'farms', 'f1', 'create', '{"name":"A"}', 0, 0, 'pending', '2026-11-20T00:00:00Z');
  add.run('op-2', 'crops', 'c1', 'update', '{"variety":"X"}', 3, 2, 'failed', '2026-11-21T00:00:00Z');
  add.run('op-3', 'activities', 'a1', 'delete', '{}', 1, 0, 'pending', '2026-11-22T00:00:00Z');
  raw.prepare(`insert into sync_state (tbl, cursor_updated_at, cursor_id) values (?, ?, ?)`).run('farms', '2026-11-20T00:00:00Z', 'f1');
  return raw;
}

const scanOp = { op_id: 'op-scan', kind: 'create' as const, payload: { id: 's1', crop_key: 'wheat' }, base_version: 0 };

describe.each([1, 2, 3])('migrating a v%i database', (from) => {
  it('keeps outbox rows in order and accepts scans', async () => {
    const raw = oldDb(from);
    // The old CHECK is what broke scans on existing installs.
    expect(() =>
      raw.prepare(`insert into outbox (op_id, tbl, row_id, kind, payload, base_version, created_at) values ('x', 'scans', 's', 'create', '{}', 0, 'now')`).run(),
    ).toThrow(/CHECK constraint failed/);

    const db = adapter(raw);
    await migrate(db);
    expect((raw.prepare('pragma user_version').get() as { user_version: number }).user_version).toBe(SCHEMA_VERSION);

    const store = createSqliteStore(db);
    await store.transaction(async (tx) => {
      await tx.applyDecision('scans', 's1', { type: 'insert', entry: scanOp });
      await tx.setCursor('scans', { updated_at: '2026-11-24T00:00:00Z', id: 's1' });
    });

    const outbox = await store.transaction((tx) => tx.listOutbox());
    expect(outbox.map((e) => [e.op_id, e.tbl, e.status, e.attempts])).toEqual([
      ['op-1', 'farms', 'pending', 0],
      ['op-2', 'crops', 'failed', 2],
      ['op-3', 'activities', 'pending', 0],
      ['op-scan', 'scans', 'pending', 0],
    ]);
    expect(outbox[0].payload).toEqual({ name: 'A' });
    expect(await store.transaction((tx) => tx.getCursor('farms'))).toEqual({ updated_at: '2026-11-20T00:00:00Z', id: 'f1' });
    expect(await store.transaction((tx) => tx.getCursor('scans'))).toEqual({ updated_at: '2026-11-24T00:00:00Z', id: 's1' });

    // scans + scan_local exist
    const tables = (raw.prepare(`select name from sqlite_master where type = 'table'`).all() as { name: string }[]).map((t) => t.name);
    expect(tables).toEqual(expect.arrayContaining(['scans', 'scan_local', 'outbox', 'sync_state', 'alerts', 'kv']));

    // A second run is a no-op.
    await migrate(db);
    expect((await store.transaction((tx) => tx.listOutbox())).length).toBe(4);
  });
});

it('a fresh database ends at the current version and rejects unknown tables', async () => {
  const raw = new DatabaseSync(':memory:');
  const db = adapter(raw);
  await migrate(db);
  const store = createSqliteStore(db);
  await expect(
    store.transaction((tx) => tx.applyDecision('nope' as 'scans', 'x', { type: 'insert', entry: scanOp })),
  ).rejects.toThrow('Unknown sync table: nope');
  expect(await store.transaction((tx) => tx.listOutbox())).toEqual([]);
});
