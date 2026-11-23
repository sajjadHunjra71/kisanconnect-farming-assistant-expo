import type { SQLiteBindValue, SQLiteDatabase } from 'expo-sqlite';

import type { OutboxKind, OutboxOp } from './outbox-coalesce';
import { BOOL_COLUMNS, JSON_COLUMNS, MIGRATIONS, SCHEMA_VERSION, TABLE_COLUMNS } from './schema';
import type { OutboxEntry, Row, Store, SyncCursor, TxStore } from './store';


/** Run pending schema migrations (tracked with PRAGMA user_version). */
export async function migrate(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('pragma journal_mode = WAL;');
  const res = await db.getFirstAsync<{ user_version: number }>('pragma user_version');
  const current = res?.user_version ?? 0;
  if (current >= SCHEMA_VERSION) return;
  await db.withExclusiveTransactionAsync(async (txn) => {
    for (let v = current; v < SCHEMA_VERSION; v++) await txn.execAsync(MIGRATIONS[v]);
    await txn.execAsync(`pragma user_version = ${SCHEMA_VERSION}`);
  });
}

const bind = (v: unknown): SQLiteBindValue => (v === undefined ? null : (v as SQLiteBindValue));

/** App value → SQLite value (objects as JSON text, booleans as 0/1). */
function toDb(column: string, v: unknown): SQLiteBindValue {
  if (v == null) return null;
  if (JSON_COLUMNS.has(column)) return typeof v === 'string' ? v : JSON.stringify(v);
  if (BOOL_COLUMNS.has(column)) return v ? 1 : 0;
  return bind(v);
}

/** SQLite row → app row. */
function fromDb<T extends Record<string, unknown> | null>(row: T): T {
  if (!row) return row;
  const out: Record<string, unknown> = { ...row };
  for (const c of JSON_COLUMNS) {
    if (typeof out[c] === 'string') {
      try {
        out[c] = JSON.parse(out[c] as string);
      } catch {
        out[c] = null;
      }
    }
  }
  for (const c of BOOL_COLUMNS) if (c in out && out[c] !== null) out[c] = out[c] === 1 || out[c] === true;
  return out as T;
}

function txStore(db: SQLiteDatabase): TxStore {
  return {
    getRow: async (table, id) => fromDb(await db.getFirstAsync<Row>(`select * from ${table} where id = ?`, [id])),

    putRow: async (table, row) => {
      const cols = TABLE_COLUMNS[table];
      await db.runAsync(
        `insert or replace into ${table} (${cols.join(', ')}) values (${cols.map(() => '?').join(', ')})`,
        cols.map((c) => toDb(c, row[c])),
      );
    },

    listRows: async (table, f) => {
      const where = ['user_id = ?'];
      const params: SQLiteBindValue[] = [f.user_id];
      if (f.farm_id !== undefined) {
        where.push('farm_id = ?');
        params.push(f.farm_id);
      }
      if (f.crop_id !== undefined) {
        where.push('crop_id = ?');
        params.push(f.crop_id);
      }
      return (await db.getAllAsync<Row>(`select * from ${table} where ${where.join(' and ')}`, params)).map(fromDb);
    },

    getPendingOp: async (table, rowId) => {
      const e = await db.getFirstAsync<{ op_id: string; kind: OutboxKind; payload: string; base_version: number }>(
        `select op_id, kind, payload, base_version from outbox
          where tbl = ? and row_id = ? and status = 'pending' order by rowid desc limit 1`,
        [table, rowId],
      );
      return e ? ({ ...e, payload: JSON.parse(e.payload) } as OutboxOp) : null;
    },

    applyDecision: async (table, rowId, d) => {
      switch (d.type) {
        case 'insert':
          await db.runAsync(
            `insert into outbox (op_id, tbl, row_id, kind, payload, base_version, created_at)
             values (?, ?, ?, ?, ?, ?, ?)`,
            [d.entry.op_id, table, rowId, d.entry.kind, JSON.stringify(d.entry.payload), d.entry.base_version, new Date().toISOString()],
          );
          break;
        case 'replace':
          await db.runAsync(`update outbox set kind = ?, payload = ? where op_id = ? and status = 'pending'`, [
            d.entry.kind,
            JSON.stringify(d.entry.payload),
            d.entry.op_id,
          ]);
          break;
        case 'drop':
          await db.runAsync(`delete from outbox where op_id = ? and status = 'pending'`, [d.op_id]);
          break;
        case 'ignore':
          break;
      }
    },

    deleteRow: async (table, id) => {
      await db.runAsync(`delete from ${table} where id = ?`, [id]);
    },

    listOutbox: async () => {
      const rows = await db.getAllAsync<Omit<OutboxEntry, 'payload'> & { payload: string }>(
        `select rowid as seq, op_id, tbl, row_id, kind, payload, base_version, attempts, status, last_error
           from outbox order by rowid`,
      );
      return rows.map((r) => ({ ...r, payload: JSON.parse(r.payload) as unknown }));
    },

    updateOutbox: async (opId, patch) => {
      const keys = (['status', 'attempts', 'last_error', 'base_version'] as const).filter((k) => patch[k] !== undefined);
      if (keys.length === 0) return;
      await db.runAsync(`update outbox set ${keys.map((k) => `${k} = ?`).join(', ')} where op_id = ?`, [
        ...keys.map((k) => bind(patch[k])),
        opId,
      ]);
    },

    deleteOutbox: async (opIds) => {
      if (opIds.length === 0) return;
      await db.runAsync(`delete from outbox where op_id in (${opIds.map(() => '?').join(', ')})`, opIds);
    },

    getCursor: async (table) => {
      const r = await db.getFirstAsync<{ cursor_updated_at: string | null; cursor_id: string | null }>(
        'select cursor_updated_at, cursor_id from sync_state where tbl = ?',
        [table],
      );
      return r?.cursor_updated_at && r.cursor_id ? ({ updated_at: r.cursor_updated_at, id: r.cursor_id } satisfies SyncCursor) : null;
    },

    setCursor: async (table, cursor) => {
      await db.runAsync(
        `insert into sync_state (tbl, cursor_updated_at, cursor_id) values (?, ?, ?)
         on conflict (tbl) do update set cursor_updated_at = excluded.cursor_updated_at, cursor_id = excluded.cursor_id`,
        [table, cursor?.updated_at ?? null, cursor?.id ?? null],
      );
    },

    dropPending: async (table, rowIds) => {
      if (rowIds.length === 0) return;
      await db.runAsync(
        `delete from outbox where tbl = ? and status = 'pending' and row_id in (${rowIds.map(() => '?').join(', ')})`,
        [table, ...rowIds],
      );
    },
  };
}

export function createSqliteStore(db: SQLiteDatabase): Store {
  return {
    async transaction<T>(fn: (tx: TxStore) => Promise<T>): Promise<T> {
      let result: T | undefined;
      await db.withExclusiveTransactionAsync(async (txn) => {
        result = await fn(txStore(txn));
      });
      return result as T;
    },
  };
}

