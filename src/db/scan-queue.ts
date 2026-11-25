/**
 * Local-only state of each scan on this phone (not synced): where its photo is, whether
 * the photo is uploaded, and where the cloud check stands.
 *
 *   pending_upload – saved on the phone, photo not uploaded yet
 *   waiting_check  – uploaded, waiting for the online check (offline, no quota, AI busy)
 *   checked        – result received
 *   failed         – the check failed after retries ("try again / ask an expert")
 *   device_only    – no consent / not signed in: no cloud check
 */
export type ScanCheckState = 'pending_upload' | 'waiting_check' | 'checked' | 'failed' | 'device_only';

export type ScanLocalState = {
  scan_id: string;
  local_path: string;
  uploaded: boolean;
  check_state: ScanCheckState;
  attempts: number;
  last_error: string | null;
  notified: boolean;
  created_at: string;
};

export interface ScanQueue {
  get(scanId: string): Promise<ScanLocalState | null>;
  list(): Promise<ScanLocalState[]>;
  put(state: ScanLocalState): Promise<void>;
  update(scanId: string, patch: Partial<Omit<ScanLocalState, 'scan_id'>>): Promise<void>;
  remove(scanId: string): Promise<void>;
}

export function createMemoryScanQueue(seed: ScanLocalState[] = []): ScanQueue {
  const rows = new Map(seed.map((s) => [s.scan_id, { ...s }]));
  return {
    get: async (id) => (rows.has(id) ? { ...rows.get(id)! } : null),
    list: async () => [...rows.values()].sort((a, b) => a.created_at.localeCompare(b.created_at)).map((r) => ({ ...r })),
    put: async (s) => {
      rows.set(s.scan_id, { ...s });
    },
    update: async (id, patch) => {
      const r = rows.get(id);
      if (r) rows.set(id, { ...r, ...patch });
    },
    remove: async (id) => {
      rows.delete(id);
    },
  };
}
