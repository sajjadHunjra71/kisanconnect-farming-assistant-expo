import { createMemoryStore } from '../memory-store';
import { NotFoundError, createRepos } from '../repo-core';
import { ValidationError } from '../validate';

const USER = '11111111-1111-4111-8111-111111111111';

function setup() {
  let n = 0;
  const store = createMemoryStore();
  const repos = createRepos(store, { userId: USER, newId: () => `id-${++n}` });
  return { store, ...repos };
}

const farmInput = { name: '  Home farm ', area_value: 16, area_unit: 'kanal' as const };

describe('repos + outbox', () => {
  it('create writes row and one create entry; edits coalesce into it', async () => {
    const { store, farmsRepo } = setup();
    const farm = await farmsRepo.create(farmInput);
    expect(farm).toMatchObject({ name: 'Home farm', area_acres: 2, version: 0, user_id: USER });

    await farmsRepo.update(farm.id, { name: 'Renamed' });
    const { outbox, tables } = store.snapshot();
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({ kind: 'create', base_version: 0, row_id: farm.id });
    expect(outbox[0].payload).toMatchObject({ name: 'Renamed' });
    expect(outbox[0].payload).not.toHaveProperty('area_acres');
    expect(tables.farms[farm.id].last_op_id).toBe(outbox[0].op_id);
  });

  it('create then delete before push leaves no outbox entries', async () => {
    const { store, farmsRepo, cropsRepo } = setup();
    const farm = await farmsRepo.create(farmInput);
    await cropsRepo.create({ farm_id: farm.id, crop_key: 'wheat', sowing_date: '2026-11-10' });
    await farmsRepo.remove(farm.id);
    expect(store.snapshot().outbox).toEqual([]);
    expect(await farmsRepo.list()).toEqual([]);
    expect(await cropsRepo.list({ farmId: farm.id })).toEqual([]);
  });

  it('update of a synced row keeps its base_version; delete replaces it', async () => {
    const { store, farmsRepo } = setup();
    const farm = await farmsRepo.create(farmInput);
    // pretend the create was pushed and the server is at version 4
    const s = store.snapshot();
    const synced = createMemoryStore({ farms: [{ ...s.tables.farms[farm.id], version: 4 }] });
    const repos = createRepos(synced, { userId: USER, newId: () => `x-${Math.random()}` });
    await repos.farmsRepo.update(farm.id, { name: 'A' });
    await repos.farmsRepo.update(farm.id, { name: 'B' });
    await repos.farmsRepo.remove(farm.id);
    const { outbox } = synced.snapshot();
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({ kind: 'delete', base_version: 4 });
  });

  it('rejects bad input and rolls back', async () => {
    const { store, farmsRepo, cropsRepo, activitiesRepo } = setup();
    await expect(farmsRepo.create({ ...farmInput, area_value: 0 })).rejects.toBeInstanceOf(ValidationError);
    await expect(cropsRepo.create({ farm_id: 'nope', crop_key: 'wheat', sowing_date: '2026-11-10' })).rejects.toThrow('farm_id');
    const f1 = await farmsRepo.create(farmInput);
    const f2 = await farmsRepo.create({ ...farmInput, name: 'Two' });
    const crop = await cropsRepo.create({ farm_id: f1.id, crop_key: 'cotton', sowing_date: '2026-05-01' });
    await expect(
      activitiesRepo.create({ farm_id: f2.id, crop_id: crop.id, type: 'spray', done_on: '2026-06-01' }),
    ).rejects.toThrow('another farm');
    await expect(farmsRepo.update('missing', { name: 'x' })).rejects.toBeInstanceOf(NotFoundError);
    expect(store.snapshot().outbox).toHaveLength(3);
  });

  it('crop farm_id cannot be changed by update', async () => {
    const { farmsRepo, cropsRepo } = setup();
    const f1 = await farmsRepo.create(farmInput);
    const f2 = await farmsRepo.create({ ...farmInput, name: 'Two' });
    const crop = await cropsRepo.create({ farm_id: f1.id, crop_key: 'rice', sowing_date: '2026-07-01' });
    const updated = await cropsRepo.update(crop.id, { farm_id: f2.id, variety: 'Super Basmati' });
    expect(updated.farm_id).toBe(f1.id);
    expect(updated.variety).toBe('Super Basmati');
  });

  it('deleting a crop soft-deletes its activities and drops their unsent edits', async () => {
    const { store, farmsRepo, cropsRepo, activitiesRepo } = setup();
    const farm = await farmsRepo.create(farmInput);
    const crop = await cropsRepo.create({ farm_id: farm.id, crop_key: 'wheat', sowing_date: '2026-11-10' });
    const act = await activitiesRepo.create({ farm_id: farm.id, crop_id: crop.id, type: 'irrigation', done_on: '2026-11-15' });
    await cropsRepo.remove(crop.id);
    const s = store.snapshot();
    expect(s.tables.activities[act.id].deleted_at).not.toBeNull();
    expect(s.outbox.map((o) => o.tbl)).toEqual(['farms']);
  });
});

describe('logActivity', () => {
  it('harvest + mark crop harvested commit together', async () => {
    const { store, farmsRepo, cropsRepo, logActivity } = setup();
    const farm = await farmsRepo.create(farmInput);
    const crop = await cropsRepo.create({ farm_id: farm.id, crop_key: 'wheat', sowing_date: '2026-03-01' });
    await logActivity({ farm_id: farm.id, crop_id: crop.id, type: 'harvest', done_on: '2026-04-20' }, { markCropHarvested: true });
    expect(await cropsRepo.get(crop.id)).toMatchObject({ status: 'harvested', harvested_on: '2026-04-20' });
    expect(Object.keys(store.snapshot().tables.activities)).toHaveLength(1);
  });

  it('rolls back the activity when the crop update fails', async () => {
    const { store, farmsRepo, cropsRepo, logActivity } = setup();
    const farm = await farmsRepo.create(farmInput);
    const crop = await cropsRepo.create({ farm_id: farm.id, crop_key: 'wheat', sowing_date: '2026-05-01' });
    // harvest dated before sowing → crop update is rejected → nothing is written
    await expect(
      logActivity({ farm_id: farm.id, crop_id: crop.id, type: 'harvest', done_on: '2026-04-20' }, { markCropHarvested: true }),
    ).rejects.toThrow('harvested_on');
    expect(store.snapshot().tables.activities).toEqual({});
    expect((await cropsRepo.get(crop.id))?.status).toBe('active');
  });
});
