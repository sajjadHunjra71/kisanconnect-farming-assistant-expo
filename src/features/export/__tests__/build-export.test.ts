import { createMemoryStore } from '@/db/memory-store';
import { createRepos } from '@/db/repo-core';

import { buildExport, exportFileName } from '../build-export';

const USER = '11111111-1111-4111-8111-111111111111';

describe('buildExport', () => {
  it('exports live farms, crops and activities without sync fields', async () => {
    let n = 0;
    const { farmsRepo, cropsRepo, activitiesRepo } = createRepos(createMemoryStore(), { userId: USER, newId: () => `id-${++n}` });
    const farm = await farmsRepo.create({ name: 'Home', area_value: 16, area_unit: 'kanal' });
    const gone = await farmsRepo.create({ name: 'Sold', area_value: 1, area_unit: 'acre' });
    const crop = await cropsRepo.create({ farm_id: farm.id, crop_key: 'wheat', sowing_date: '2026-11-10' });
    const deletedCrop = await cropsRepo.create({ farm_id: farm.id, crop_key: 'maize', sowing_date: '2026-03-01' });
    await cropsRepo.create({ farm_id: gone.id, crop_key: 'rice', sowing_date: '2026-07-01' });
    await activitiesRepo.create({ farm_id: farm.id, crop_id: crop.id, type: 'irrigation', done_on: '2026-11-15', cost_pkr: 1200 });
    await cropsRepo.remove(deletedCrop.id);
    await farmsRepo.remove(gone.id);

    const all = { includeDeleted: true };
    const out = buildExport({
      profile: { email: 'a@example.test', full_name: 'Aslam', district: 'Faisalabad', language: 'ur', units: 'acre' },
      farms: await farmsRepo.list(all),
      crops: await cropsRepo.list(all),
      activities: await activitiesRepo.list(all),
      now: new Date('2026-11-20T10:00:00Z'),
    });

    expect(Object.keys(out)).toEqual(['exportedAt', 'profile', 'farms', 'crops', 'activities', 'scans']);
    expect(out.exportedAt).toBe('2026-11-20T10:00:00.000Z');
    expect(out.farms.map((f) => f.name)).toEqual(['Home']);
    expect(out.farms[0]).toMatchObject({ area_value: 16, area_unit: 'kanal', area_acres: 2 });
    expect(out.crops.map((c) => c.crop_key)).toEqual(['wheat']);
    expect(out.activities).toHaveLength(1);
    for (const row of [...out.farms, ...out.crops, ...out.activities]) {
      for (const k of ['version', 'last_op_id', 'deleted_at', 'user_id']) expect(row).not.toHaveProperty(k);
    }
    expect(JSON.parse(JSON.stringify(out))).toEqual(out);
  });

  it('names the file by date', () => {
    expect(exportFileName(new Date('2026-11-20T10:00:00Z'))).toBe('kisanconnect-export-2026-11-20.json');
  });
});
