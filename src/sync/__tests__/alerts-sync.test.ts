import { createMemoryAlerts, type ServerAlert } from '@/db/alerts-local';
import { DEFAULT_NOTIFICATION_PREFS, normalizePrefs } from '@/engine/alert-prefs';

import { pickLocalNotifications, syncAlerts, type AlertsTransport } from '../alerts-sync';

const alert = (id: string, updated_at: string, extra: Partial<ServerAlert> = {}): ServerAlert => ({
  id,
  farm_id: 'f',
  crop_id: null,
  kind: 'frost',
  severity: 'warning',
  title: 't',
  body: 'b',
  start_date: '2026-11-21',
  created_at: updated_at,
  updated_at,
  pushed_at: null,
  read_at: null,
  ...extra,
});

function fakeServer(rows: ServerAlert[]) {
  const reads: string[] = [];
  const t: AlertsTransport = {
    pull: async (after, limit) =>
      rows
        .filter((r) => !after || r.updated_at > after.updated_at || (r.updated_at === after.updated_at && r.id > after.id))
        .sort((a, b) => a.updated_at.localeCompare(b.updated_at) || a.id.localeCompare(b.id))
        .slice(0, limit),
    markRead: async (ids) => {
      reads.push(...ids);
      rows = rows.map((r) => (ids.includes(r.id) ? { ...r, read_at: r.read_at ?? '2026-11-20T10:00:00Z', updated_at: '2026-11-20T10:00:00Z' } : r));
    },
  };
  return { t, reads };
}

describe('alerts sync', () => {
  it('pulls by keyset, keeps the cursor, reports new rows once', async () => {
    const { t } = fakeServer([alert('a', '2026-11-20T01:00:00Z'), alert('b', '2026-11-20T01:00:00Z'), alert('c', '2026-11-20T02:00:00Z')]);
    const local = createMemoryAlerts();
    const first = await syncAlerts(t, local);
    expect(first.fresh.map((r) => r.id)).toEqual(['a', 'b', 'c']);
    expect(await local.getCursor()).toEqual({ updated_at: '2026-11-20T02:00:00Z', id: 'c' });
    expect((await syncAlerts(t, local)).fresh).toEqual([]);
  });

  it('read on the phone (offline) is kept, then sent on the next sync', async () => {
    const { t, reads } = fakeServer([alert('a', '2026-11-20T01:00:00Z')]);
    const local = createMemoryAlerts();
    await syncAlerts(t, local);
    await local.markRead(['a'], '2026-11-20T09:00:00Z');
    expect(await local.unreadCount()).toBe(0);
    await syncAlerts(t, local);
    expect(reads).toEqual(['a']);
    expect(await local.dirtyReads()).toEqual([]);
    expect((await local.list())[0].read_at).toBe('2026-11-20T10:00:00Z'); // server's read time wins once synced
  });

  it('a server update without read_at does not undo a pending local read', async () => {
    const local = createMemoryAlerts();
    await local.upsert([alert('a', '2026-11-20T01:00:00Z')]);
    await local.markRead(['a'], '2026-11-20T09:00:00Z');
    await local.upsert([alert('a', '2026-11-20T03:00:00Z', { title: 'changed' })]);
    expect((await local.list())[0]).toMatchObject({ title: 'changed', read_at: '2026-11-20T09:00:00Z', read_dirty: true });
  });

  it('local notifications: unread, not pushed, not shown, current, kind on, outside quiet hours', async () => {
    const local = createMemoryAlerts();
    await local.upsert([
      alert('new', '1'),
      alert('pushed', '1', { pushed_at: 'x' }),
      alert('read', '1', { read_at: 'x' }),
      alert('old', '1', { start_date: '2026-11-19' }),
      alert('fog', '1', { kind: 'fog' }),
    ]);
    await local.markNotified([], 'x');
    const all = await local.list();
    const prefs = normalizePrefs({ kinds: { fog: false } });
    expect(pickLocalNotifications(all, prefs, '10:00', '2026-11-20').map((a) => a.id)).toEqual(['new']);
    expect(pickLocalNotifications(all, DEFAULT_NOTIFICATION_PREFS, '23:00', '2026-11-20')).toEqual([]); // quiet hours
    await local.markNotified(['new'], 'x');
    expect(pickLocalNotifications(await local.list(), prefs, '10:00', '2026-11-20')).toEqual([]);
  });
});
