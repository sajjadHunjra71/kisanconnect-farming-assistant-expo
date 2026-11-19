import type { SQLiteBindValue, SQLiteDatabase } from 'expo-sqlite';

import type { OutboxKind, OutboxOp } from './outbox-coalesce';
import { MIGRATIONS, SCHEMA_VERSION, TABLE_COLUMNS } from './schema';
import type { Row, Store, TxStore } from './store';


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

function txStore(db: SQLiteDatabase): TxStore {
  return {
    getRow: (table, id) => db.getFirstAsync<Row>(`select * from ${table} where id = ?`, [id]),

    putRow: async (table, row) => {
      const cols = TABLE_COLUMNS[table];
      await db.runAsync(
        `insert or replace into ${table} (${cols.join(', ')}) values (${cols.map(() => '?').join(', ')})`,
        cols.map((c) => bind(row[c])),
      );
    },

    listRows: (table, f) => {
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
      return db.getAllAsync<Row>(`select * from ${table} where ${where.join(' and ')}`, params);
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

