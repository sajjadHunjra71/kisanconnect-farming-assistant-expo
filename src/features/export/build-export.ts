/**
 * "Export my data" (pure). Live rows only (soft-deleted rows are left out);
 * sync bookkeeping (version, last_op_id) is dropped.
 */
import type { ActivityRecord, CropRecord, FarmRecord } from '@/db/types';

export type ExportProfile = {
  email: string | null;
  full_name: string | null;
  district: string | null;
  language: string | null;
  units: string | null;
};

export type DataExport = {
  exportedAt: string;
  profile: ExportProfile;
  farms: Record<string, unknown>[];
  crops: Record<string, unknown>[];
  activities: Record<string, unknown>[];
};

const INTERNAL = ['version', 'last_op_id', 'deleted_at', 'user_id'];

function clean<T extends { deleted_at: string | null }>(rows: T[], order: (a: T, b: T) => number) {
  return rows
    .filter((r) => !r.deleted_at)
    .sort(order)
    .map((r) => {
      const out: Record<string, unknown> = { ...r };
      for (const k of INTERNAL) delete out[k];
      return out;
    });
}

export function buildExport(input: {
  profile: ExportProfile;
  farms: FarmRecord[];
  crops: CropRecord[];
  activities: ActivityRecord[];
  now?: Date;
}): DataExport {
  const live = new Set(input.farms.filter((f) => !f.deleted_at).map((f) => f.id));
  return {
    exportedAt: (input.now ?? new Date()).toISOString(),
    profile: input.profile,
    farms: clean(input.farms, (a, b) => a.created_at.localeCompare(b.created_at)),
    crops: clean(
      input.crops.filter((c) => live.has(c.farm_id)),
      (a, b) => a.sowing_date.localeCompare(b.sowing_date),
    ),
    activities: clean(
      input.activities.filter((a) => live.has(a.farm_id)),
      (a, b) => a.done_on.localeCompare(b.done_on) || a.created_at.localeCompare(b.created_at),
    ),
  };
}

export function exportFileName(now = new Date()): string {
  return `kisanconnect-export-${now.toISOString().slice(0, 10)}.json`;
}
