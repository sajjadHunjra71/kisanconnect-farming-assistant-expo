import type { ActivityRecord, CropRecord } from '@/db/types';

import { summarizeFarm } from '../summary';

const sync = { user_id: 'u', version: 1, last_op_id: null, created_at: '', updated_at: '', deleted_at: null };
const crop = (id: string, sowing_date: string, status: CropRecord['status'] = 'active'): CropRecord => ({
  ...sync, id, farm_id: 'f', crop_key: 'wheat', variety: null, sowing_date, area_value: null, area_unit: null, area_acres: null, status, harvested_on: null,
});
let n = 0;
const act = (type: ActivityRecord['type'], done_on: string, crop_id: string | null, cost_pkr: number | null = null, extra: Partial<ActivityRecord> = {}): ActivityRecord => ({
  ...sync, id: `a${++n}`, farm_id: 'f', crop_id, type, done_on, quantity: null, quantity_unit: null, product: null, cost_pkr, notes: null, source: 'manual', ...extra,
});

describe('summarizeFarm', () => {
  const crops = [crop('wheat', '2026-11-01'), crop('cane', '2026-03-01'), crop('old', '2025-01-01', 'harvested')];
  const acts = [
    act('irrigation', '2026-11-05', 'wheat', 1500),
    act('irrigation', '2026-11-12', 'wheat'),
    act('irrigation', '2026-10-01', 'wheat', 900), // before sowing → not this season
    act('spray', '2026-11-10', 'wheat', 2000),
    act('spray', '2026-11-15', null, 500), // farm-wide → counts for both crops
    act('irrigation', '2026-09-20', 'cane'),
    act('fertilizer', '2026-04-01', 'cane', 6000),
    act('spray', '2026-11-16', 'wheat', 99999, { deleted_at: '2026-11-17' }),
    act('irrigation', '2026-11-25', 'wheat'), // future → ignored
  ];
  const s = summarizeFarm(crops, acts, '2026-11-20');

  it('last irrigation per active crop', () => {
    expect(s.perCrop).toEqual([
      { cropId: 'wheat', lastIrrigation: '2026-11-12', daysSinceIrrigation: 8, spraysThisSeason: 2 },
      { cropId: 'cane', lastIrrigation: '2026-09-20', daysSinceIrrigation: 61, spraysThisSeason: 1 },
    ]);
  });

  it('season cost runs from the earliest active sowing date', () => {
    expect(s.seasonStart).toBe('2026-03-01');
    expect(s.seasonCost).toBe(1500 + 900 + 2000 + 500 + 6000);
  });

  it('no active crops → no season', () => {
    expect(summarizeFarm([crop('old', '2025-01-01', 'failed')], acts, '2026-11-20')).toEqual({ perCrop: [], seasonStart: null, seasonCost: 0 });
  });
});
