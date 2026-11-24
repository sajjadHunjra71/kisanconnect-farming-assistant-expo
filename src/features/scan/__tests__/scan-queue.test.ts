/**
 * Scan queue: upload → photo_path → push → ai-diagnose → pull, one at a time;
 * waiting (202) stops the queue; consent gate; 409 re-uploads; failures count.
 */
jest.mock('expo-notifications', () => ({ getPermissionsAsync: async () => ({ status: 'denied' }), scheduleNotificationAsync: jest.fn() }));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'id' }));
jest.mock('../photo', () => ({
  localScanPhoto: (_o: string, id: string) => ({ exists: id !== 'nofile', uri: `file:///scans/${id}.jpg`, bytes: async () => new Uint8Array([0xff, 0xd8, 0xff]) }),
  deleteLocalScanPhoto: jest.fn(),
}));

import { createMemoryScanQueue } from '@/db/scan-queue';
import type { Repos, ScanRecord } from '@/db/types';

import { runScanQueue, safeCreateScan } from '../scan-service';

const U = '11111111-1111-4111-8111-111111111111';
const S1 = '22222222-2222-4222-8222-222222222222';
const S2 = '33333333-3333-4333-8333-333333333333';

function setup(rows: Partial<ScanRecord>[], invoke: (id: string) => { data?: unknown; error?: unknown }) {
  const scans = new Map(rows.map((r) => [r.id!, { version: 1, checked_at: null, photo_path: null, ...r } as ScanRecord]));
  const queue = createMemoryScanQueue(
    rows.map((r, i) => ({ scan_id: r.id!, local_path: 'x', uploaded: false, check_state: 'pending_upload' as const, attempts: 0, last_error: null, notified: false, created_at: `2026-11-24T0${i}:00:00Z` })),
  );
  const calls: string[] = [];
  const repos = {
    scanQueue: queue,
    scansRepo: {
      get: async (id: string) => scans.get(id) ?? null,
      update: async (id: string, patch: Partial<ScanRecord>) => {
        calls.push(`update:${id}:${JSON.stringify(patch)}`);
        scans.set(id, { ...scans.get(id)!, ...patch });
        return scans.get(id)!;
      },
    },
  } as unknown as Repos;
  const supabase = {
    storage: { from: () => ({ upload: async (path: string) => (calls.push(`upload:${path}`), { error: path.includes(S2) ? { message: 'The resource already exists' } : null }) }) },
    functions: {
      invoke: async (_n: string, o: { body: { scan_id: string } }) => {
        calls.push(`diagnose:${o.body.scan_id}`);
        const r = invoke(o.body.scan_id);
        if (!r.error) scans.set(o.body.scan_id, { ...scans.get(o.body.scan_id)!, checked_at: (r.data as { status?: string })?.status === 'checked' ? 'now' : null });
        return r;
      },
    },
  } as never;
  const deps = { repos, userId: U, supabase, consentOk: true, push: async () => calls.push('push'), pull: async () => calls.push('pull') };
  return { deps, calls, queue, scans };
}

describe('scan queue', () => {
  it('uploads, sets photo_path, pushes, checks, pulls — in that order, one scan at a time', async () => {
    const { deps, calls, queue } = setup([{ id: S1 }, { id: S2 }], () => ({ data: { status: 'checked' } }));
    expect(await runScanQueue(deps)).toBe(2);
    expect(calls).toEqual([
      `upload:${U}/${S1}.jpg`,
      `update:${S1}:{"photo_path":"${U}/${S1}.jpg"}`,
      'push',
      `diagnose:${S1}`,
      'pull',
      `upload:${U}/${S2}.jpg`, // "already exists" counts as uploaded
      `update:${S2}:{"photo_path":"${U}/${S2}.jpg"}`,
      'push',
      `diagnose:${S2}`,
      'pull',
    ]);
    expect((await queue.get(S1))?.check_state).toBe('checked');
  });

  it('waiting (no quota / Gemini busy) stops the queue; the scan stays waiting', async () => {
    const { deps, calls, queue } = setup([{ id: S1 }, { id: S2 }], () => ({ data: { status: 'waiting', reason: 'budget' } }));
    expect(await runScanQueue(deps)).toBe(0);
    expect(calls.filter((c) => c.startsWith('diagnose'))).toEqual([`diagnose:${S1}`]);
    expect(await queue.get(S1)).toMatchObject({ check_state: 'waiting_check', uploaded: true, last_error: 'budget' });
    expect((await queue.get(S2))?.check_state).toBe('pending_upload');
  });

  it('nothing leaves the phone without consent; rows not yet on the server are skipped', async () => {
    const a = setup([{ id: S1 }], () => ({ data: { status: 'checked' } }));
    await runScanQueue({ ...a.deps, consentOk: false });
    expect(a.calls).toEqual([]);
    const b = setup([{ id: S1, version: 0 }], () => ({ data: { status: 'checked' } }));
    await runScanQueue(b.deps);
    expect(b.calls).toEqual([]);
  });

  it('409 photo_missing → upload again next time; 4xx failures count up to failed', async () => {
    const a = setup([{ id: S1 }], () => ({ error: { context: { status: 409 } } }));
    await runScanQueue(a.deps);
    expect(await a.queue.get(S1)).toMatchObject({ uploaded: false, check_state: 'pending_upload' });

    const b = setup([{ id: S1 }], () => ({ error: { context: { status: 400 } } }));
    for (let i = 0; i < 3; i++) {
      await b.queue.update(S1, { check_state: 'waiting_check' });
      await runScanQueue(b.deps);
    }
    expect(await b.queue.get(S1)).toMatchObject({ check_state: 'failed', attempts: 3 });
  });

  it('server errors / offline stop without counting', async () => {
    const { deps, queue } = setup([{ id: S1 }], () => ({ error: { context: { status: 503 } } }));
    await runScanQueue(deps);
    expect(await queue.get(S1)).toMatchObject({ attempts: 0, check_state: 'waiting_check' });
  });
});

describe('safeCreateScan', () => {
  it('returns an error instead of throwing when the local save fails (screen shows Try again)', async () => {
    const queue = createMemoryScanQueue([]);
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const repos = {
      kind: 'local',
      scanQueue: queue,
      scansRepo: {
        create: async () => {
          throw new Error("Error code 19: CHECK constraint failed: tbl in ('farms', 'crops', 'activities')");
        },
      },
    } as unknown as Repos;
    const res = await safeCreateScan({
      repos,
      owner: U,
      tempId: 'temp',
      photoUri: 'file:///scans/temp.jpg',
      farmId: null,
      cropId: null,
      cropKey: 'wheat',
      quality: { blurVariance: 0, brightness: 0, leafRatio: 0, blocks: [], warnings: [] },
      cloudAllowed: true,
    });
    expect(res).toEqual({ error: expect.stringContaining('CHECK constraint failed') });
    expect(await queue.list()).toEqual([]);
    warn.mockRestore();
  });
});

describe('Try again on a failed check', () => {
  it('runs ai-diagnose again for a failed scan put back to waiting_check, and keeps a 202 reason', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const { deps, calls, queue } = setup([{ id: S1, checked_at: 'earlier', final_status: 'failed', photo_path: `${U}/${S1}.jpg` }], () => ({
      data: { status: 'waiting', reason: 'ai_unavailable', detail: 'http_403:PERMISSION_DENIED' },
    }));
    await queue.update(S1, { uploaded: true, check_state: 'waiting_check' });
    expect(await runScanQueue(deps)).toBe(0);
    expect(calls).toEqual([`diagnose:${S1}`]);
    expect(await queue.get(S1)).toMatchObject({ check_state: 'waiting_check', last_error: 'ai_unavailable http_403:PERMISSION_DENIED' });
    log.mockRestore();
  });

  it('does not re-run a good result', async () => {
    const { deps, calls, queue } = setup([{ id: S1, checked_at: 'earlier', final_status: 'likely' }], () => ({ data: { status: 'checked' } }));
    await queue.update(S1, { uploaded: true, check_state: 'waiting_check' });
    await runScanQueue(deps);
    expect(calls).toEqual([]);
    expect((await queue.get(S1))?.check_state).toBe('checked');
  });
});
