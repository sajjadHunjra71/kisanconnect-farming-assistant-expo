/** Demo mode / web: repos over sample data held in memory (nothing is saved or synced). */
import { addDays, todayLocal } from '@/engine';
import { sampleFarm } from '@/mocks/sample-data';

import { createMemoryAlerts, type AlertRecord } from './alerts-local';
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

/** Two sample inbox alerts so the bell and inbox can be seen in demo mode. */
function sampleAlerts(): AlertRecord[] {
  const today = todayLocal();
  const ts = new Date().toISOString();
  const base = { farm_id: FARM_ID, created_at: ts, updated_at: ts, pushed_at: null, read_dirty: false, notified_at: null };
  return [
    { ...base, id: '00000000-0000-4000-8000-0000000000a1', crop_id: null, kind: 'fog', severity: 'warning', title: 'Fog expected', body: 'Low visibility on the roads. Wait with spraying until it clears.', start_date: addDays(today, 1), read_at: null },
    { ...base, id: '00000000-0000-4000-8000-0000000000a2', crop_id: '00000000-0000-4000-8000-0000000000c1', kind: 'wheat-yellow-rust', severity: 'warning', title: 'Yellow rust weather for wheat', body: 'Cool, humid or rainy days ahead. Check lower leaves for yellow stripes.', start_date: today, read_at: ts },
  ];
}

export function createSampleRepos(): Repos {
  const store = createMemoryStore(seed());
  return { kind: 'sample', alertsLocal: createMemoryAlerts(sampleAlerts()), ...createRepos(store, { userId: DEMO_USER_ID, newId: demoId, emitWrites: true }) };
}
