/**
 * Local side of sync (pure TS, works over any Store). Each method is one transaction.
 */
import type { OutboxEntry, Row, Store, SyncCursor } from '@/db/store';
import type { SyncTable } from '@/db/types';

import type { ServerRow } from './transport';

const toLocal = (r: ServerRow): Row => ({ ...r }) as Row;

export type SyncLocal = ReturnType<typeof createSyncLocal>;

export function createSyncLocal(store: Store, userId: string) {
  const sameRow = (a: OutboxEntry, tbl: SyncTable, id: string) => a.tbl === tbl && a.row_id === id;

  return {
    /** Entries left 'inflight' by a crash go back to pending (lost responses are caught by last_op_id). */
    resetInflight: () =>
      store.transaction(async (tx) => {
        for (const e of await tx.listOutbox()) if (e.status === 'inflight') await tx.updateOutbox(e.op_id, { status: 'pending' });
      }),

    outbox: () => store.transaction((tx) => tx.listOutbox()),

    markInflight: (opId: string) => store.transaction((tx) => tx.updateOutbox(opId, { status: 'inflight' })),

    /** Retryable error: back to pending, attempts unchanged. */
    release: (opId: string) => store.transaction((tx) => tx.updateOutbox(opId, { status: 'pending' })),

    recordFailure: (opId: string, attempts: number, message: string, failed: boolean) =>
      store.transaction((tx) => tx.updateOutbox(opId, { attempts, last_error: message, status: failed ? 'failed' : 'pending' })),

    /**
     * The server accepted this op. Later local edits to the row (queued while it was
     * in flight) are rebased onto the new server version; otherwise the server copy is stored.
     */
    complete: (entry: OutboxEntry, server: ServerRow) =>
      store.transaction(async (tx) => {
        await tx.deleteOutbox([entry.op_id]);
        const later = (await tx.listOutbox()).filter((e) => sameRow(e, entry.tbl, entry.row_id));
        for (const e of later) await tx.updateOutbox(e.op_id, { base_version: server.version });
        const local = await tx.getRow(entry.tbl, entry.row_id);
        if (later.length > 0 && local) await tx.putRow(entry.tbl, { ...local, version: server.version });
        else await tx.putRow(entry.tbl, toLocal(server));
      }),

    /** Server copy wins (conflict, or the row was deleted elsewhere): drop local ops for the row. */
    acceptServer: (entry: OutboxEntry, server: ServerRow) =>
      store.transaction(async (tx) => {
        const ids = (await tx.listOutbox()).filter((e) => sameRow(e, entry.tbl, entry.row_id) && e.status !== 'failed').map((e) => e.op_id);
        await tx.deleteOutbox([entry.op_id, ...ids]);
        await tx.putRow(entry.tbl, toLocal(server));
      }),

    /**
     * Apply pulled rows and move the cursor, in one transaction. A row with a local
     * outbox entry is left alone (the push decides); otherwise it's applied when
     * server.version >= local.version.
     */
    applyPulled: (table: SyncTable, rows: ServerRow[], cursor: SyncCursor | null) =>
      store.transaction(async (tx) => {
        const protectedIds = new Set((await tx.listOutbox()).filter((e) => e.tbl === table).map((e) => e.row_id));
        let applied = 0;
        for (const r of rows) {
          if (protectedIds.has(r.id)) continue;
          const local = await tx.getRow(table, r.id);
          if (!local || r.version >= Number(local.version ?? 0)) {
            await tx.putRow(table, toLocal(r));
            applied++;
          }
        }
        await tx.setCursor(table, cursor);
        return applied;
      }),

    getCursor: (table: SyncTable) => store.transaction((tx) => tx.getCursor(table)),
    setCursor: (table: SyncTable, cursor: SyncCursor | null) => store.transaction((tx) => tx.setCursor(table, cursor)),

    /** After a full download: remove synced local rows the server no longer has. */
    prune: (table: SyncTable, seen: Set<string>) =>
      store.transaction(async (tx) => {
        const protectedIds = new Set((await tx.listOutbox()).filter((e) => e.tbl === table).map((e) => e.row_id));
        let removed = 0;
        for (const r of await tx.listRows(table, { user_id: userId })) {
          if (seen.has(r.id) || protectedIds.has(r.id) || Number(r.version ?? 0) === 0) continue;
          await tx.deleteRow(table, r.id);
          removed++;
        }
        return removed;
      }),

    stats: () =>
      store.transaction(async (tx) => {
        const all = await tx.listOutbox();
        return { pending: all.filter((e) => e.status !== 'failed').length, failed: all.filter((e) => e.status === 'failed') };
      }),

    /**
     * Throw away failed ops. A failed create's row only exists here, so it's deleted;
     * for other rows the table cursor is cleared so the next pull restores the server copy.
     */
    discardFailed: () =>
      store.transaction(async (tx) => {
        const failed = (await tx.listOutbox()).filter((e) => e.status === 'failed');
        await tx.deleteOutbox(failed.map((e) => e.op_id));
        const tables = new Set<SyncTable>();
        for (const e of failed) {
          const row = await tx.getRow(e.tbl, e.row_id);
          if (e.kind === 'create' && row && Number(row.version ?? 0) === 0) await tx.deleteRow(e.tbl, e.row_id);
          else tables.add(e.tbl);
        }
        for (const t of tables) await tx.setCursor(t, null);
        return failed.length;
      }),
  };
}
