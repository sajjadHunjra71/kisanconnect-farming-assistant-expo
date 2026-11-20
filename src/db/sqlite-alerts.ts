import type { SQLiteDatabase } from 'expo-sqlite';

import { mergeAlert, type AlertRecord, type AlertsLocal } from './alerts-local';

type Row = Omit<AlertRecord, 'read_dirty'> & { read_dirty: number };
const fromRow = (r: Row): AlertRecord => ({ ...r, read_dirty: r.read_dirty === 1 });
const COLS = ['id', 'farm_id', 'crop_id', 'kind', 'severity', 'title', 'body', 'start_date', 'created_at', 'updated_at', 'pushed_at', 'read_at', 'read_dirty', 'notified_at'] as const;
const CURSOR = 'alerts_cursor';

export function createSqliteAlerts(db: SQLiteDatabase): AlertsLocal {
  return {
    list: async () => (await db.getAllAsync<Row>('select * from alerts order by start_date desc, created_at desc')).map(fromRow),
    unreadCount: async () => (await db.getFirstAsync<{ n: number }>('select count(*) as n from alerts where read_at is null'))?.n ?? 0,
    upsert: async (server) => {
      const fresh: AlertRecord[] = [];
      await db.withExclusiveTransactionAsync(async (txn) => {
        for (const s of server) {
          const prev = await txn.getFirstAsync<Row>('select * from alerts where id = ?', [s.id]);
          const merged = mergeAlert(prev ? fromRow(prev) : undefined, s);
          if (!prev) fresh.push(merged);
          await txn.runAsync(
            `insert or replace into alerts (${COLS.join(', ')}) values (${COLS.map(() => '?').join(', ')})`,
            COLS.map((c) => (c === 'read_dirty' ? (merged.read_dirty ? 1 : 0) : (merged[c] ?? null))),
          );
        }
      });
      return fresh;
    },
    markRead: async (ids, at) => {
      if (!ids.length) return;
      await db.runAsync(`update alerts set read_at = ?, read_dirty = 1 where read_at is null and id in (${ids.map(() => '?').join(', ')})`, [at, ...ids]);
    },
    dirtyReads: async () => (await db.getAllAsync<{ id: string }>('select id from alerts where read_dirty = 1')).map((r) => r.id),
    clearDirty: async (ids) => {
      if (!ids.length) return;
      await db.runAsync(`update alerts set read_dirty = 0 where id in (${ids.map(() => '?').join(', ')})`, ids);
    },
    markNotified: async (ids, at) => {
      if (!ids.length) return;
      await db.runAsync(`update alerts set notified_at = ? where id in (${ids.map(() => '?').join(', ')})`, [at, ...ids]);
    },
    getCursor: async () => {
      const r = await db.getFirstAsync<{ value: string }>('select value from kv where key = ?', [CURSOR]);
      return r ? JSON.parse(r.value) : null;
    },
    setCursor: async (c) => {
      await db.runAsync('insert or replace into kv (key, value) values (?, ?)', [CURSOR, JSON.stringify(c)]);
    },
  };
}
