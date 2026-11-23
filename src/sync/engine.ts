/**
 * Offline sync engine (pure TS; Supabase is behind SyncTransport).
 *
 * PUSH — outbox in order. create = insert-or-ignore; update/delete = compare-and-set
 * on version. When the server says "0 rows" we fetch the row:
 *   last_op_id = my op  → my write already landed (lost response) → done
 *   row deleted         → drop my ops for it, keep the server copy
 *   otherwise           → conflict: server copy wins, note it for the UI
 *
 * PULL — per table (farms → crops → activities) by keyset (updated_at, id), starting
 * 2 minutes before the cursor to catch late commits. Cursor older than 90 days
 * (tombstone horizon) → full re-download and prune rows the server no longer has.
 */
import type { OutboxEntry, SyncCursor } from '@/db/store';
import { SYNC_TABLES, type SyncTable } from '@/db/types';

import { SyncError, classifyError, type SyncErrorKind } from './errors';
import type { SyncLocal } from './local';
import type { ServerRow, SyncTransport } from './transport';

export type ConflictNote = { table: SyncTable; id: string; at: string };

export type SyncDeps = {
  transport: SyncTransport;
  local: SyncLocal;
  now?: () => Date;
  maxAttempts?: number;
};

export type PushResult = {
  pushed: number;
  conflicts: ConflictNote[];
  failedNow: number;
  skipped: number;
  stopped: Exclude<SyncErrorKind, 'permanent'> | null;
  error: string | null;
};

export const MAX_ATTEMPTS = 5;
export const PULL_PAGE = 500;
export const PULL_OVERLAP_MS = 2 * 60_000;
export const TOMBSTONE_HORIZON_MS = 90 * 86_400_000;

/** Fields the server owns; never sent. */
const SERVER_OWNED = ['version', 'updated_at', 'area_acres', 'ai_result', 'final_status', 'top_disease_id', 'needs_expert_ai', 'checked_at'];
const NOT_UPDATABLE = ['id', 'user_id', 'created_at', ...SERVER_OWNED];

function omit(o: Record<string, unknown>, keys: string[]) {
  const out = { ...o };
  for (const k of keys) delete out[k];
  return out;
}

/** Outbox rows that must wait if their parent can't be pushed. */
function parentKeys(e: OutboxEntry): string[] {
  const p = (e.payload ?? {}) as Record<string, unknown>;
  const keys = [`${e.tbl}:${e.row_id}`];
  if (e.tbl !== 'farms' && p.farm_id) keys.push(`farms:${String(p.farm_id)}`);
  if ((e.tbl === 'activities' || e.tbl === 'scans') && p.crop_id) keys.push(`crops:${String(p.crop_id)}`);
  return keys;
}

export async function push({ transport, local, now = () => new Date(), maxAttempts = MAX_ATTEMPTS }: SyncDeps): Promise<PushResult> {
  const result: PushResult = { pushed: 0, conflicts: [], failedNow: 0, skipped: 0, stopped: null, error: null };
  await local.resetInflight();
  const entries = await local.outbox();
  if (!entries.some((e) => e.status === 'pending')) return result;

  try {
    await transport.ensureSession();
  } catch (e) {
    const err = classifyError(e);
    return { ...result, stopped: err.kind === 'auth' ? 'auth' : 'retry', error: err.message };
  }

  const blocked = new Set(entries.filter((e) => e.status === 'failed').map((e) => `${e.tbl}:${e.row_id}`));

  for (const entry of entries) {
    if (entry.status === 'failed') continue;
    const keys = parentKeys(entry);
    if (keys.some((k) => blocked.has(k))) {
      blocked.add(keys[0]); // its own children wait too
      result.skipped++;
      continue;
    }

    await local.markInflight(entry.op_id);
    try {
      const outcome = await pushOne(transport, local, entry);
      result.pushed++;
      if (outcome === 'conflict') result.conflicts.push({ table: entry.tbl, id: entry.row_id, at: now().toISOString() });
    } catch (e) {
      const err = classifyError(e);
      if (err.kind !== 'permanent') {
        await local.release(entry.op_id);
        return { ...result, stopped: err.kind, error: err.message };
      }
      const attempts = entry.attempts + 1;
      await local.recordFailure(entry.op_id, attempts, err.message, attempts >= maxAttempts);
      blocked.add(keys[0]);
      result.failedNow++;
    }
  }
  return result;
}

async function pushOne(transport: SyncTransport, local: SyncLocal, entry: OutboxEntry): Promise<'done' | 'conflict' | 'deleted'> {
  const payload = (entry.payload ?? {}) as Record<string, unknown>;
  let row: ServerRow | null;

  if (entry.kind === 'create') {
    row = await transport.insertIgnore(entry.tbl, { ...omit(payload, SERVER_OWNED), id: entry.row_id, last_op_id: entry.op_id });
  } else {
    const patch =
      entry.kind === 'delete'
        ? { deleted_at: payload.deleted_at ?? new Date().toISOString(), last_op_id: entry.op_id }
        : { ...omit(payload, NOT_UPDATABLE), last_op_id: entry.op_id };
    row = await transport.casUpdate(entry.tbl, entry.row_id, entry.base_version, patch);
  }
  if (row) {
    await local.complete(entry, row);
    return 'done';
  }

  // 0 rows: find out why.
  const server = await transport.fetchRow(entry.tbl, entry.row_id);
  if (!server) throw new SyncError('permanent', `${entry.tbl} ${entry.row_id} not found on server`, 'not_found', 404);
  if (server.last_op_id === entry.op_id) {
    await local.complete(entry, server);
    return 'done';
  }
  await local.acceptServer(entry, server);
  return server.deleted_at ? 'deleted' : 'conflict';
}

const after = (a: SyncCursor, b: SyncCursor) => a.updated_at > b.updated_at || (a.updated_at === b.updated_at && a.id > b.id);

export type PullResult = { applied: number; pruned: number; fullTables: SyncTable[] };

export async function pull({ transport, local, now = () => new Date() }: SyncDeps, pageSize = PULL_PAGE): Promise<PullResult> {
  const result: PullResult = { applied: 0, pruned: 0, fullTables: [] };
  for (const table of SYNC_TABLES) {
    let cursor = await local.getCursor(table);
    if (cursor && now().getTime() - Date.parse(cursor.updated_at) > TOMBSTONE_HORIZON_MS) {
      cursor = null;
      await local.setCursor(table, null);
    }
    const full = !cursor;
    if (full) result.fullTables.push(table);
    const since = cursor ? new Date(Date.parse(cursor.updated_at) - PULL_OVERLAP_MS).toISOString() : undefined;

    const seen = new Set<string>();
    let keyset: SyncCursor | undefined;
    for (;;) {
      const rows = await transport.pullPage({ table, since: keyset ? undefined : since, after: keyset, limit: pageSize });
      for (const r of rows) {
        seen.add(r.id);
        const c = { updated_at: r.updated_at, id: r.id };
        if (!cursor || after(c, cursor)) cursor = c;
      }
      result.applied += await local.applyPulled(table, rows, cursor);
      if (rows.length < pageSize) break;
      const last = rows[rows.length - 1];
      keyset = { updated_at: last.updated_at, id: last.id };
    }
    if (full) result.pruned += await local.prune(table, seen);
  }
  return result;
}
