/**
 * Farm summary (pure). "This season" for a crop = on/after its sowing date.
 * Activities logged for the whole farm (no crop) count for every active crop.
 */
import type { ActivityRecord, CropRecord } from '@/db/types';
import { daysBetween } from '@/engine/dates';

export type CropSummary = {
  cropId: string;
  lastIrrigation: string | null;
  daysSinceIrrigation: number | null;
  spraysThisSeason: number;
};

export type FarmSummary = {
  perCrop: CropSummary[];
  /** Earliest sowing date of the active crops (null = no active crops). */
  seasonStart: string | null;
  seasonCost: number;
};

export function summarizeFarm(crops: CropRecord[], activities: ActivityRecord[], today: string): FarmSummary {
  const active = crops.filter((c) => c.status === 'active' && !c.deleted_at);
  const live = activities.filter((a) => !a.deleted_at);

  const perCrop = active.map((c) => {
    const mine = live.filter((a) => (a.crop_id === c.id || a.crop_id === null) && a.done_on >= c.sowing_date && a.done_on <= today);
    const lastIrrigation = mine
      .filter((a) => a.type === 'irrigation')
      .reduce<string | null>((max, a) => (max === null || a.done_on > max ? a.done_on : max), null);
    return {
      cropId: c.id,
      lastIrrigation,
      daysSinceIrrigation: lastIrrigation ? daysBetween(lastIrrigation, today) : null,
      spraysThisSeason: mine.filter((a) => a.type === 'spray').length,
    };
  });

  const seasonStart = active.reduce<string | null>((min, c) => (min === null || c.sowing_date < min ? c.sowing_date : min), null);
  const seasonCost = seasonStart
    ? Math.round(live.filter((a) => a.done_on >= seasonStart && a.done_on <= today).reduce((sum, a) => sum + (a.cost_pkr ?? 0), 0) * 100) / 100
    : 0;

  return { perCrop, seasonStart, seasonCost };
}
