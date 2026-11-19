import type { CoalesceDecision, OutboxOp } from './outbox-coalesce';
import type { SyncTable } from './types';

export type Row = Record<string, unknown> & { id: string; user_id: string; deleted_at: string | null };

export type RowFilter = { user_id: string; farm_id?: string; crop_id?: string };

/** Storage operations used by the repos, always inside one transaction. */
export interface TxStore {
  getRow(table: SyncTable, id: string): Promise<Row | null>;
  putRow(table: SyncTable, row: Row): Promise<void>;
  listRows(table: SyncTable, filter: RowFilter): Promise<Row[]>;
  /** Latest outbox entry for the row that hasn't been sent yet. */
  getPendingOp(table: SyncTable, rowId: string): Promise<OutboxOp | null>;
  applyDecision(table: SyncTable, rowId: string, decision: CoalesceDecision): Promise<void>;
  /** Remove not-yet-sent outbox entries for these rows. */
  dropPending(table: SyncTable, rowIds: string[]): Promise<void>;
}

export interface Store {
  transaction<T>(fn: (tx: TxStore) => Promise<T>): Promise<T>;
}
