import type { CoalesceDecision, OutboxOp } from './outbox-coalesce';
import type { SyncTable } from './types';

export type Row = Record<string, unknown> & { id: string; user_id: string; deleted_at: string | null };

export type RowFilter = { user_id: string; farm_id?: string; crop_id?: string };

export type OutboxStatus = 'pending' | 'inflight' | 'failed';

export type OutboxEntry = OutboxOp & {
  tbl: SyncTable;
  row_id: string;
  status: OutboxStatus;
  attempts: number;
  last_error: string | null;
  /** Insertion order (SQLite rowid). */
  seq: number;
};

export type OutboxPatch = Partial<Pick<OutboxEntry, 'status' | 'attempts' | 'last_error' | 'base_version'>>;

/** Keyset cursor for pulls: the newest server (updated_at, id) applied so far. */
export type SyncCursor = { updated_at: string; id: string };

/** Storage operations, always inside one transaction. */
export interface TxStore {
  getRow(table: SyncTable, id: string): Promise<Row | null>;
  putRow(table: SyncTable, row: Row): Promise<void>;
  deleteRow(table: SyncTable, id: string): Promise<void>;
  listRows(table: SyncTable, filter: RowFilter): Promise<Row[]>;
  /** Latest outbox entry for the row that hasn't been sent yet. */
  getPendingOp(table: SyncTable, rowId: string): Promise<OutboxOp | null>;
  applyDecision(table: SyncTable, rowId: string, decision: CoalesceDecision): Promise<void>;
  /** Remove not-yet-sent outbox entries for these rows. */
  dropPending(table: SyncTable, rowIds: string[]): Promise<void>;
  /** Whole outbox in insertion order. */
  listOutbox(): Promise<OutboxEntry[]>;
  updateOutbox(opId: string, patch: OutboxPatch): Promise<void>;
  deleteOutbox(opIds: string[]): Promise<void>;
  getCursor(table: SyncTable): Promise<SyncCursor | null>;
  setCursor(table: SyncTable, cursor: SyncCursor | null): Promise<void>;
}

export interface Store {
  transaction<T>(fn: (tx: TxStore) => Promise<T>): Promise<T>;
}
