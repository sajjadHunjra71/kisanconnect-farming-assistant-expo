/**
 * Compatibility layer: crop calendars now live in the pure-TS engine (`src/engine`).
 * Screens keep importing from here until they move to the engine directly.
 */
import { CROP_CALENDARS, cropProgress, daysBetween, todayLocal, type CropId } from '@/engine';
import type { CropDefinition } from '@/types/domain';

export { PRIMARY_CROPS } from '@/engine';

export const CROPS = CROP_CALENDARS as unknown as Record<CropId, CropDefinition>;

export function daysSince(date: string, now = new Date()): number {
  return Math.max(0, daysBetween(date, todayLocal(now)));
}

export function currentStage(cropId: CropId, sowingDate: string) {
  const p = cropProgress(cropId, sowingDate);
  return { day: p.day, stage: p.stage, progress: p.progress, status: p.status };
}
