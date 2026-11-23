import type { SQLiteDatabase } from 'expo-sqlite';

import type { ScanLocalState, ScanQueue } from './scan-queue';

type Row = Omit<ScanLocalState, 'uploaded' | 'notified'> & { uploaded: number; notified: number };
const fromRow = (r: Row): ScanLocalState => ({ ...r, uploaded: r.uploaded === 1, notified: r.notified === 1 });
const COLS = ['scan_id', 'local_path', 'uploaded', 'check_state', 'attempts', 'last_error', 'notified', 'created_at'] as const;

export function createSqliteScanQueue(db: SQLiteDatabase): ScanQueue {
  const values = (s: ScanLocalState) => COLS.map((c) => (c === 'uploaded' || c === 'notified' ? (s[c] ? 1 : 0) : s[c]));
  return {
    get: async (id) => {
      const r = await db.getFirstAsync<Row>('select * from scan_local where scan_id = ?', [id]);
      return r ? fromRow(r) : null;
    },
    list: async () => (await db.getAllAsync<Row>('select * from scan_local order by created_at')).map(fromRow),
    put: async (s) => {
      await db.runAsync(`insert or replace into scan_local (${COLS.join(', ')}) values (${COLS.map(() => '?').join(', ')})`, values(s));
    },
    update: async (id, patch) => {
      const cur = await db.getFirstAsync<Row>('select * from scan_local where scan_id = ?', [id]);
      if (!cur) return;
      const next = { ...fromRow(cur), ...patch };
      await db.runAsync(`insert or replace into scan_local (${COLS.join(', ')}) values (${COLS.map(() => '?').join(', ')})`, values(next));
    },
    remove: async (id) => {
      await db.runAsync('delete from scan_local where scan_id = ?', [id]);
    },
  };
}
