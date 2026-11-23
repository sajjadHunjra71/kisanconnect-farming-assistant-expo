/**
 * In-memory Store (pure TS). Used for demo mode / web (sample data) and in unit tests.
 * Transactions run one at a time and roll back on error.
 */
import type { OutboxEntry, Row, Store, SyncCursor, TxStore } from './store';
import type { SyncTable } from './types';

type State = {
  tables: Record<SyncTable, Record<string, Row>>;
  outbox: OutboxEntry[];
  cursors: Partial<Record<SyncTable, SyncCursor>>;
  seq: number;
};

export type MemoryStore = Store & { snapshot(): State };

export function createMemoryStore(seed: Partial<Record<SyncTable, Row[]>> = {}): MemoryStore {
  let state: State = { tables: { farms: {}, crops: {}, activities: {}, scans: {} }, outbox: [], cursors: {}, seq: 0 };
  for (const [table, rows] of Object.entries(seed) as [SyncTable, Row[]][]) {
    for (const r of rows) state.tables[table][r.id] = { ...r };
  }

  const clone = (s: State): State => JSON.parse(JSON.stringify(s)) as State;
  let queue: Promise<unknown> = Promise.resolve();

  const tx: TxStore = {
    getRow: async (table, id) => (state.tables[table][id] ? { ...state.tables[table][id] } : null),
    putRow: async (table, row) => {
      state.tables[table][row.id] = { ...row };
    },
    deleteRow: async (table, id) => {
      delete state.tables[table][id];
    },
    listRows: async (table, f) =>
      Object.values(state.tables[table])
        .filter((r) => r.user_id === f.user_id)
        .filter((r) => f.farm_id === undefined || r.farm_id === f.farm_id)
        .filter((r) => f.crop_id === undefined || r.crop_id === f.crop_id)
        .map((r) => ({ ...r })),
    getPendingOp: async (table, rowId) => {
      const e = [...state.outbox].reverse().find((o) => o.tbl === table && o.row_id === rowId && o.status === 'pending');
      return e ? { op_id: e.op_id, kind: e.kind, payload: e.payload, base_version: e.base_version } : null;
    },
    applyDecision: async (table, rowId, d) => {
      if (d.type === 'insert') {
        state.outbox.push({ ...d.entry, tbl: table, row_id: rowId, status: 'pending', attempts: 0, last_error: null, seq: ++state.seq });
      }
      if (d.type === 'replace') {
        state.outbox = state.outbox.map((o) => (o.op_id === d.entry.op_id && o.status === 'pending' ? { ...o, ...d.entry } : o));
      }
      if (d.type === 'drop') state.outbox = state.outbox.filter((o) => !(o.op_id === d.op_id && o.status === 'pending'));
    },
    dropPending: async (table, rowIds) => {
      state.outbox = state.outbox.filter((o) => !(o.tbl === table && o.status === 'pending' && rowIds.includes(o.row_id)));
    },
    listOutbox: async () => state.outbox.map((o) => ({ ...o })).sort((a, b) => a.seq - b.seq),
    updateOutbox: async (opId, patch) => {
      state.outbox = state.outbox.map((o) => (o.op_id === opId ? { ...o, ...patch } : o));
    },
    deleteOutbox: async (opIds) => {
      state.outbox = state.outbox.filter((o) => !opIds.includes(o.op_id));
    },
    getCursor: async (table) => state.cursors[table] ?? null,
    setCursor: async (table, cursor) => {
      if (cursor) state.cursors[table] = cursor;
      else delete state.cursors[table];
    },
  };

  return {
    transaction<T>(fn: (t: TxStore) => Promise<T>): Promise<T> {
      const run = queue.then(async () => {
        const before = clone(state);
        try {
          return await fn(tx);
        } catch (e) {
          state = before;
          throw e;
        }
      });
      queue = run.catch(() => undefined);
      return run;
    },
    snapshot: () => clone(state),
  };
}
