import { createMemoryStore } from '@/db/memory-store';
import { createRepos } from '@/db/repo-core';

import { classifyError } from '../errors';
import { pull, push } from '../engine';
import { createSyncLocal } from '../local';
import type { ServerRow } from '../transport';
import { createFakeServer } from './fake-server';

const USER = '11111111-1111-4111-8111-111111111111';
const farmInput = { name: 'Home', area_value: 5, area_unit: 'acre' as const };
const NET = new TypeError('Network request failed');
const CHECK = { status: 400, code: '23514', message: 'violates check constraint' };

function setup(maxAttempts = 5) {
  let n = 0;
  const store = createMemoryStore();
  const repos = createRepos(store, { userId: USER, newId: () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}` });
  const server = createFakeServer(USER);
  const local = createSyncLocal(store, USER);
  const deps = { transport: server.transport, local, maxAttempts, now: () => new Date('2026-11-20T09:00:00Z') };
  return { store, server, local, deps, ...repos };
}

describe('classifyError', () => {
  it.each([
    [NET, 'retry'],
    [{ status: 0, message: 'offline' }, 'retry'],
    [{ status: 503, message: 'paused' }, 'retry'],
    [{ status: 500, message: 'x' }, 'retry'],
    [{ status: 429, message: 'slow down' }, 'retry'],
    [{ status: 401, message: 'jwt expired' }, 'auth'],
    [CHECK, 'permanent'],
    [{ status: 403, code: '42501', message: 'rls' }, 'permanent'],
    [{ status: 409, code: '23503', message: 'fk' }, 'permanent'],
    [{ status: 404, message: 'nope' }, 'permanent'],
  ])('%j → %s', (e, kind) => expect(classifyError(e).kind).toBe(kind));
});

describe('push', () => {
  it('sends a coalesced create once and stores the server copy', async () => {
    const { store, server, deps, farmsRepo } = setup();
    const farm = await farmsRepo.create(farmInput);
    await farmsRepo.update(farm.id, { name: 'Renamed' });
    const r = await push(deps);
    expect(r).toMatchObject({ pushed: 1, stopped: null });
    expect(server.calls.filter((c) => c === 'insertIgnore')).toHaveLength(1);
    expect(server.tables.farms.get(farm.id)).toMatchObject({ name: 'Renamed', version: 1 });
    expect(server.tables.farms.get(farm.id)).not.toHaveProperty('area_acres');
    const s = store.snapshot();
    expect(s.outbox).toEqual([]);
    expect(s.tables.farms[farm.id].version).toBe(1);
  });

  it('CAS conflict: server copy wins and a note is recorded', async () => {
    const { store, server, deps, farmsRepo } = setup();
    const farm = await farmsRepo.create(farmInput);
    await push(deps);
    server.remoteEdit('farms', farm.id, { name: 'From phone 2' });
    await farmsRepo.update(farm.id, { name: 'From phone 1' });
    const r = await push(deps);
    expect(r.conflicts).toEqual([{ table: 'farms', id: farm.id, at: '2026-11-20T09:00:00.000Z' }]);
    const s = store.snapshot();
    expect(s.tables.farms[farm.id]).toMatchObject({ name: 'From phone 2', version: 2 });
    expect(s.outbox).toEqual([]);
  });

  it('lost response on update: next push sees last_op_id and finishes without conflict', async () => {
    const { store, server, deps, farmsRepo } = setup();
    const farm = await farmsRepo.create(farmInput);
    await push(deps);
    await farmsRepo.update(farm.id, { name: 'B' });
    server.fail('casUpdate', NET, true);
    const first = await push(deps);
    expect(first.stopped).toBe('retry');
    expect(store.snapshot().outbox[0]).toMatchObject({ status: 'pending', attempts: 0 });
    const second = await push(deps);
    expect(second).toMatchObject({ pushed: 1, conflicts: [] });
    expect(store.snapshot().outbox).toEqual([]);
    expect(store.snapshot().tables.farms[farm.id]).toMatchObject({ name: 'B', version: 2 });
  });

  it('lost response on create: duplicate insert is recognised as mine', async () => {
    const { store, server, deps, farmsRepo } = setup();
    await farmsRepo.create(farmInput);
    server.fail('insertIgnore', NET, true);
    expect((await push(deps)).stopped).toBe('retry');
    expect(await push(deps)).toMatchObject({ pushed: 1, conflicts: [] });
    expect(store.snapshot().outbox).toEqual([]);
  });

  it('retryable errors keep attempts; permanent ones count up to failed', async () => {
    const { store, server, deps, farmsRepo } = setup(2);
    await farmsRepo.create(farmInput);
    server.fail('insertIgnore', { status: 503, message: 'paused' });
    expect((await push(deps)).stopped).toBe('retry');
    expect(store.snapshot().outbox[0]).toMatchObject({ attempts: 0, status: 'pending' });

    server.fail('insertIgnore', CHECK);
    expect((await push(deps)).failedNow).toBe(1);
    expect(store.snapshot().outbox[0]).toMatchObject({ attempts: 1, status: 'pending' });
    server.fail('insertIgnore', CHECK);
    await push(deps);
    expect(store.snapshot().outbox[0]).toMatchObject({ attempts: 2, status: 'failed', last_error: 'violates check constraint' });
  });

  it('auth errors stop the push without counting', async () => {
    const { store, server, deps, farmsRepo } = setup();
    await farmsRepo.create(farmInput);
    server.fail('ensureSession', { status: 401, message: 'no session' });
    expect((await push(deps)).stopped).toBe('auth');
    expect(store.snapshot().outbox[0]).toMatchObject({ attempts: 0, status: 'pending' });
  });

  it('a failed farm blocks its crops and activities without failing them', async () => {
    const { store, server, deps, farmsRepo, cropsRepo, activitiesRepo } = setup(1);
    const other = await farmsRepo.create({ ...farmInput, name: 'Other' });
    const farm = await farmsRepo.create(farmInput);
    const crop = await cropsRepo.create({ farm_id: farm.id, crop_key: 'wheat', sowing_date: '2026-11-10' });
    await activitiesRepo.create({ farm_id: farm.id, crop_id: crop.id, type: 'irrigation', done_on: '2026-11-15' });
    server.calls.length = 0;
    // first insert (Other) ok, second (farm) rejected
    const orig = server.transport.insertIgnore;
    server.transport.insertIgnore = async (t, p) => {
      if (p.id === farm.id) throw CHECK;
      return orig(t, p);
    };
    const r = await push(deps);
    expect(r).toMatchObject({ pushed: 1, failedNow: 1, skipped: 2 });
    const ob = store.snapshot().outbox;
    expect(ob.map((o) => [o.tbl, o.status, o.attempts])).toEqual([
      ['farms', 'failed', 1],
      ['crops', 'pending', 0],
      ['activities', 'pending', 0],
    ]);
    expect(server.tables.farms.has(other.id)).toBe(true);
    expect(server.tables.crops.size).toBe(0);
  });

  it('edits made while an op is in flight are rebased onto the new version', async () => {
    const { store, server, deps, farmsRepo } = setup();
    const farm = await farmsRepo.create(farmInput);
    const orig = server.transport.insertIgnore;
    server.transport.insertIgnore = async (t, p) => {
      await farmsRepo.update(farm.id, { name: 'Edited mid-flight' });
      return orig(t, p);
    };
    await push(deps);
    server.transport.insertIgnore = orig;
    const ob = store.snapshot().outbox;
    expect(ob).toHaveLength(1);
    expect(ob[0]).toMatchObject({ kind: 'update', base_version: 1 });
    expect(store.snapshot().tables.farms[farm.id]).toMatchObject({ name: 'Edited mid-flight', version: 1 });
    expect(await push(deps)).toMatchObject({ pushed: 1, conflicts: [] });
    expect(server.tables.farms.get(farm.id)).toMatchObject({ name: 'Edited mid-flight', version: 2 });
  });

  it('deleting a row that the server already deleted is not a conflict', async () => {
    const { store, server, deps, farmsRepo } = setup();
    const farm = await farmsRepo.create(farmInput);
    await push(deps);
    server.remoteEdit('farms', farm.id, { deleted_at: '2026-11-20T08:30:00Z' });
    await farmsRepo.update(farm.id, { name: 'late edit' });
    expect((await push(deps)).conflicts).toEqual([]);
    expect(store.snapshot().tables.farms[farm.id].deleted_at).toBe('2026-11-20T08:30:00Z');
  });
});

const srow = (id: string, updated_at: string, version = 1, extra: Record<string, unknown> = {}): ServerRow => ({
  id,
  user_id: USER,
  version,
  updated_at,
  deleted_at: null,
  last_op_id: null,
  created_at: updated_at,
  name: id,
  area_value: 1,
  area_unit: 'acre',
  ...extra,
});

describe('pull', () => {
  it('pages by keyset (ties on updated_at) and re-reads a 2 minute overlap', async () => {
    const { store, server, deps } = setup();
    const t = '2026-11-20T08:00:00.000Z';
    ['a', 'b', 'c', 'd', 'e'].forEach((id) => server.put('farms', srow(id, t)));
    const r = await pull(deps, 2);
    expect(r.applied).toBe(5);
    expect(store.snapshot().cursors.farms).toEqual({ updated_at: t, id: 'e' });

    const pages: unknown[] = [];
    const orig = server.transport.pullPage;
    server.transport.pullPage = async (q) => {
      pages.push(q.since ?? q.after);
      return orig(q);
    };
    await pull(deps, 2);
    expect(pages[0]).toBe('2026-11-20T07:58:00.000Z');
  });

  it('applies only when server.version >= local.version and skips rows with local ops', async () => {
    const { store, server, deps, farmsRepo } = setup();
    const farm = await farmsRepo.create(farmInput);
    await push(deps);
    await farmsRepo.update(farm.id, { name: 'local edit' });
    server.remoteEdit('farms', farm.id, { name: 'remote' });
    server.put('farms', srow('old', '2026-11-20T08:00:05.000Z', 1));
    await pull(deps);
    const s = store.snapshot();
    expect(s.tables.farms[farm.id].name).toBe('local edit'); // protected by its outbox entry
    expect(s.tables.farms.old.version).toBe(1);

    // a stale page (lower version) never overwrites a newer local copy
    await store.transaction((tx) => tx.putRow('farms', { ...s.tables.farms.old, version: 3, name: 'newer' }));
    await store.transaction((tx) => tx.setCursor('farms', null));
    await pull(deps);
    expect(store.snapshot().tables.farms.old).toMatchObject({ version: 3, name: 'newer' });
  });

  it('cursor older than 90 days → full re-download and prune rows gone from the server', async () => {
    const { store, server, deps } = setup();
    server.put('farms', srow('keep', '2026-11-20T08:00:00.000Z', 2));
    await store.transaction(async (tx) => {
      await tx.putRow('farms', srow('gone', '2026-07-01T00:00:00.000Z', 4));
      await tx.putRow('farms', srow('keep', '2026-07-01T00:00:00.000Z', 1));
      await tx.setCursor('farms', { updated_at: '2026-07-01T00:00:00.000Z', id: 'keep' });
    });
    const r = await pull(deps);
    expect(r.fullTables).toContain('farms');
    expect(r.pruned).toBe(1);
    const s = store.snapshot();
    expect(s.tables.farms.gone).toBeUndefined();
    expect(s.tables.farms.keep.version).toBe(2);
    expect(s.cursors.farms).toEqual({ updated_at: '2026-11-20T08:00:00.000Z', id: 'keep' });
  });

  it('a fresh cursor never prunes', async () => {
    const { store, deps } = setup();
    await store.transaction(async (tx) => {
      await tx.putRow('farms', srow('local', '2026-11-20T07:00:00.000Z', 2));
      await tx.setCursor('farms', { updated_at: '2026-11-20T07:00:00.000Z', id: 'local' });
    });
    expect((await pull(deps)).pruned).toBe(0);
    expect(store.snapshot().tables.farms.local).toBeDefined();
  });
});
