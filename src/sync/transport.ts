import type { SyncCursor } from '@/db/store';
import type { SyncTable } from '@/db/types';

export type ServerRow = Record<string, unknown> & {
  id: string;
  user_id: string;
  version: number;
  updated_at: string;
  deleted_at: string | null;
  last_op_id: string | null;
};

export type PullQuery = {
  table: SyncTable;
  /** First page: rows with updated_at >= since (omit for a full download). */
  since?: string;
  /** Later pages: rows after this (updated_at, id) keyset. */
  after?: SyncCursor;
  limit: number;
};

/**
 * Everything the sync engine needs from the server. Supabase implements it in
 * supabase-transport.ts; tests use a fake. Methods throw errors that
 * `classifyError` understands ({ status, code, message } or SyncError).
 */
export interface SyncTransport {
  /** Make sure there's a fresh access token (refresh if close to expiry). */
  ensureSession(): Promise<void>;
  /** INSERT … ON CONFLICT (id) DO NOTHING RETURNING *. null = row already existed. */
  insertIgnore(table: SyncTable, payload: Record<string, unknown>): Promise<ServerRow | null>;
  /** UPDATE … WHERE id = ? AND version = base RETURNING *. null = 0 rows. */
  casUpdate(table: SyncTable, id: string, baseVersion: number, patch: Record<string, unknown>): Promise<ServerRow | null>;
  fetchRow(table: SyncTable, id: string): Promise<ServerRow | null>;
  /** Ordered by (updated_at, id). */
  pullPage(query: PullQuery): Promise<ServerRow[]>;
}
