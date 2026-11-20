/**
 * Alerts inbox sync (pure; Supabase behind AlertsTransport). First send local "read"
 * marks, then pull new/changed alerts by (updated_at, id).
 */
import type { AlertRecord, AlertsLocal, ServerAlert } from '@/db/alerts-local';
import type { SyncCursor } from '@/db/store';
import { inQuietHours, shouldNotify, type NotificationPrefs } from '@/engine/alert-prefs';

export const ALERTS_PAGE = 200;

export interface AlertsTransport {
  pull(after: SyncCursor | null, limit: number): Promise<ServerAlert[]>;
  /** Server sets read_at = coalesce(read_at, now()). */
  markRead(ids: string[]): Promise<void>;
}

export async function syncAlerts(transport: AlertsTransport, local: AlertsLocal): Promise<{ pulled: number; fresh: AlertRecord[] }> {
  const dirty = await local.dirtyReads();
  if (dirty.length) {
    await transport.markRead(dirty);
    await local.clearDirty(dirty);
  }
  let cursor = await local.getCursor();
  let pulled = 0;
  const fresh: AlertRecord[] = [];
  for (;;) {
    const rows = await transport.pull(cursor, ALERTS_PAGE);
    if (rows.length === 0) break;
    fresh.push(...(await local.upsert(rows)));
    pulled += rows.length;
    const last = rows[rows.length - 1];
    cursor = { updated_at: last.updated_at, id: last.id };
    await local.setCursor(cursor);
    if (rows.length < ALERTS_PAGE) break;
  }
  return { pulled, fresh };
}

/**
 * Which alerts to show as a LOCAL notification on this phone: unread, not pushed by the
 * server (e.g. no push token, simulator), not shown before, still current, kind switched
 * on and not in quiet hours (held ones are picked up on a later sync).
 */
export function pickLocalNotifications(alerts: AlertRecord[], prefs: NotificationPrefs, localHHMM: string, today: string): AlertRecord[] {
  if (inQuietHours(localHHMM, prefs.quiet_hours)) return [];
  return alerts.filter((a) => !a.read_at && !a.pushed_at && !a.notified_at && a.start_date >= today && shouldNotify(a.kind, prefs, localHHMM) === 'send');
}
