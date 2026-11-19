/** Demo mode / web: repos over sample data held in memory (nothing is saved or synced). */
import { addDays, todayLocal } from '@/engine';
import { sampleFarm } from '@/mocks/sample-data';

import { createMemoryStore } from './memory-store';
import { createRepos } from './repo-core';
import type { Row } from './store';
import type { Repos } from './types';

export const DEMO_USER_ID = '00000000-0000-4000-8000-000000000000';
const FARM_ID = '00000000-0000-4000-8000-0000000000f1';

let counter = 0;
const demoId = () => `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}`;

function seed(): Partial<Record<'farms' | 'crops', Row[]>> {
  const ts = new Date().toISOString();
  const sync = { user_id: DEMO_USER_ID, version: 1, last_op_id: null, created_at: ts, updated_at: ts, deleted_at: null };
  const today = todayLocal();
  return {
    farms: [
      {
        ...sync,
        id: FARM_ID,
        name: sampleFarm.name.en,
        area_value: sampleFarm.areaAcres,
        area_unit: 'acre',
        area_acres: sampleFarm.areaAcres,
        district: sampleFarm.district.en,
        lat: 31.42,
        lng: 73.08,
        location_source: 'district',
        soil_type: 'loam',
        notes: null,
      },
    ],
    crops: sampleFarm.crops.map((c, i) => ({
      ...sync,
      id: `00000000-0000-4000-8000-0000000000c${i + 1}`,
      farm_id: FARM_ID,
      crop_key: c.cropId,
      variety: c.variety,
      // sample-data stores dates relative to today; keep them relative in local time.
      sowing_date: addDays(today, -Math.round((Date.now() - new Date(c.sowingDate).getTime()) / 86_400_000)),
      area_value: c.areaAcres,
      area_unit: 'acre',
      area_acres: c.areaAcres,
      status: 'active',
      harvested_on: null,
    })),
  };
}

export function createSampleRepos(): Repos {
  const store = createMemoryStore(seed());
  return { kind: 'sample', ...createRepos(store, { userId: DEMO_USER_ID, newId: demoId }) };
}
