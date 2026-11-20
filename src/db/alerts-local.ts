/**
 * Weather alerts kept on the phone (inbox). Server rows are pulled by (updated_at, id);
 * "mark read" is saved locally first (read_dirty) and pushed on the next sync.
 */
import type { SyncCursor } from './store';

export type AlertRecord = {
  id: string;
  farm_id: string;
  crop_id: string | null;
  kind: string;
  severity: 'warning' | 'danger';
  title: string;
  body: string;
  start_date: string;
  created_at: string;
  updated_at: string;
  pushed_at: string | null;
  read_at: string | null;
  /** Local only: read on this phone, not sent to the server yet. */
  read_dirty: boolean;
  /** Local only: shown as a local notification on this phone. */
  notified_at: string | null;
};

export type ServerAlert = Omit<AlertRecord, 'read_dirty' | 'notified_at'>;

export interface AlertsLocal {
  list(): Promise<AlertRecord[]>;
  unreadCount(): Promise<number>;
  /** Insert/update from the server; a pending local read is kept. Returns rows that are new here. */
  upsert(rows: ServerAlert[]): Promise<AlertRecord[]>;
  markRead(ids: string[], at: string): Promise<void>;
  dirtyReads(): Promise<string[]>;
  clearDirty(ids: string[]): Promise<void>;
  markNotified(ids: string[], at: string): Promise<void>;
  getCursor(): Promise<SyncCursor | null>;
  setCursor(c: SyncCursor | null): Promise<void>;
}

/** Merge a server row into the local copy (pure). */
export function mergeAlert(local: AlertRecord | undefined, server: ServerAlert): AlertRecord {
  const dirty = !!local?.read_dirty && !server.read_at;
  return {
    ...server,
    read_at: server.read_at ?? local?.read_at ?? null,
    read_dirty: dirty,
    notified_at: local?.notified_at ?? null,
  };
}

const byNewest = (a: AlertRecord, b: AlertRecord) => b.start_date.localeCompare(a.start_date) || b.created_at.localeCompare(a.created_at);

/** In-memory version: demo mode / web and tests. */
export function createMemoryAlerts(seed: AlertRecord[] = []): AlertsLocal {
  const rows = new Map(seed.map((r) => [r.id, { ...r }]));
  let cursor: SyncCursor | null = null;
  return {
    list: async () => [...rows.values()].sort(byNewest).map((r) => ({ ...r })),
    unreadCount: async () => [...rows.values()].filter((r) => !r.read_at).length,
    upsert: async (server) => {
      const fresh: AlertRecord[] = [];
      for (const s of server) {
        const prev = rows.get(s.id);
        const merged = mergeAlert(prev, s);
        if (!prev) fresh.push(merged);
        rows.set(s.id, merged);
      }
      return fresh;
    },
    markRead: async (ids, at) => {
      for (const id of ids) {
        const r = rows.get(id);
        if (r && !r.read_at) rows.set(id, { ...r, read_at: at, read_dirty: true });
      }
    },
    dirtyReads: async () => [...rows.values()].filter((r) => r.read_dirty).map((r) => r.id),
    clearDirty: async (ids) => {
      for (const id of ids) {
        const r = rows.get(id);
        if (r) rows.set(id, { ...r, read_dirty: false });
      }
    },
    markNotified: async (ids, at) => {
      for (const id of ids) {
        const r = rows.get(id);
        if (r) rows.set(id, { ...r, notified_at: at });
      }
    },
    getCursor: async () => cursor,
    setCursor: async (c) => {
      cursor = c;
    },
  };
}
