import type { SyncTable } from '@/db/types';

import type { PullQuery, ServerRow, SyncTransport } from '../transport';

type Fault = { method: keyof SyncTransport; error: unknown; afterApply?: boolean };

/** In-memory stand-in for Supabase that follows the migration's trigger rules. */
export function createFakeServer(userId: string, start = Date.parse('2026-11-20T08:00:00Z')) {
  const tables: Record<SyncTable, Map<string, ServerRow>> = { farms: new Map(), crops: new Map(), activities: new Map() };
  let clock = start;
  const tick = () => new Date((clock += 1000)).toISOString();
  const faults: Fault[] = [];
  const calls: string[] = [];

  async function maybeFail(method: keyof SyncTransport, apply: () => unknown) {
    calls.push(method);
    const i = faults.findIndex((f) => f.method === method);
    const fault = i >= 0 ? faults.splice(i, 1)[0] : null;
    if (fault && !fault.afterApply) throw fault.error;
    const result = apply();
    if (fault) throw fault.error; // applied on the server, but the response was lost
    return result;
  }

  const transport: SyncTransport = {
    ensureSession: async () => {
      await maybeFail('ensureSession', () => undefined);
    },
    insertIgnore: (table, payload) =>
      maybeFail('insertIgnore', () => {
        const id = String(payload.id);
        if (tables[table].has(id)) return null;
        const ts = tick();
        const row = { ...payload, user_id: userId, version: 1, created_at: payload.created_at ?? ts, updated_at: ts } as unknown as ServerRow;
        tables[table].set(id, row);
        return { ...row };
      }) as Promise<ServerRow | null>,
    casUpdate: (table, id, base, patch) =>
      maybeFail('casUpdate', () => {
        const cur = tables[table].get(id);
        if (!cur || cur.version !== base) return null;
        const row = { ...cur, ...patch, version: cur.version + 1, updated_at: tick(), deleted_at: cur.deleted_at ?? (patch.deleted_at as string | null) ?? null } as ServerRow;
        tables[table].set(id, row);
        return { ...row };
      }) as Promise<ServerRow | null>,
    fetchRow: (table, id) => maybeFail('fetchRow', () => (tables[table].get(id) ? { ...tables[table].get(id)! } : null)) as Promise<ServerRow | null>,
    pullPage: (q: PullQuery) =>
      maybeFail('pullPage', () =>
        [...tables[q.table].values()]
          .filter((r) => !q.since || r.updated_at >= q.since)
          .filter((r) => !q.after || r.updated_at > q.after.updated_at || (r.updated_at === q.after.updated_at && r.id > q.after.id))
          .sort((a, b) => (a.updated_at === b.updated_at ? a.id.localeCompare(b.id) : a.updated_at.localeCompare(b.updated_at)))
          .slice(0, q.limit)
          .map((r) => ({ ...r })),
      ) as Promise<ServerRow[]>,
  };

  return {
    transport,
    tables,
    calls,
    tick,
    fail: (method: keyof SyncTransport, error: unknown, afterApply = false) => faults.push({ method, error, afterApply }),
    /** Another device edits a row. */
    remoteEdit: (table: SyncTable, id: string, patch: Record<string, unknown>) => {
      const cur = tables[table].get(id)!;
      tables[table].set(id, { ...cur, ...patch, version: cur.version + 1, updated_at: tick(), last_op_id: 'other-device' });
    },
    put: (table: SyncTable, row: ServerRow) => tables[table].set(row.id, row),
  };
}
