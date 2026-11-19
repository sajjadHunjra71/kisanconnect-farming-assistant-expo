import { CROP_CALENDARS, type CropId, type CropStageDef } from './crops-data';
import { addDays, daysBetween, todayLocal } from './dates';

export type CropProgress =
  | { status: 'planned'; daysUntil: number; day: 0; stage: CropStageDef; stageIndex: 0; progress: 0 }
  | { status: 'growing'; day: number; stage: CropStageDef; stageIndex: number; progress: number; daysLeftInStage: number }
  | { status: 'completed'; day: number; stage: CropStageDef; stageIndex: number; progress: 1 };

/**
 * Where a crop is in its season, counted in LOCAL calendar days from the sowing date.
 * Day 0 = sowing day. A future sowing date is "planned"; past the season is "completed".
 */
export function cropProgress(cropId: CropId, sowingDate: string, today: string = todayLocal()): CropProgress {
  const crop = CROP_CALENDARS[cropId];
  const day = daysBetween(sowingDate, today);
  const first = crop.stages[0];
  const lastIndex = crop.stages.length - 1;

  if (day < 0) {
    return { status: 'planned', daysUntil: -day, day: 0, stage: first, stageIndex: 0, progress: 0 };
  }
  if (day > crop.seasonDays) {
    return { status: 'completed', day, stage: crop.stages[lastIndex], stageIndex: lastIndex, progress: 1 };
  }
  let stageIndex = crop.stages.findIndex((s) => day >= s.startDay && day <= s.endDay);
  if (stageIndex === -1) stageIndex = lastIndex;
  const stage = crop.stages[stageIndex];
  return {
    status: 'growing',
    day,
    stage,
    stageIndex,
    progress: Math.min(1, day / crop.seasonDays),
    daysLeftInStage: Math.max(0, stage.endDay - day),
  };
}

/** Expected harvest date (local 'YYYY-MM-DD') for a sowing date. */
export function expectedHarvestDate(cropId: CropId, sowingDate: string): string {
  return addDays(sowingDate, CROP_CALENDARS[cropId].seasonDays);
}
